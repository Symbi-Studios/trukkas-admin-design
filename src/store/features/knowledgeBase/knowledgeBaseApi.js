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
const articleRecord = (response) => { const dto = record(payload(response)); return record(dto.article || dto); };
export const emptyKnowledgeArticle = {
  id: '—', title: '—', summary: '—', content: '—', category: '—', subcategory: '—', author: '—', authorRole: '—',
  status: '—', statusCode: null, views: null, helpful: null, updated: '—', time: '—', published: '—', publishedTime: '—',
  visibility: '—', featured: null, feedback: null, related: null, seoTitle: null, metaDescription: null, tags: null, attachments: null,
  relatedArticles: null, core: { title: null, body: null, category: null, status: null },
};
function adaptArticle(dto, includeRelated = true) {
  const author = record(dto.author), code = text(dto.status)?.toUpperCase();
  const body = typeof dto.body === 'string' && dto.body.trim() ? dto.body : null;
  return {
    ...emptyKnowledgeArticle, id: dto.id, title: text(dto.title) || '—', summary: text(dto.summary) || '—', content: body || '—',
    category: text(dto.category) || '—', subcategory: text(dto.subcategory) || '—',
    author: text(author.name) || text(dto.authorName) || text(dto.author) || '—', authorRole: text(author.role) || '—',
    status: STATUS_LABELS[code] || '—', statusCode: STATUS_LABELS[code] ? code : null,
    views: count(dto.views), helpful: percent(dto.helpful), updated: date(dto.updatedAt), time: date(dto.updatedAt, true),
    published: date(dto.publishedAt), publishedTime: date(dto.publishedAt, true),
    visibility: ['Public', 'Internal'].includes(dto.visibility) ? dto.visibility : ({ PUBLIC: 'Public', INTERNAL: 'Internal' }[dto.visibility] || '—'),
    featured: boolean(dto.featured), feedback: boolean(dto.feedback), related: boolean(dto.related),
    seoTitle: text(dto.seoTitle), metaDescription: text(dto.metaDescription),
    tags: Array.isArray(dto.tags) && dto.tags.every((tag) => text(tag)) ? dto.tags : null,
    attachments: Array.isArray(dto.attachments) ? dto.attachments.map((file) => ({ name: text(file?.name) || '—' })) : null,
    relatedArticles: includeRelated && Array.isArray(dto.relatedArticles) && dto.relatedArticles.every((article) => text(article?.id)) ? dto.relatedArticles.map((article) => adaptArticle(article, false)) : null,
    core: { title: text(dto.title), body, category: text(dto.category), status: STATUS_LABELS[code] ? code : null },
  };
}
export function knowledgeSummary(rows) {
  const known = Array.isArray(rows), statusesKnown = known && rows.every((article) => article.statusCode);
  const categoriesKnown = known && rows.every((article) => article.category !== '—');
  return {
    total: knowledgeCount(rows?.length),
    published: knowledgeCount(statusesKnown ? rows.filter((article) => article.statusCode === 'PUBLISHED').length : null),
    draft: knowledgeCount(statusesKnown ? rows.filter((article) => article.statusCode === 'DRAFT').length : null),
    // Lifetime views or individual percentages cannot establish monthly aggregates.
    monthlyViews: '—', helpful: '—',
    categories: KNOWLEDGE_CATEGORIES.map((name) => [name, knowledgeCount(categoriesKnown ? rows.filter((article) => article.category === name).length : null)]),
    popular: known && rows.every((article) => article.views != null) ? [...rows].sort((a, b) => b.views - a.views).slice(0, 5) : null,
  };
}
export const knowledgeDetailUrl = (id) => `/knowledge-base/detail?articleId=${encodeURIComponent(id)}`;
export const knowledgeEditUrl = (id) => `/knowledge-base/edit?articleId=${encodeURIComponent(id)}`;
export function knowledgeEditorValues(article) {
  return {
    title: article.core.title, category: article.core.category, content: article.core.body, status: article.statusCode ? article.status : null,
    summary: article.summary === '—' ? null : article.summary, subcategory: article.subcategory === '—' ? null : article.subcategory,
    visibility: article.visibility === '—' ? null : article.visibility, featured: article.featured, feedback: article.feedback, related: article.related,
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
  if (!keys.length || keys.some((key) => !['title', 'body', 'category', 'status'].includes(key))) throw new Error('Only documented article fields can be saved.');
  for (const key of keys) {
    if (key === 'status') {
      if (!Object.values(ARTICLE_STATUS_CODES).includes(source[key])) throw new Error('Choose a supported article status.');
      body.status = source[key];
    } else {
      if (!text(source[key]) || source[key].trim() === '—') throw new Error('Complete all required fields');
      body[key] = key === 'body' ? source[key] : source[key].trim();
    }
  }
  if (creating && ['title', 'body', 'category'].some((key) => !body[key])) throw new Error('Complete all required fields');
  return body;
}
async function confirmWrite(baseQuery, response, expected, existingId) {
  const dto = articleRecord(response), id = existingId || text(dto.id);
  if (!id) return failure('The save returned no article ID. Refresh the directory before trying again.');
  let article = text(dto.id) === id ? adaptArticle(dto) : null;
  const matches = (value) => value && Object.entries(expected).every(([key, content]) => value.core[key] === content);
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
    getAdminKnowledgeArticleDirectory: builder.query({
      async queryFn({ search, category, status } = {}, _api, _options, baseQuery) {
        if (status && !Object.values(ARTICLE_STATUS_CODES).includes(status)) return failure('Choose a supported article status.');
        const rows = [], seen = new Set(); let page = 1, totalPages = 1, total = null;
        do {
          const result = await baseQuery({ url: '/admin/knowledge-base/articles', params: { page, limit: 100, ...(text(search) ? { search: search.trim() } : {}), ...(text(category) ? { category: category.trim() } : {}), ...(status ? { status } : {}) } });
          if (result.error) return result;
          const dto = record(payload(result.data)), pagination = record(dto.pagination || dto);
          // Successful response envelopes are not specified in Swagger. Require actual records and pagination, never fixture fallbacks.
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
      }, invalidatesTags: [{ type: 'AdminKnowledgeArticles', id: 'LIST' }],
    }),
    updateAdminKnowledgeArticle: builder.mutation({
      async queryFn({ id, changes }, _api, _options, baseQuery) {
        if (!text(id)) return failure('An article ID is required.');
        let body; try { body = writeBody(changes, false); } catch (error) { return failure(error.message); }
        const result = await baseQuery({ url: `/admin/knowledge-base/articles/${encodeURIComponent(id)}`, method: 'PATCH', body });
        return result.error ? result : confirmWrite(baseQuery, result.data, body, id);
      }, invalidatesTags: (_result, _error, { id }) => [{ type: 'AdminKnowledgeArticles', id: 'LIST' }, { type: 'AdminKnowledgeArticles', id }],
    }),
  }),
});
export const {
  useGetAdminKnowledgeArticleDirectoryQuery, useGetAdminKnowledgeArticleDetailQuery,
  useCreateAdminKnowledgeArticleMutation, useUpdateAdminKnowledgeArticleMutation,
} = knowledgeBaseApi;
