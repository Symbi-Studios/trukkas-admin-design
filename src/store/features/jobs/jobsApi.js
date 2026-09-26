import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

function formatStatus(value) {
  if (typeof value !== 'string' || !value.trim()) return '—';
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapJob(job) {
  const id = String(job.id);
  return {
    ...job,
    id,
    displayId: job.jobNumber || id,
    statusCode: job.status || '',
    status: job.statusLabel || formatStatus(job.status),
    forwarder: job.forwarderName || '',
    truckingCompany: job.truckerName || '',
    truckCompany: job.truckerName || '',
    route: job.route || '',
    deadline: job.deadline || null,
    displayDeadline: formatDate(job.deadline),
    freeDays: typeof job.freeDays === 'number' && Number.isFinite(job.freeDays)
      ? job.freeDays
      : null,
    // Assignment counts and trip data are not in this list response.
    assignmentDataAvailable: false,
    detailAvailable: true,
    actionsAvailable: false,
  };
}

function mapResponse(response, args = {}) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.jobs)) {
    throw new Error('The jobs response is missing its job list.');
  }

  const pagination = data.pagination || {};
  const rows = data.jobs
    .filter((job) => job && job.id != null)
    .map(mapJob);
  const limit = numberOr(pagination.limit, args.limit || rows.length || 20);
  const total = numberOr(pagination.total, rows.length);

  return {
    rows,
    pagination: {
      page: numberOr(pagination.page, args.page || 1),
      limit,
      total,
      totalPages: numberOr(
        pagination.totalPages,
        limit > 0 ? Math.ceil(total / limit) : 1,
      ),
    },
  };
}

function mapJobDetail(response) {
  const job = unwrapApiResponseData(response);
  if (!job || typeof job !== 'object' || Array.isArray(job) || job.id == null) {
    throw new Error('The job detail response is missing its job ID.');
  }

  const rawContainers = job.containers ?? job.container;
  const containers = (Array.isArray(rawContainers)
    ? rawContainers
    : rawContainers == null ? [] : [rawContainers])
    .filter((container) => container && typeof container === 'object' && !Array.isArray(container));

  const documents = job.documents && typeof job.documents === 'object'
    ? ['tdo', 'exitNote', 'gatePass'].map((key) => ({
        key,
        label: job.documents[key]?.label || ({ tdo: 'TDO', exitNote: 'Exit Note', gatePass: 'Gate Pass' })[key],
        url: job.documents[key]?.url || null,
      }))
    : [];

  return {
    id: String(job.id),
    displayId: job.jobNumber || String(job.id),
    status: job.statusLabel || formatStatus(job.status),
    statusCode: job.status || '',
    pickup: job.pickup || null,
    delivery: job.delivery || null,
    containerReturnAddress: job.containerReturnAddress || null,
    containers,
    tdoDate: job.tdoDate || null,
    freeDays: numberOr(job.freeDays, null),
    forwarder: job.forwarder || null,
    trucker: job.trucker || null,
    driver: job.driver || null,
    vehicle: job.vehicle || null,
    pricing: job.pricing || null,
    documents,
    documentApprovalStatus: job.documents?.approvalStatus || null,
    timeline: Array.isArray(job.timeline) ? job.timeline.map((event) => ({
      title: event.event || 'Update',
      timestamp: event.timestamp || null,
      completed: event.completed === true,
    })) : [],
  };
}

function mapBidsResponse(response, args = {}) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.bids)) {
    throw new Error('The bids response is missing its bid list.');
  }

  const pagination = data.pagination || {};
  const rows = data.bids.filter((bid) => bid && bid.id != null).map((bid) => ({
    id: String(bid.id),
    jobId: bid.jobId == null ? null : String(bid.jobId),
    jobNumber: bid.jobNumber || null,
    route: bid.route || null,
    truckerName: bid.truckerName || '—',
    truckerRating: nullableNumber(bid.truckerRating),
    truckerTrips: nullableNumber(bid.truckerTrips),
    amount: nullableNumber(bid.amount),
    isCounterOffer: bid.isCounterOffer === true,
    statusCode: typeof bid.status === 'string' ? bid.status : '',
    status: typeof bid.status === 'string' ? formatStatus(bid.status) : '—',
    createdAt: bid.createdAt || null,
    expiresAt: bid.expiresAt || null,
    respondedAt: bid.respondedAt || null,
  }));
  const limit = numberOr(pagination.limit, args.limit || rows.length || 20);
  const total = numberOr(pagination.total, rows.length);

  return {
    rows,
    pagination: {
      page: numberOr(pagination.page, args.page || 1),
      limit,
      total,
      totalPages: numberOr(pagination.totalPages, limit > 0 ? Math.ceil(total / limit) : 1),
    },
  };
}

export const jobsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminJobs: builder.query({
      query: ({ page = 1, limit = 20 } = {}) => ({
        url: '/admin/jobs',
        params: { page, limit },
      }),
      transformResponse: (response, _meta, args) => mapResponse(response, args),
      providesTags: ['AdminJobs'],
    }),
    getAdminJobDetail: builder.query({
      query: (id) => ({ url: `/admin/jobs/${encodeURIComponent(id)}` }),
      transformResponse: mapJobDetail,
      providesTags: (_result, _error, id) => [{ type: 'AdminJobs', id }],
    }),
    getAdminBids: builder.query({
      query: ({ jobId, page = 1, limit = 20 }) => ({
        url: '/admin/bids',
        params: { jobId, page, limit },
      }),
      transformResponse: (response, _meta, args) => mapBidsResponse(response, args),
      providesTags: (_result, _error, { jobId }) => [{ type: 'AdminBids', id: jobId }],
    }),
  }),
});

export const { useGetAdminJobsQuery, useGetAdminJobDetailQuery, useGetAdminBidsQuery } = jobsApi;
