import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

// Keep the existing screen taxonomy and category presentation.
export const FAQ_CATEGORIES = ['All Categories', 'Getting Started', 'Jobs & Trips', 'Billing & Payments', 'Fleet & Drivers', 'Account & Security'];
const CATEGORY_ICONS = { 'Getting Started': 'rocket', 'Jobs & Trips': 'package', 'Billing & Payments': 'wallet', 'Fleet & Drivers': 'truck', 'Account & Security': 'shield-check' };
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN']);
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim() ? value : null;
const failure = message => ({ error: { status: 'CUSTOM_ERROR', error: message, data: { message } } });
const listKeys = ['faqs', 'items', 'groups', 'faqGroups', 'categories', 'questions', 'data'];
const childQuestions = value => ['questions', 'faqs', 'items'].map(key => value?.[key]).find(Array.isArray);
function categoryLabel(value) {
  const raw = text(value)?.trim();
  return raw ? FAQ_CATEGORIES.slice(1).find(label => label.toLowerCase() === raw.toLowerCase()) || raw : '—';
}

export function adaptFaqResponse(response) {
  const dto = unwrapApiResponseData(response);
  let list = Array.isArray(dto) ? dto : listKeys.map(key => dto?.[key]).find(Array.isArray);
  let dictionary = false;
  if (record(dto) && text(dto.category) && childQuestions(dto) && !Object.hasOwn(dto, 'question') && !Object.hasOwn(dto, 'answer')) list = [dto];
  if (!list && record(dto)) {
    const entries = Object.entries(dto);
    if (entries.length && entries.every(([, values]) => Array.isArray(values))) {
      list = entries.map(([category, questions]) => ({ category, questions }));
      dictionary = true;
    }
  }
  if (!Array.isArray(list)) throw new Error('The FAQ response is missing a valid collection. A list response example is needed.');
  if (list.some(value => !record(value))) throw new Error('The FAQ response contains an invalid record.');
  const groups = new Map();
  let position = 0;
  const keyOccurrences = new Map();
  function add(category, rows) {
    if (!Array.isArray(rows) || rows.some(value => !record(value))) throw new Error('The FAQ category is missing a valid question collection.');
    const key = categoryLabel(category);
    let group = groups.get(key);
    if (!group) {
      group = { key, icon: Object.hasOwn(CATEGORY_ICONS, key) ? CATEGORY_ICONS[key] : undefined, categoryAvailable: key !== '—', questions: [] };
      groups.set(key, group);
    }
    for (const row of rows) {
      const q = text(row.question) || text(row.q), a = text(row.answer) || text(row.a);
      const backendId = text(row.id)?.trim() || (Number.isSafeInteger(row.id) && row.id >= 0 ? String(row.id) : null);
      const identity = backendId ? JSON.stringify(['id', backendId]) : JSON.stringify(['question', key, q, a]);
      const occurrence = keyOccurrences.get(identity) || 0;
      keyOccurrences.set(identity, occurrence + 1);
      position += 1;
      group.questions.push({
        // This is an internal accordion key, never a fabricated server ID.
        key: `faq:${identity}:${occurrence}`, backendId,
        q: q || '—', a: a || '—', questionAvailable: q != null, answerAvailable: a != null,
        sortOrder: typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder) ? row.sortOrder : null,
      });
    }
  }
  const grouped = dictionary || list.length > 0 && list.every(value => childQuestions(value) && !Object.hasOwn(value, 'question') && !Object.hasOwn(value, 'answer') && !Object.hasOwn(value, 'q') && !Object.hasOwn(value, 'a'));
  if (grouped) {
    for (const group of list) add(text(group.category) || text(group.name) || text(group.key), childQuestions(group));
  } else {
    if (list.some(value => childQuestions(value))) throw new Error('The FAQ response mixes grouped and individual records.');
    for (const row of list) add(row.category, [row]);
  }
  const metadata = record(dto?.pagination) ? dto.pagination : null;
  if (metadata && (!Number.isSafeInteger(metadata.total) || metadata.total < 0 || metadata.total !== position
    || !Number.isSafeInteger(metadata.totalPages) || metadata.totalPages < 0 || metadata.totalPages > 1
    || metadata.page !== 1 || (metadata.total > 0 && metadata.totalPages !== 1))) {
    throw new Error('The FAQ response is incomplete. Pagination parameters are not documented for this endpoint.');
  }
  const order = FAQ_CATEGORIES.slice(1);
  return [...groups.values()].map(group => ({
    ...group,
    questions: group.questions.every(row => row.sortOrder != null)
      ? [...group.questions].sort((left, right) => left.sortOrder - right.sortOrder) : group.questions,
  })).sort((left, right) => {
    const leftIndex = order.indexOf(left.key), rightIndex = order.indexOf(right.key);
    if (leftIndex === -1 && rightIndex === -1) return 0;
    return leftIndex === -1 ? 1 : rightIndex === -1 ? -1 : leftIndex - rightIndex;
  });
}

const taggedApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminFaqs'] });
export const faqApi = taggedApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: builder => ({
    getAdminFaqDirectory: builder.query({
      async queryFn({ owner }, api, options, baseQuery) {
        const account = api.getState().auth.admin;
        const owned = () => !api.signal.aborted && Boolean(api.getState().auth.accessToken)
          && Boolean(owner) && api.getState().auth.admin?.id === owner
          && api.getState().auth.admin?.role === account?.role && ADMIN_ROLES.has(account?.role);
        if (!owned()) return failure('An active admin session is required to read FAQs.');
        // No pagination or search parameters are documented. Read the complete
        // collection and retain the screen's existing local search/category flow.
        const result = await baseQuery({ url: '/admin/faq' });
        if (!owned()) return failure('The admin session changed while loading FAQs.');
        if (result.error) return result;
        try { return { data: adaptFaqResponse(result.data) }; }
        catch (error) { return failure(error.message); }
      },
      providesTags: [{ type: 'AdminFaqs', id: 'LIST' }],
    }),
  }),
});
export const { useGetAdminFaqDirectoryQuery } = faqApi;
