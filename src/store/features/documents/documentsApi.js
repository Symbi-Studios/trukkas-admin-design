import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const DOCUMENT_LABELS = {
  tdo: 'TDO',
  exit_note: 'Exit Note',
  customs_gate_pass: 'Customs Gate Pass',
  indemnity_letter: 'Indemnity Letter',
  confirmation_letter: 'Confirmation Letter',
};

function numberOrNull(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

const failure = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
export function documentTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return '—';
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59 || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function textOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function documentFileSize(value) {
  // The detail contract returns a formatted size; legacy uploads may be null.
  const size = textOrNull(value);
  const match = size?.match(/^(\d+(?:\.\d+)?)\s*(?:B|bytes?|[KMGTPE]B|[KMGTPE]iB)$/i);
  return match && Number.isFinite(Number(match[1])) ? size : null;
}

function personName(value) {
  return textOrNull(value) || textOrNull(value?.name);
}

function statusLabel(value) {
  if (typeof value !== 'string' || !value.trim()) return '—';
  return value.toLowerCase().split(/[_\s-]+/).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function documentKey(value) {
  const normalized = (textOrNull(value) || '').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'exitnote') return 'exit_note';
  if (normalized === 'gate_pass' || normalized === 'gatepass') return 'customs_gate_pass';
  return normalized;
}

function safeDocumentUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function routeParts(value) {
  if (typeof value === 'string') {
    const [pickup, delivery] = value.split(/\s*(?:→|->)\s*/, 2);
    return { route: value, origin: delivery ? pickup : null };
  }
  if (value && typeof value === 'object') {
    const pickup = textOrNull(value.pickup) || textOrNull(value.origin);
    const delivery = textOrNull(value.delivery) || textOrNull(value.destination);
    return { route: [pickup, delivery].filter(Boolean).join(' → ') || null, origin: pickup };
  }
  return { route: null, origin: null };
}

function documentSummary(value) {
  const summary = value && typeof value === 'object' ? value : {};
  return {
    total: numberOrNull(summary.total ?? summary.totalDocuments),
    approved: numberOrNull(summary.approved ?? summary.approvedDocuments),
    pending: numberOrNull(summary.pending ?? summary.pendingReview),
    rejected: numberOrNull(summary.rejected ?? summary.rejectedDocuments),
    missing: numberOrNull(summary.missing ?? summary.missingDocuments),
  };
}

function mapQueueJob(job) {
  const id = String(job.id);
  const route = routeParts(job.route);
  const documentTypes = Array.isArray(job.documents) ? job.documents.map(documentKey).filter(Boolean) : [];
  const jobType = textOrNull(job.jobType?.label) || textOrNull(job.jobType) || textOrNull(job.requestType);
  const jobKind = /^(import|export)\b/i.test(jobType || '') ? statusLabel(jobType.split(/[\s(]/)[0]) : null;
  return {
    id,
    displayId: textOrNull(job.jobNumber) || id,
    company: textOrNull(job.company?.name) || textOrNull(job.forwarderName),
    companyId: textOrNull(job.company?.id),
    jobType: jobKind || jobType, jobKind,
    job: {
      id,
      statusCode: textOrNull(job.status) || '',
      status: textOrNull(job.statusLabel) || statusLabel(job.status),
      lifecycleStatusCode: textOrNull(job.jobStatus),
      route: route.route,
      origin: textOrNull(job.origin) || textOrNull(job.originPort) || route.origin,
    },
    documentTypes,
    summary: documentSummary(job.documentSummary ?? job.documentCounts ?? job.summary),
    submittedAt: job.submittedAt || null,
    updatedAt: job.updatedAt || null,
  };
}

function mapQueueResponse(response, args = {}) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.jobs)) throw new Error('The document queue response is missing its jobs list.');
  const ids = data.jobs.map((job) => textOrNull(job?.id));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('The document queue returned missing or duplicate job IDs.');
  const rows = data.jobs.map(mapQueueJob);
  const pagination = data.pagination || {};
  const limit = numberOrNull(pagination.limit), total = numberOrNull(pagination.total), page = numberOrNull(pagination.page), pages = numberOrNull(pagination.totalPages);
  if (!limit || total == null || page !== (args.page ?? 1) || pages == null || rows.length > limit || rows.length > total || pages !== Math.ceil(total / limit) && !(total === 0 && pages === 1)
    || page > Math.max(1, pages) || (total > 0 && !rows.length)) throw new Error('The document queue returned invalid or incomplete pagination.');
  return {
    rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, pages),
    },
  };
}

function mapDocument(raw, key, job) {
  const source = raw && typeof raw === 'object' ? raw : { url: raw };
  const requirement = documentKey(source.type || source.documentType || source.requirement || key);
  const id = textOrNull(source.id) || textOrNull(source.documentId);
  const url = safeDocumentUrl(source.url || source.fileUrl || source.documentUrl);
  const code = textOrNull(source.status) || textOrNull(source.reviewStatus);
  const fileName = textOrNull(source.fileName);
  const uploaderType = textOrNull(source.uploadedBy?.type);
  return {
    id,
    rowKey: id || `${job.id}:${requirement}`,
    jobId: job.id,
    jobNumber: job.displayId,
    requirement,
    name: textOrNull(source.label) || textOrNull(source.name) || DOCUMENT_LABELS[requirement] || statusLabel(requirement),
    fileName,
    url,
    statusCode: code,
    status: textOrNull(source.statusLabel) || statusLabel(code),
    // The spec explicitly assigns TDO / Exit Note / Customs Gate Pass review
    // to admins. Neither a URL nor an Import/Export label establishes authority.
    reviewAuthority: ['tdo', 'exit_note', 'customs_gate_pass'].includes(requirement) ? 'trukkas_admin' : null,
    canReview: job.job.lifecycleStatusCode === 'DOC_REVIEW' && ['tdo', 'exit_note', 'customs_gate_pass'].includes(requirement) && ['PENDING', 'REJECTED'].includes(code) && Boolean(id),
    fileType: ({ 'application/pdf': 'PDF', 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' })[source.mimeType] || textOrNull(source.mimeType) || textOrNull(source.fileType),
    fileSize: documentFileSize(source.fileSize),
    version: numberOrNull(source.version),
    uploadedBy: personName(source.uploadedBy),
    uploadedByRole: textOrNull(source.uploadedByRole) || (uploaderType ? statusLabel(uploaderType) : null),
    uploadedAt: source.uploadedAt || null,
    updatedAt: source.updatedAt || null,
    reviewedBy: personName(source.reviewedBy),
    reviewedAt: source.reviewedAt || null,
    rejectionReason: source.rejectionReason || null,
  };
}

function mapDetailResponse(response) {
  const data = unwrapApiResponseData(response);
  if (!data || typeof data !== 'object' || Array.isArray(data) || !textOrNull(data.id)) {
    throw new Error('The document review detail response is missing its job ID.');
  }
  const job = mapQueueJob({ ...data, documents: [] });
  const urlFields = data.documents && !Array.isArray(data.documents) && typeof data.documents === 'object'
    ? data.documents : {};
  const urlsByKey = Object.fromEntries(Object.entries(urlFields).map(([key, value]) => [documentKey(key), value]));
  const rawList = Array.isArray(data.documentList) ? data.documentList
    : Array.isArray(data.documents) ? data.documents : null;
  if (rawList?.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error('The document review response contains unreadable document records.');
  const documents = rawList
    ? rawList.filter((item) => item && typeof item === 'object').map((item) => {
        const key = documentKey(item.type || item.documentType || item.requirement);
        const fallback = urlsByKey[key];
        return mapDocument({ ...item, url: item.url || item.fileUrl || (typeof fallback === 'string' ? fallback : fallback?.url) }, key, job);
      })
    : Object.entries(urlFields)
        .filter(([key, value]) => (DOCUMENT_LABELS[documentKey(key)] && safeDocumentUrl(value)) || (value && typeof value === 'object' && (value.url || value.id || value.status)))
        .map(([key, value]) => mapDocument(value, key, job));
  if (new Set(documents.map((document) => document.rowKey)).size !== documents.length) throw new Error('The document review response repeated a document.');
  return {
    ...job,
    documents,
    summary: documentSummary(data.documentSummary ?? data.documentCounts ?? data.summary),
    canReviewJob: job.job.lifecycleStatusCode === 'DOC_REVIEW',
    container: textOrNull(data.container),
    containerNumber: textOrNull(data.containerNumber),
    tdoDate: data.tdoDate || null,
  };
}

function mapStatsResponse(response) {
  const data = unwrapApiResponseData(response);
  const stats = data?.stats && typeof data.stats === 'object' ? data.stats : data;
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    throw new Error('The document review stats response is invalid.');
  }
  return {
    awaitingJobs: numberOrNull(stats.jobs?.awaiting),
    approvedJobsToday: numberOrNull(stats.jobs?.approvedToday),
    rejectedJobsToday: numberOrNull(stats.jobs?.rejectedToday),
    documentCounts: documentSummary(stats.documents ?? stats.documentCounts),
  };
}

async function readMapped(baseQuery, request, map) {
  const result = await baseQuery(request);
  if (result.error) return result;
  try { return { data: map(result.data) }; } catch (error) { return failure(error.message); }
}
async function readQueueDirectory(baseQuery, params = {}) {
  const rows = [], seen = new Set();
  let page = 1, total = null, totalPages = 1;
  do {
    const result = await readMapped(baseQuery, { url: '/admin/doc-review/queue', params: { ...params, page, limit: 100 } }, (response) => mapQueueResponse(response, { page }));
    if (result.error) return result;
    const data = result.data;
    if (total != null && (total !== data.pagination.total || totalPages !== data.pagination.totalPages)) return failure('The document queue changed while loading. Refresh before filtering.');
    total = data.pagination.total; totalPages = data.pagination.totalPages;
    for (const row of data.rows) {
      if (seen.has(row.id)) return failure('The document queue repeated a job across pages.');
      seen.add(row.id); rows.push(row);
    }
    page += 1;
  } while (page <= totalPages);
  return rows.length === total ? { data: rows } : failure('The document queue did not return its complete collection.');
}

const detailTag = (jobId) => ({ type: 'AdminDocReviewDetail', id: jobId });
const reviewTags = (jobId) => ['AdminDocReviewStats', 'AdminDocReviewQueue', detailTag(jobId)];
const reviewPath = (jobId) => `/admin/doc-review/queue/${encodeURIComponent(jobId)}`;
const documentPath = (jobId, documentId) => `${reviewPath(jobId)}/documents/${encodeURIComponent(documentId)}`;
async function reviewMutation(baseQuery, { jobId, documentId, reason, approve }) {
  if (!textOrNull(jobId) || (documentId !== undefined && !textOrNull(documentId))) return failure('The review needs valid job and document IDs.');
  if (!approve && !textOrNull(reason)) return failure('Enter a reason for the forwarder.');
  const result = await baseQuery({ url: `${documentId === undefined ? reviewPath(jobId) : documentPath(jobId, documentId)}/${approve ? 'approve' : 'reject'}`, method: 'POST', ...(!approve ? { body: { reason: reason.trim() } } : {}) });
  if (result.error) return result;
  const dto = unwrapApiResponseData(result.data);
  const confirmed = documentId === undefined
    ? dto?.job?.id === jobId && dto.job.status === (approve ? 'DOCUMENTS_VALIDATED' : 'DRAFT')
    : dto?.document?.id === documentId && dto.document.status === (approve ? 'APPROVED' : 'REJECTED') && (!dto.job || dto.job.id === jobId);
  return confirmed ? { data: dto } : failure('The review was sent, but its result could not be confirmed. Refresh before trying again.');
}

export const documentsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminDocReviewStats: builder.query({
      queryFn: (_arg, _api, _options, baseQuery) => readMapped(baseQuery, { url: '/admin/doc-review/stats' }, mapStatsResponse),
      providesTags: ['AdminDocReviewStats'],
    }),
    getAdminDocReviewQueue: builder.query({
      async queryFn({ status = 'all', search, documentType, companyId, missing, attentionOnly = false, page = 1, limit = 20 } = {}, _api, _options, baseQuery) {
        const params = { status, ...(search ? { search } : {}), ...(documentType ? { documentType: documentType.toUpperCase() } : {}), ...(companyId ? { companyId } : {}), ...(missing === true ? { missing: true } : {}) };
        // The existing By Status default combines awaiting + rejected jobs.
        // Preserve that union using the complete server-filtered collection.
        if (attentionOnly) {
          const result = await readQueueDirectory(baseQuery, params);
          if (result.error) return result;
          const rows = result.data.filter((row) => ['awaiting', 'rejected'].includes(row.job.statusCode));
          return { data: { rows: rows.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) } } };
        }
        return readMapped(baseQuery, { url: '/admin/doc-review/queue', params: { ...params, page, limit } }, (response) => {
          const data = mapQueueResponse(response, { page });
          if (data.pagination.limit !== limit) throw new Error('The document queue returned a different page size.');
          return data;
        });
      },
      providesTags: ['AdminDocReviewQueue'],
    }),
    getAdminDocReviewDetail: builder.query({
      queryFn: (jobId, _api, _options, baseQuery) => readMapped(baseQuery, { url: reviewPath(jobId) }, (response) => {
        const data = mapDetailResponse(response);
        if (data.id !== jobId) throw new Error('The document detail response does not match this job.');
        return data;
      }),
      providesTags: (_result, _error, jobId) => [detailTag(jobId)],
    }),
    getAdminDocReviewFilterOptions: builder.query({
      async queryFn(_arg, _api, _options, baseQuery) {
        const result = await readQueueDirectory(baseQuery, { status: 'all' });
        if (result.error) return result;
        const companies = new Map();
        for (const row of result.data) if (row.companyId && row.company) companies.set(row.companyId, { id: row.companyId, name: row.company });
        return { data: { companies: [...companies.values()], types: [...new Set(result.data.flatMap((row) => row.documentTypes))] } };
      }, providesTags: ['AdminDocReviewQueue'],
    }),
    approveAdminJobDocuments: builder.mutation({
      queryFn: (jobId, _api, _options, baseQuery) => reviewMutation(baseQuery, { jobId, approve: true }),
      invalidatesTags: (_result, _error, jobId) => reviewTags(jobId),
    }),
    rejectAdminJobDocuments: builder.mutation({
      queryFn: ({ jobId, reason }, _api, _options, baseQuery) => reviewMutation(baseQuery, { jobId, reason, approve: false }),
      invalidatesTags: (_result, _error, { jobId }) => reviewTags(jobId),
    }),
    approveAdminDocument: builder.mutation({
      queryFn: ({ jobId, documentId }, _api, _options, baseQuery) => reviewMutation(baseQuery, { jobId, documentId, approve: true }),
      invalidatesTags: (_result, _error, { jobId }) => reviewTags(jobId),
    }),
    rejectAdminDocument: builder.mutation({
      queryFn: ({ jobId, documentId, reason }, _api, _options, baseQuery) => reviewMutation(baseQuery, { jobId, documentId, reason, approve: false }),
      invalidatesTags: (_result, _error, { jobId }) => reviewTags(jobId),
    }),
  }),
});

export const {
  useGetAdminDocReviewStatsQuery,
  useGetAdminDocReviewQueueQuery,
  useGetAdminDocReviewDetailQuery,
  useGetAdminDocReviewFilterOptionsQuery,
  useApproveAdminJobDocumentsMutation,
  useRejectAdminJobDocumentsMutation,
  useApproveAdminDocumentMutation,
  useRejectAdminDocumentMutation,
} = documentsApi;
