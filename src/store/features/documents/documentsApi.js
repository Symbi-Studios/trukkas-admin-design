import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const DOCUMENT_LABELS = {
  tdo: 'TDO',
  exit_note: 'Exit Note',
  customs_gate_pass: 'Customs Gate Pass',
  indemnity_letter: 'Indemnity Letter',
  confirmation_letter: 'Confirmation Letter',
};

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function statusLabel(value) {
  if (typeof value !== 'string' || !value.trim()) return '—';
  return value.toLowerCase().split(/[_\s-]+/).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function documentKey(value) {
  const normalized = String(value || '').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[\s-]+/g, '_');
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
    const pickup = value.pickup || value.origin || null;
    const delivery = value.delivery || value.destination || null;
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
  const documentTypes = Array.isArray(job.documents) ? job.documents.map(documentKey) : [];
  const jobType = job.jobType || job.requestType || null;
  return {
    id,
    displayId: job.jobNumber || id,
    company: job.forwarderName || null,
    jobType: /^(import|export)/i.test(jobType || '') ? statusLabel(jobType) : null,
    job: {
      id,
      statusCode: job.status || '',
      status: job.statusLabel || statusLabel(job.status),
      route: route.route,
      origin: route.origin,
    },
    documentTypes,
    summary: documentSummary(job.summary),
    submittedAt: job.submittedAt || null,
    updatedAt: job.updatedAt || null,
  };
}

function mapQueueResponse(response, args = {}) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.jobs)) throw new Error('The document queue response is missing its jobs list.');
  const rows = data.jobs.filter((job) => job && job.id != null).map(mapQueueJob);
  const pagination = data.pagination || {};
  const limit = numberOrNull(pagination.limit) ?? args.limit ?? 20;
  const total = numberOrNull(pagination.total) ?? rows.length;
  return {
    rows,
    pagination: {
      page: numberOrNull(pagination.page) ?? args.page ?? 1,
      limit,
      total,
      totalPages: numberOrNull(pagination.totalPages) ?? Math.max(1, Math.ceil(total / limit)),
    },
  };
}

function mapDocument(raw, key, job) {
  const source = raw && typeof raw === 'object' ? raw : { url: raw };
  const requirement = documentKey(source.type || source.documentType || source.requirement || key);
  const id = source.id == null && source.documentId == null ? null : String(source.id ?? source.documentId);
  const url = safeDocumentUrl(source.url || source.fileUrl || source.documentUrl);
  const code = source.status || source.reviewStatus || null;
  const fileName = source.fileName || (url ? new URL(url).pathname.split('/').pop() || null : null);
  return {
    id,
    rowKey: id || `${job.id}:${requirement}`,
    jobId: job.id,
    jobNumber: job.displayId,
    requirement,
    name: source.name || DOCUMENT_LABELS[requirement] || statusLabel(requirement),
    fileName,
    url,
    statusCode: code,
    status: source.statusLabel || (code ? statusLabel(code) : url ? 'Uploaded' : 'Not uploaded'),
    reviewAuthority: source.reviewAuthority || (job.jobType === 'Export' ? 'trucking_company' : id && code ? 'trukkas_admin' : null),
    fileType: source.fileType || (fileName?.toLowerCase().endsWith('.pdf') ? 'PDF' : null),
    fileSize: source.fileSize || null,
    version: source.version || null,
    uploadedBy: source.uploadedBy || null,
    uploadedByRole: source.uploadedByRole || null,
    uploadedAt: source.uploadedAt || null,
    updatedAt: source.updatedAt || null,
    reviewedBy: source.reviewedBy || null,
    reviewedAt: source.reviewedAt || null,
    rejectionReason: source.rejectionReason || null,
  };
}

function mapDetailResponse(response) {
  const data = unwrapApiResponseData(response);
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.id == null) {
    throw new Error('The document review detail response is missing its job ID.');
  }
  const job = mapQueueJob({ ...data, documents: [] });
  const urlFields = data.documents && !Array.isArray(data.documents) && typeof data.documents === 'object'
    ? data.documents : {};
  const urlsByKey = Object.fromEntries(Object.entries(urlFields).map(([key, value]) => [documentKey(key), value]));
  const rawList = Array.isArray(data.documentList) ? data.documentList
    : Array.isArray(data.documents) ? data.documents : null;
  const documents = rawList
    ? rawList.filter((item) => item && typeof item === 'object').map((item) => {
        const key = documentKey(item.type || item.documentType || item.requirement);
        const fallback = urlsByKey[key];
        return mapDocument({ ...item, url: item.url || item.fileUrl || (typeof fallback === 'string' ? fallback : fallback?.url) }, key, job);
      })
    : Object.entries(urlFields)
        .filter(([key, value]) => DOCUMENT_LABELS[documentKey(key)] || (value && typeof value === 'object' && (value.url || value.id)))
        .map(([key, value]) => mapDocument(value, key, job));
  const knownStatuses = documents.filter((document) => document.statusCode);
  const derivedSummary = knownStatuses.length === documents.length && documents.length > 0
    ? documents.reduce((summary, document) => {
        const status = String(document.statusCode).toUpperCase();
        if (status === 'APPROVED') summary.approved += 1;
        else if (status === 'REJECTED') summary.rejected += 1;
        else if (status === 'MISSING') summary.missing += 1;
        else summary.pending += 1;
        return summary;
      }, { total: documents.length, approved: 0, pending: 0, rejected: 0, missing: 0 })
    : null;
  return {
    ...job,
    documents,
    summary: documentSummary(data.summary || derivedSummary),
    container: data.container || null,
    containerNumber: data.containerNumber || null,
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
    awaitingJobs: numberOrNull(stats.awaiting),
    approvedJobsToday: numberOrNull(stats.approvedToday),
    rejectedJobsToday: numberOrNull(stats.rejectedToday),
    documentCounts: documentSummary(stats.documentCounts),
  };
}

const detailTag = (jobId) => ({ type: 'AdminDocReviewDetail', id: jobId });
const reviewTags = (jobId) => ['AdminDocReviewStats', 'AdminDocReviewQueue', detailTag(jobId)];
const reviewPath = (jobId) => `/admin/doc-review/queue/${encodeURIComponent(jobId)}`;
const documentPath = (jobId, documentId) => `${reviewPath(jobId)}/documents/${encodeURIComponent(documentId)}`;

export const documentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminDocReviewStats: builder.query({
      query: () => ({ url: '/admin/doc-review/stats' }),
      transformResponse: mapStatsResponse,
      providesTags: ['AdminDocReviewStats'],
    }),
    getAdminDocReviewQueue: builder.query({
      query: ({ status = 'all', search, page = 1, limit = 20 } = {}) => ({
        url: '/admin/doc-review/queue',
        params: { status, ...(search ? { search } : {}), page, limit },
      }),
      transformResponse: (response, _meta, args) => mapQueueResponse(response, args),
      providesTags: ['AdminDocReviewQueue'],
    }),
    getAdminDocReviewDetail: builder.query({
      query: (jobId) => ({ url: reviewPath(jobId) }),
      transformResponse: mapDetailResponse,
      providesTags: (_result, _error, jobId) => [detailTag(jobId)],
    }),
    approveAdminJobDocuments: builder.mutation({
      query: (jobId) => ({ url: `${reviewPath(jobId)}/approve`, method: 'POST' }),
      invalidatesTags: (_result, _error, jobId) => reviewTags(jobId),
    }),
    rejectAdminJobDocuments: builder.mutation({
      query: ({ jobId, reason }) => ({ url: `${reviewPath(jobId)}/reject`, method: 'POST', body: { reason } }),
      invalidatesTags: (_result, _error, { jobId }) => reviewTags(jobId),
    }),
    approveAdminDocument: builder.mutation({
      query: ({ jobId, documentId }) => ({ url: `${documentPath(jobId, documentId)}/approve`, method: 'POST' }),
      invalidatesTags: (_result, _error, { jobId }) => reviewTags(jobId),
    }),
    rejectAdminDocument: builder.mutation({
      query: ({ jobId, documentId, reason }) => ({ url: `${documentPath(jobId, documentId)}/reject`, method: 'POST', body: { reason } }),
      invalidatesTags: (_result, _error, { jobId }) => reviewTags(jobId),
    }),
  }),
});

export const {
  useGetAdminDocReviewStatsQuery,
  useGetAdminDocReviewQueueQuery,
  useGetAdminDocReviewDetailQuery,
  useApproveAdminJobDocumentsMutation,
  useRejectAdminJobDocumentsMutation,
  useApproveAdminDocumentMutation,
  useRejectAdminDocumentMutation,
} = documentsApi;
