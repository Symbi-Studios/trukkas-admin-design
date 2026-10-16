import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

// Existing UI taxonomy, without the fixture counts.
export const KNOWLEDGE_CATEGORIES = ['Trips & Jobs', 'Container Triangulation', 'Provisional Release', 'Fleet Management', 'Finance', 'Live Tracking', 'Pricing', 'General'];
export const ARTICLE_STATUS_CODES = { Draft: 'DRAFT', Published: 'PUBLISHED', Archived: 'ARCHIVED' };
const STATUS_LABELS = { DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const failure = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
const number = (value) => (typeof value === 'number' || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim()))) && Number.isFinite(Number(value)) ? Number(value) : null;
const count = (value) => { const parsed = number(value); return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null; };
const percent = (value) => { const parsed = number(value); return parsed != null && parsed >= 0 && parsed <= 100 ? parsed : null; };
const boolean = (value) => typeof value === 'boolean' ? value : null;
export const knowledgeCount = (value) => count(value) == null ? '—' : count(value).toLocaleString('en-NG');
function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null;
}
function date(value, timeOnly = false) {
  const parsed = timestamp(value);
  return parsed == null ? '—' : new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', ...(timeOnly ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }) }).format(new Date(parsed));
}
const payload = (response) => {
  const dto = unwrapApiResponseData(response);
  return Array.isArray(dto?.data) ? dto.data : dto;
};
const safeUrl = (value) => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; } };
const attachment = (file) => ({ id: text(file?.id), name: text(file?.name) || '—', url: safeUrl(file?.url), sizeBytes: count(file?.sizeBytes), mimeType: text(file?.mimeType) });
const stringList = (value) => Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null;
const articleRecord = (response) => { const dto = record(payload(response)); return record(dto.article || dto); };
export const emptyKnowledgeArticle = {
  id: '—', title: '—', summary: '—', content: '—', category: '—', subcategory: '—', author: '—', authorRole: '—',
  status: '—', statusCode: null, views: null, helpful: null, updated: '—', time: '—', published: '—', publishedTime: '—',
  visibility: '—', featured: null, feedback: null, related: null, seoTitle: null, metaDescription: null, tags: null, attachments: null,
  version: null, authorId: null, summaryIsGenerated: null, helpfulCount: null, notHelpfulCount: null, guide: null, relatedIds: null, visibilityCode: null, lastEditedBy: null, relatedArticles: null, core: { title: null, body: null, category: null, status: null },
};
function adaptArticle(dto, includeRelated = true) {
  const author = record(dto.author), code = text(dto.status)?.toUpperCase();
  const body = typeof dto.body === 'string' && dto.body.trim() ? dto.body : null;
  return {
    ...emptyKnowledgeArticle, id: dto.id, title: text(dto.title) || '—', summary: text(dto.summary) || '—', content: body || '—',
    category: text(dto.category) || '—', subcategory: text(dto.subcategory) || '—',
    author: text(author.name) || text(dto.authorName) || text(dto.author) || '—', authorRole: text(author.role) || '—', authorId: text(author.id), version: timestamp(dto.version) == null ? null : dto.version, summaryIsGenerated: boolean(dto.summaryIsGenerated), helpfulCount: count(dto.helpfulCount), notHelpfulCount: count(dto.notHelpfulCount), lastEditedBy: dto.lastEditedBy == null ? null : record(dto.lastEditedBy), guide: adaptGuide(dto.guide), relatedIds: stringList(dto.relatedIds),
    status: STATUS_LABELS[code] || '—', statusCode: STATUS_LABELS[code] ? code : null,
    views: count(dto.views), helpful: percent(dto.helpful), updated: date(dto.updatedAt), time: date(dto.updatedAt, true),
    published: date(dto.publishedAt), publishedTime: date(dto.publishedAt, true),
    visibilityCode: ['ALL', 'FORWARDERS', 'TRUCKERS', 'DRIVERS', 'INTERNAL'].includes(dto.visibility) ? dto.visibility : null,
    visibility: ({ ALL: 'Public', FORWARDERS: 'Forwarders', TRUCKERS: 'Truckers', DRIVERS: 'Drivers', INTERNAL: 'Internal' }[dto.visibility] || '—'),
    featured: boolean(dto.featured), feedback: boolean(dto.feedback ?? dto.allowFeedback), related: null,
    seoTitle: text(dto.seoTitle), metaDescription: text(dto.metaDescription),
    tags: Array.isArray(dto.tags) && dto.tags.every((tag) => text(tag)) ? dto.tags : null,
    attachments: Array.isArray(dto.attachments) ? dto.attachments.map(attachment) : null,
    relatedArticles: includeRelated && Array.isArray(dto.relatedArticles) && dto.relatedArticles.every((article) => text(article?.id)) ? dto.relatedArticles.map((article) => adaptArticle(article, false)) : null,
    core: { title: text(dto.title), body, category: text(dto.category), status: STATUS_LABELS[code] ? code : null, summary: dto.summaryIsGenerated === true ? null : text(dto.summary), subcategory: text(dto.subcategory), visibility: text(dto.visibility), featured: boolean(dto.featured), feedback: boolean(dto.feedback ?? dto.allowFeedback), seoTitle: text(dto.seoTitle), metaDescription: text(dto.metaDescription), tags: stringList(dto.tags), attachmentIds: Array.isArray(dto.attachments) && dto.attachments.every(file => text(file?.id)) ? dto.attachments.map(file => file.id) : null },
  };
}
function adaptGuide(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const screenshot = record(raw.screenshot);
  return {
    steps: Array.isArray(raw.steps) ? raw.steps.map(step => ({ title: text(step?.title), paragraphs: stringList(step?.paragraphs) })) : null,
    tip: text(raw.tip), fieldItems: Array.isArray(raw.fieldItems) ? raw.fieldItems.map(item => ({ label: text(item?.label), description: text(item?.description) })) : null,
    screenshot: raw.screenshot == null ? null : { header: text(screenshot.header), navigation: stringList(screenshot.navigation), title: text(screenshot.title), tabs: stringList(screenshot.tabs), columns: stringList(screenshot.columns), rows: Array.isArray(screenshot.rows) && screenshot.rows.every(row => stringList(row)) ? screenshot.rows : null },
  };
}
export function knowledgeSummary(rows, stats) {
  const known = Array.isArray(rows);
  const categoriesKnown = known && rows.every((article) => article.category !== '—');
  return {
    total: knowledgeCount(stats?.cards?.totalArticles?.value),
    published: knowledgeCount(stats?.cards?.publishedArticles?.value),
    draft: knowledgeCount(stats?.cards?.draftArticles?.value),
    monthlyViews: knowledgeCount(stats?.monthlyViews), helpful: percent(stats?.cards?.helpfulPercentage?.value) == null ? '—' : percent(stats.cards.helpfulPercentage.value) + '%',
    changes: Object.fromEntries(['totalArticles', 'publishedArticles', 'draftArticles', 'views', 'helpfulPercentage'].map(key => { const card = record(stats?.cards?.[key]), change = number(card.changePercent); return [key, { delta: change == null ? '—' : Math.abs(change) + '%', direction: ['up', 'down'].includes(card.direction) ? card.direction : null }]; })),
    feedback: Object.fromEntries(['helpful', 'notHelpful', 'neutral'].map(key => [key, { count: count(stats?.feedback?.[key]?.count), percentage: percent(stats?.feedback?.[key]?.percentage) }])),
    categories: KNOWLEDGE_CATEGORIES.map((name) => [name, knowledgeCount(categoriesKnown ? rows.filter((article) => article.category === name).length : null)]),
    popular: known && rows.every((article) => article.views != null) ? [...rows].sort((a, b) => b.views - a.views).slice(0, 5) : null,
  };
}
export const knowledgeDetailUrl = (id) => `/knowledge-base/detail?articleId=${encodeURIComponent(id)}`;
export const knowledgeEditUrl = (id) => `/knowledge-base/edit?articleId=${encodeURIComponent(id)}`;
export function knowledgeEditorValues(article) {
  return {
    title: article.core.title, category: article.core.category, content: article.core.body, status: article.statusCode ? article.status : null,
    summary: article.summaryIsGenerated === true ? null : article.summary === '—' ? null : article.summary, subcategory: article.subcategory === '—' ? null : article.subcategory,
    visibility: article.visibilityCode === 'ALL' ? 'Public' : article.visibilityCode === 'INTERNAL' ? 'Internal' : article.visibilityCode, featured: article.featured, feedback: article.feedback, related: article.related,
    seoTitle: article.seoTitle, metaDescription: article.metaDescription, tags: article.tags, attachments: article.attachments,
  };
}
export function knowledgePublisher(article, admin, editing) {
  const name = editing ? article?.author : text(admin?.name), code = editing ? article?.authorRole : text(admin?.role);
  const role = { SUPER_ADMIN: 'Super Admin', OPS_ADMIN: 'Ops Admin', FINANCE_ADMIN: 'Finance Admin' }[code] || '—';
  return { name: name || '—', role, initials: name && name !== '—' ? name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() : '—' };
}
async function readArticle(baseQuery, id) {
  const result = await baseQuery(`/admin/knowledge-base/articles/${encodeURIComponent(id)}`);
  if (result.error) return result;
  const dto = articleRecord(result.data);
  return dto.id === id ? { data: adaptArticle(dto) } : failure('The knowledge base response did not identify this article.');
}
function writeBody(fields, creating) {
  const source = record(fields), keys = Object.keys(source), body = {};
  const strings = { title: 150, body: Infinity, category: Infinity, summary: 500, subcategory: 100, seoTitle: 70, metaDescription: 160 };
  if (!keys.length || keys.some(key => ![...Object.keys(strings), 'status', 'visibility', 'featured', 'feedback', 'tags', 'attachmentIds'].includes(key))) throw new Error('Only documented article fields can be saved.');
  for (const key of keys) {
    const value = source[key];
    if (key in strings) {
      if (typeof value !== 'string' || value.length > strings[key] || (['title', 'body', 'category'].includes(key) && (!text(value) || value.trim() === '—'))) throw new Error('Enter valid article fields within their character limits.');
      body[key] = key === 'body' ? value : value.trim();
    } else if (key === 'status') {
      if (!Object.values(ARTICLE_STATUS_CODES).includes(value)) throw new Error('Choose a supported article status.');
      body[key] = value;
    } else if (key === 'visibility') {
      if (!['ALL', 'FORWARDERS', 'TRUCKERS', 'DRIVERS', 'INTERNAL'].includes(value)) throw new Error('Choose a supported article visibility.');
      body[key] = value;
    } else if (['featured', 'feedback'].includes(key)) {
      if (typeof value !== 'boolean') throw new Error('Choose an article setting.');
      body[key] = value;
    } else {
      if (!stringList(value) || value.some(item => !text(item)) || (key === 'tags' && value.length > 20) || new Set(value).size !== value.length) throw new Error('Enter valid tags or attachment IDs.');
      body[key] = key === 'tags' ? value.map(item => item.trim().toLowerCase()) : value;
    }
  }
  if (creating && ['title', 'body', 'category'].some(key => !body[key])) throw new Error('Complete all required fields');
  return body;
}
export function knowledgeArticleFields(form, status) {
  const fields = { title: form.title?.trim(), body: form.content, category: form.category, status: ARTICLE_STATUS_CODES[status] };
  for (const key of ['summary', 'subcategory', 'featured', 'feedback', 'seoTitle', 'metaDescription', 'tags']) if (form[key] != null) fields[key] = form[key];
  if (form.visibility != null) fields.visibility = ({ Public: 'ALL', Internal: 'INTERNAL' })[form.visibility] || form.visibility;
  if (form.attachments != null) { if (!form.attachments.every(file => text(file.id))) throw new Error('Existing attachment IDs are unavailable. Reload the article before saving.'); fields.attachmentIds = form.attachments.map(file => file.id); }
  return fields;
}
async function confirmWrite(baseQuery, response, expected, existingId) {
  const dto = articleRecord(response), id = existingId || text(dto.id);
  if (!id) return failure('The save returned no article ID. Refresh the directory before trying again.');
  let article = text(dto.id) === id ? adaptArticle(dto) : null;
  const matches = (value) => value && value.version && Object.entries(expected).every(([key, content]) => {
    let saved = value.core[key];
    if (typeof content === 'string' && content === '' && saved == null) saved = '';
    if (['tags', 'attachmentIds'].includes(key) && Array.isArray(saved)) return JSON.stringify([...saved].sort()) === JSON.stringify([...content].sort());
    return JSON.stringify(saved) === JSON.stringify(content);
  });
  if (!matches(article)) {
    const result = await readArticle(baseQuery, id);
    if (result.error) return failure('The article save could not be confirmed. Refresh before trying again.');
    article = result.data;
  }
  return matches(article) ? { data: article } : failure('The article save could not be confirmed. Refresh before trying again.');
}
export const knowledgeBaseApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminKnowledgeArticles'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminKnowledgeStats: builder.query({
      query: ({ period = 'thisMonth', comparisonDays = 7, dateFrom, dateTo } = {}) => ({ url: '/admin/knowledge-base/stats', params: { period, comparisonDays, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) } }),
      transformResponse: response => record(payload(response)),
      providesTags: [{ type: 'AdminKnowledgeArticles', id: 'STATS' }],
    }),
    uploadAdminKnowledgeAttachments: builder.mutation({
      async queryFn(files, api, _options, baseQuery) {
        const types = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg']);
        if (!Array.isArray(files) || !files.length || files.length > 5 || files.some(file => !(file instanceof File) || file.size > 10 * 1024 * 1024 || !/\.(pdf|docx?|png|jpe?g)$/i.test(file.name) || file.type && !types.has(file.type))) return failure('Choose 1–5 PDF, DOC, DOCX, PNG or JPG files, up to 10 MB each.');
        const owner = api.getState().auth.admin?.id, body = new FormData(); files.forEach(file => body.append('files', file));
        const result = await baseQuery({ url: '/admin/knowledge-base/uploads', method: 'POST', body });
        if (result.error) return result;
        if (!owner || api.getState().auth.admin?.id !== owner || api.signal.aborted) return failure('The session changed. Reload before continuing.');
        const dto = record(payload(result.data)), uploaded = Array.isArray(dto.files) ? dto.files.map(attachment) : [];
        return uploaded.length === files.length && uploaded.every(file => file.id && file.url && file.name !== '—' && file.sizeBytes != null && file.mimeType) && new Set(uploaded.map(file => file.id)).size === uploaded.length ? { data: uploaded } : failure('The server did not return complete attachment details. Reload before trying again.');
      },
    }),
    voteAdminKnowledgeArticle: builder.mutation({
      async queryFn({ id, helpful }, _api, _options, baseQuery) {
        if (!text(id) || typeof helpful !== 'boolean') return failure('Select a helpful rating.');
        const result = await baseQuery({ url: '/admin/knowledge-base/articles/' + encodeURIComponent(id) + '/feedback', method: 'POST', body: { helpful } });
        if (result.error) return result;
        const dto = record(payload(result.data));
        return text(dto.id) && dto.articleId === id && dto.helpful === helpful && percent(dto.helpfulPercentage) != null && count(dto.helpfulCount) != null && count(dto.notHelpfulCount) != null ? { data: dto } : failure('The feedback response could not be confirmed. Refresh the article.');
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'AdminKnowledgeArticles', id }, { type: 'AdminKnowledgeArticles', id: 'LIST' }, { type: 'AdminKnowledgeArticles', id: 'STATS' }],
    }),
    getAdminKnowledgeArticleDirectory: builder.query({
      async queryFn({ search, category, status } = {}, _api, _options, baseQuery) {
        if (status && !Object.values(ARTICLE_STATUS_CODES).includes(status)) return failure('Choose a supported article status.');
        const rows = [], seen = new Set(); let page = 1, totalPages = 1, total = null;
        do {
          if (_api.signal.aborted) return failure('The article request was cancelled.');
          const result = await baseQuery({ url: '/admin/knowledge-base/articles', params: { page, limit: 100, sort: 'recent', ...(text(search) ? { search: search.trim() } : {}), ...(text(category) ? { category: category.trim() } : {}), ...(status ? { status } : {}) } });
          if (result.error) return result;
          const dto = record(payload(result.data)), pagination = record(dto.pagination || dto);
          if (!Array.isArray(dto.articles) || count(pagination.page) !== page || count(pagination.total) == null || count(pagination.totalPages) == null
            || (count(pagination.total) > 0 && count(pagination.totalPages) === 0) || page > Math.max(1, count(pagination.totalPages))) return failure('The knowledge base response is missing valid articles or pagination.');
          if (total != null && (total !== count(pagination.total) || totalPages !== Math.max(1, count(pagination.totalPages)))) return failure('The article directory changed while loading. Refresh to load it again.');
          total = count(pagination.total); totalPages = Math.max(1, count(pagination.totalPages));
          if (page < totalPages && dto.articles.length === 0) return failure('The article directory returned an incomplete collection.');
          for (const article of dto.articles) {
            if (!text(article?.id) || seen.has(article.id)) return failure('The article directory returned missing or duplicate IDs.');
            seen.add(article.id); rows.push(adaptArticle(article));
          }
          page += 1;
        } while (page <= totalPages);
        return rows.length === total ? { data: rows } : failure('The article directory did not return all records.');
      }, providesTags: [{ type: 'AdminKnowledgeArticles', id: 'LIST' }],
    }),
    getAdminKnowledgeArticleDetail: builder.query({
      queryFn: (id, _api, _options, baseQuery) => text(id) ? readArticle(baseQuery, id) : failure('An article ID is required.'),
      providesTags: (_result, _error, id) => [{ type: 'AdminKnowledgeArticles', id }],
    }),
    createAdminKnowledgeArticle: builder.mutation({
      async queryFn(fields, _api, _options, baseQuery) {
        let body; try { body = writeBody(fields, true); } catch (error) { return failure(error.message); }
        const result = await baseQuery({ url: '/admin/knowledge-base/articles', method: 'POST', body });
        return result.error ? result : confirmWrite(baseQuery, result.data, body);
      }, invalidatesTags: [{ type: 'AdminKnowledgeArticles', id: 'LIST' }, { type: 'AdminKnowledgeArticles', id: 'STATS' }],
    }),
    updateAdminKnowledgeArticle: builder.mutation({
      async queryFn({ id, changes, expectedVersion }, _api, _options, baseQuery) {
        if (!text(id) || timestamp(expectedVersion) == null) return failure('Reload the article to obtain its version before saving.');
        let body; try { body = writeBody(changes, false); } catch (error) { return failure(error.message); }
        const result = await baseQuery({ url: `/admin/knowledge-base/articles/${encodeURIComponent(id)}`, method: 'PATCH', body: { ...body, expectedVersion } });
        if (result.error) return result;
        const saved = record(payload(result.data));
        if (!Array.isArray(saved.changedFields) || Object.keys(body).some(key => !saved.changedFields.includes(key)) || saved.changedFields.some(key => !Object.hasOwn(body, key)) || timestamp(articleRecord(result.data).version) == null || articleRecord(result.data).version === expectedVersion) return failure('The saved fields and version could not be confirmed. Reload before trying again.');
        return confirmWrite(baseQuery, result.data, body, id);
      }, invalidatesTags: (_result, _error, { id }) => [{ type: 'AdminKnowledgeArticles', id: 'LIST' }, { type: 'AdminKnowledgeArticles', id: 'STATS' }, { type: 'AdminKnowledgeArticles', id }],
    }),
  }),
});
export const {
  useGetAdminKnowledgeStatsQuery, useUploadAdminKnowledgeAttachmentsMutation, useVoteAdminKnowledgeArticleMutation,
  useGetAdminKnowledgeArticleDirectoryQuery, useGetAdminKnowledgeArticleDetailQuery,
  useCreateAdminKnowledgeArticleMutation, useUpdateAdminKnowledgeArticleMutation,
} = knowledgeBaseApi;
