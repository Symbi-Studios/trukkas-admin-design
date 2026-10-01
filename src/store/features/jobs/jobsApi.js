import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const DELIVERABLE_STATUSES = new Set([
  'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'PICKUP_COMPLETED', 'IN_TRANSIT', 'CONTAINER_RETURNED',
]);

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
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cargoText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    return value.map(cargoText).filter(Boolean).join(', ');
  }
  if (!value || typeof value !== 'object') return '';

  const label = cargoText(value.label);
  const summary = cargoText(value.containerSummary);
  const description = cargoText(value.description);
  const types = cargoText(value.containerTypes);
  const count = numberOr(value.containerCount, null);
  const primary = label && summary && label.includes(summary) ? label
    : [...new Set([label, summary].filter(Boolean))].join(' · ');

  if (primary) return primary;
  if (count != null) {
    const countLabel = `${count} container${count === 1 ? '' : 's'}`;
    return types ? `${countLabel} · ${types}` : countLabel;
  }
  return description || types;
}

function mapJob(job) {
  const id = String(job.id);
  const company = record(job.company);
  const requester = record(job.requester);
  const tripType = record(job.tripType);
  const assignment = record(job.assignment);
  const assignee = record(assignment.assignee);
  const cargo = record(job.cargo);
  const statusCode = job.status || '';
  const displayCargo = cargoText(cargo)
    || cargoText(job.cargoDetails)
    || cargoText(job.cargo)
    || cargoText(job.cargoType)
    || '—';
  const truckerName = assignee.name || job.truckerName || '';
  const value = numberOr(job.value, numberOr(job.jobValue, numberOr(job.amount, null)));

  return {
    ...job,
    id,
    displayId: job.jobNumber || id,
    statusCode,
    stage: job.stage || '',
    status: job.stageLabel || job.statusLabel || formatStatus(statusCode),
    deliveryHealth: job.statusLabel || null,
    forwarder: company.name || job.forwarderName || '',
    originCountry: company.location || null,
    contactPerson: requester.name || null,
    contactEmail: requester.email || null,
    contactPhone: requester.phone || null,
    contactAvatarUrl: requester.avatarUrl || null,
    requestType: tripType.label || (typeof job.tripType === 'string' ? job.tripType : null),
    tripTypeCode: tripType.code || null,
    origin: job.origin || job.pickup?.address || null,
    destination: job.destination || job.delivery?.address || null,
    truckingCompany: truckerName,
    truckCompany: truckerName,
    route: job.route || [job.origin, job.destination].filter(Boolean).join(' → '),
    displayCargo,
    cargo: displayCargo,
    cargoType: Array.isArray(cargo.containerTypes) ? cargo.containerTypes.join(', ') : cargoText(job.cargoType),
    cargoContainerTypes: Array.isArray(cargo.containerTypes) ? cargo.containerTypes : [],
    jobValue: value,
    amount: value,
    deadline: job.estimatedDeliveryAt || job.deadline || null,
    displayDeadline: formatDate(job.estimatedDeliveryAt || job.deadline),
    displayCreated: formatDate(job.createdAt),
    deliveryDate: job.deliveredAt || null,
    freeDays: typeof job.freeDays === 'number' && Number.isFinite(job.freeDays)
      ? job.freeDays
      : null,
    assignmentDataAvailable: job.assignment != null,
    assignedTrips: numberOr(assignment.assignedTrips, null),
    totalTrips: numberOr(assignment.totalTrips, null),
    timeline: Array.isArray(job.timeline) ? job.timeline.map((event) => ({
      title: event.label || event.event || 'Update',
      timestamp: event.at || event.timestamp || null,
      completed: event.completed === true,
    })) : [],
    canValidateDocs: statusCode === 'DOC_REVIEW',
    canRejectDocs: statusCode === 'DOC_REVIEW',
    canMarkDelivered: DELIVERABLE_STATUSES.has(statusCode),
    canCancel: !['COMPLETED', 'CANCELLED'].includes(statusCode),
    detailAvailable: true,
    actionsAvailable: true,
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
    canValidateDocs: job.status === 'DOC_REVIEW',
    canRejectDocs: job.status === 'DOC_REVIEW',
    canMarkDelivered: DELIVERABLE_STATUSES.has(job.status),
    canCancel: !['COMPLETED', 'CANCELLED'].includes(job.status),
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
    activityLog: Array.isArray(job.activityLog) ? job.activityLog.map((event, index) => ({
      id: event.id || `${event.at || 'activity'}-${index}`,
      at: event.at || null,
      category: event.category || 'ACTIVITY',
      action: event.action || null,
      description: event.description || event.action || 'Activity recorded',
      actor: record(event.actor),
    })) : [],
  };
}

function mapJobStats(response) {
  const data = unwrapApiResponseData(response);
  if (!data?.cards || !data?.tabs) throw new Error('The jobs stats response is missing cards or tabs.');
  const cards = record(data.cards);
  const tabs = record(data.tabs);
  return {
    period: record(data.period),
    cards: Object.fromEntries(['totalJobs', 'pendingApproval', 'inTransit', 'delivered', 'cancelled'].map((key) => [key, {
      value: numberOr(cards[key]?.value, null),
      changePercent: numberOr(cards[key]?.changePercent, null),
      trend: cards[key]?.trend || null,
    }])),
    tabs: Object.fromEntries(['all', 'pendingApproval', 'bidding', 'assigned', 'inTransit', 'delivered', 'cancelled', 'flagged', 'rejected']
      .map((key) => [key, numberOr(tabs[key], null)])),
  };
}

function mapContainerTypes(response) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.containerTypes)) throw new Error('The container types response is missing its list.');
  return data.containerTypes.filter((item) => item?.id && item.isActive !== false).map((item) => ({
    id: String(item.id), name: item.name || item.code || String(item.id), code: item.code || null,
  }));
}

function mapCsv(response) {
  if (typeof response !== 'string') throw new Error('The jobs export response is not CSV text.');
  return response;
}

function jobFilters({ statusFilter, search, tripType, containerTypeId, origin, destination, truckerType, dateFrom, dateTo } = {}) {
  return Object.fromEntries(Object.entries({ statusFilter, search, tripType, containerTypeId, origin, destination, truckerType, dateFrom, dateTo })
    .filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

export const jobsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminJobs: builder.query({
      query: ({ page = 1, limit = 20, ...filters } = {}) => ({
        url: '/admin/jobs',
        params: { ...jobFilters(filters), page, limit },
      }),
      transformResponse: (response, _meta, args) => mapResponse(response, args),
      providesTags: ['AdminJobs'],
    }),
    getAdminJobStats: builder.query({
      query: ({ dateFrom, dateTo } = {}) => ({
        url: '/admin/jobs/stats',
        params: jobFilters({ dateFrom, dateTo }),
      }),
      transformResponse: mapJobStats,
      providesTags: ['AdminJobs'],
    }),
    getAdminJobsPendingDocs: builder.query({
      query: ({ search, page = 1, limit = 20 } = {}) => ({
        url: '/admin/jobs/pending-docs', params: { ...jobFilters({ search }), page, limit },
      }),
      transformResponse: (response, _meta, args) => mapResponse(response, args),
      providesTags: ['AdminJobs'],
    }),
    getAdminJobContainerTypes: builder.query({
      query: () => ({ url: '/admin/reference/container-types' }),
      transformResponse: mapContainerTypes,
    }),
    exportAdminJobs: builder.query({
      query: (filters = {}) => ({
        url: '/admin/jobs/export', params: jobFilters(filters), responseHandler: 'text',
        headers: { Accept: 'text/csv' },
      }),
      transformResponse: mapCsv,
    }),
    exportAdminJobSheet: builder.query({
      query: (id) => ({
        url: `/admin/jobs/${encodeURIComponent(id)}/export`, responseHandler: 'text',
        headers: { Accept: 'text/csv' },
      }),
      transformResponse: mapCsv,
    }),
    getAdminJobDetail: builder.query({
      query: (id) => ({ url: `/admin/jobs/${encodeURIComponent(id)}` }),
      transformResponse: mapJobDetail,
      providesTags: (_result, _error, id) => [{ type: 'AdminJobs', id }],
    }),
    markAdminJobDelivered: builder.mutation({
      query: ({ id, note }) => ({
        url: `/admin/jobs/${encodeURIComponent(id)}/mark-delivered`, method: 'POST',
        body: note?.trim() ? { note: note.trim() } : {},
      }),
      invalidatesTags: ['AdminJobs', 'AdminTrips'],
    }),
    validateAdminJobDocuments: builder.mutation({
      query: (id) => ({ url: `/admin/jobs/${encodeURIComponent(id)}/validate-docs`, method: 'POST' }),
      invalidatesTags: ['AdminJobs', 'AdminDocReviewStats', 'AdminDocReviewQueue', 'AdminDocReviewDetail'],
    }),
    rejectAdminJobDocs: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/admin/jobs/${encodeURIComponent(id)}/reject-docs`, method: 'POST', body: { reason: reason.trim() },
      }),
      invalidatesTags: ['AdminJobs', 'AdminDocReviewStats', 'AdminDocReviewQueue', 'AdminDocReviewDetail'],
    }),
  }),
});

export const {
  useGetAdminJobsQuery,
  useGetAdminJobStatsQuery,
  useGetAdminJobsPendingDocsQuery,
  useGetAdminJobContainerTypesQuery,
  useLazyExportAdminJobsQuery,
  useLazyExportAdminJobSheetQuery,
  useGetAdminJobDetailQuery,
  useMarkAdminJobDeliveredMutation,
  useValidateAdminJobDocumentsMutation,
  useRejectAdminJobDocsMutation,
} = jobsApi;
