import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const object = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const text = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
const number = (v) => (typeof v === 'number' || typeof v === 'string' && v.trim()) && Number.isFinite(Number(v)) ? Number(v) : null;
const nonnegative = (v) => number(v) != null && number(v) >= 0 ? number(v) : null;
const count = (v) => Number.isSafeInteger(number(v)) && number(v) >= 0 ? number(v) : null;
const shown = (v) => text(v) || '—';
const roles = new Set(['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN']);
const deliveryRoles = new Set(['SUPER_ADMIN', 'OPS_ADMIN']);
const deliverable = new Set(['DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'PICKUP_COMPLETED', 'IN_TRANSIT', 'CONTAINER_RETURNED']);
const arrivals = new Set(['DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'PICKUP_COMPLETED', 'IN_TRANSIT']);
const labels = { TRUCK_REQUESTED: 'Pending Approval', DOC_REVIEW: 'Pending Approval', DOCUMENTS_VALIDATED: 'Bidding', DRIVER_ASSIGNED: 'Assigned', DRIVER_EN_ROUTE: 'Assigned', DRIVER_ARRIVED: 'Assigned', PICKUP_COMPLETED: 'In Transit', IN_TRANSIT: 'In Transit', CARGO_ARRIVED: 'In Transit', DEMURRAGE_IN_PROGRESS: 'In Transit', OFFLOADING: 'In Transit', OFFLOAD_COMPLETED: 'In Transit', CONTAINER_RETURNED: 'In Transit', COMPLETED: 'Delivered', CANCELLED: 'Cancelled', DISPUTED: 'Attention Required' };
const title = (v) => text(v) ? text(v).toLowerCase().split(/[_\s]+/).map((s) => s[0].toUpperCase() + s.slice(1)).join(' ') : '—';
const fail = (message) => ({ status: 'CUSTOM_ERROR', error: message });
const path = (id) => '/admin/jobs/' + encodeURIComponent(id);
const docPath = (id) => '/admin/doc-review/queue/' + encodeURIComponent(id);
export function jobScreenTime(v) {
  if (!text(v) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return '—';
  const [y, m, d, h, min, sec] = v.slice(0, 19).split(/[-T:]/).map(Number);
  if (m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate() || h > 23 || min > 59 || sec > 59 || !Number.isFinite(Date.parse(v))) return '—';
  return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v));
}
export function jobScreenUrl(id) { return '/jobs/detail?id=' + encodeURIComponent(id); }
export function jobScreenDocumentUrl(v) {
  try { const u = new URL(v); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
}
function session(api, owner, role) {
  const auth = api.getState().auth;
  return !api.signal.aborted && Boolean(auth.accessToken) && auth.admin?.id === owner && auth.admin?.role === role && roles.has(role);
}
function transport(api, baseQuery, owner, role) {
  return async (request) => {
    if (!session(api, owner, role)) throw fail('The session changed. Refresh before continuing.');
    const result = await baseQuery(request);
    if (!session(api, owner, role)) throw fail('The session changed. Refresh before continuing.');
    if (result.error) throw result.error;
    return unwrapApiResponseData(result.data);
  };
}
async function directory(run, url, params, key, idKey = 'id') {
  const rows = [], seen = new Set();
  let expectedTotal = null, pages = 1;
  for (let page = 1; page <= pages; page += 1) {
    const dto = await run({ url, params: { ...params, page, limit: 100 } });
    const p = object(dto.pagination), list = dto[key];
    const total = count(p.total), limit = count(p.limit), totalPages = count(p.totalPages);
    if (!Array.isArray(list) || count(p.page) !== page || !limit || total == null || totalPages == null || totalPages > 500
      || totalPages !== Math.ceil(total / limit) && !(total === 0 && totalPages === 1)
      || list.length > limit || list.length > total || total > 0 && !list.length) throw fail('The ' + key + ' collection is incomplete.');
    if (expectedTotal != null && (expectedTotal !== total || pages !== Math.max(1, totalPages))) throw fail('The ' + key + ' collection changed while loading. Refresh it.');
    expectedTotal = total; pages = Math.max(1, totalPages);
    for (const row of list) {
      const id = text(row?.[idKey]);
      if (!id || seen.has(id)) throw fail('The ' + key + ' collection has invalid or repeated IDs.');
      seen.add(id); rows.push(row);
    }
  }
  if (rows.length !== expectedTotal) throw fail('The ' + key + ' collection is incomplete.');
  return rows;
}
function mapDocument(d, jobId) {
  const status = title(d.status);
  return {
    id: text(d.id) || jobId + ':' + shown(d.type), apiId: text(d.id), version: count(d.version),
    type: shown(d.type), mimeType: text(d.mimeType), name: text(d.fileName) || text(d.label) || '—', url: jobScreenDocumentUrl(d.url),
    status, statusCode: text(d.status), size: shown(d.fileSize), date: jobScreenTime(d.uploadedAt),
    submittedBy: shown(d.uploadedBy?.name), reviewedBy: shown(d.reviewedBy?.name), reviewedOn: jobScreenTime(d.reviewedAt),
    reference: '—', tripId: null, canReview: Boolean(text(d.id)) && ['PENDING', 'APPROVED', 'REJECTED'].includes(d.status),
  };
}
function mapTrip(t) {
  const distance = object(t.distance), driver = object(t.driver), truck = object(t.truck), company = object(t.truckingCompany);
  const progress = number(t.progressPercent);
  return {
    id: t.tripId, jobId: text(t.jobId), statusCode: text(t.status), isDelayed: typeof t.isDelayed === 'boolean' ? t.isDelayed : null,
    status: t.isDelayed === true ? 'Delayed' : text(t.segmentLabel) || title(t.status),
    truckPlate: shown(truck.plateNumber), truckId: text(truck.id), driverId: text(driver.id),
    driverName: text(driver.name) || text(t.driverName) || '—', driverPhone: shown(driver.phone),
    truckingCompany: shown(company.name), truckerId: text(company.id),
    origin: shown(t.origin), destination: shown(t.destination), route: shown(t.route),
    progress: progress != null && progress >= 0 && progress <= 100 ? progress : null,
    eta: jobScreenTime(t.eta), deliveryDate: jobScreenTime(t.dates?.deliveredAt),
    distanceKm: nonnegative(distance.totalKm), coveredKm: nonnegative(distance.coveredKm),
    speedKmH: t.telemetryLive === true ? nonnegative(t.speedKmH) : null,
    livePosition: t.telemetryLive === true && t.currentLocation?.source === 'LIVE_GPS',
    locationUpdatedAt: jobScreenTime(t.currentLocation?.updatedAt), currentLocation: shown(t.currentLocation?.description),
    cost: null, driverPayment: null, expenses: null,
    canMarkAtDelivery: arrivals.has(t.status), canMarkDelayed: Boolean(text(t.status)) && !['COMPLETED', 'CANCELLED'].includes(t.status),
  };
}
function timelineRows(dto) {
  return Array.isArray(dto.timeline) ? dto.timeline.filter((x) => x && typeof x === 'object').map((x) => ({
    time: jobScreenTime(x.timestamp), location: '—', status: shown(x.event), details: shown(x.event), source: '—',
    completed: typeof x.completed === 'boolean' ? x.completed : null,
  })) : [];
}
function mapScreen(dto, summary, docDto, rawBids, rawTrips, rawPayments, errors) {
  const pickup = object(dto.pickup), delivery = object(dto.delivery), pricing = object(dto.pricing);
  const forwarder = object(dto.forwarder), trucker = object(dto.trucker), requester = object(summary?.requester);
  const cargo = object(summary?.cargo), assignment = object(summary?.assignment);
  const trips = rawTrips?.filter((t) => t.jobId === dto.id).map(mapTrip) || [];
  const bids = rawBids?.filter((b) => b.jobId === dto.id).map((b) => ({
    id: b.id, company: shown(b.truckerName), rating: null, trips: null,
    amount: number(b.amount), status: title(b.status), accepted: b.status === 'ACCEPTED',
    services: null, estDeliveryDate: '—', submittedAt: jobScreenTime(b.createdAt),
  })) || [];
  const documents = Array.isArray(docDto?.documentList) ? docDto.documentList.filter((d) => d && typeof d === 'object').map((d) => mapDocument(d, dto.id)) : [];
  const transactions = rawPayments?.filter((p) => p.jobId === dto.id || p.jobId === dto.jobNumber || p.relatedKind === 'JOB' && p.relatedTo?.id === dto.id).map((p) => ({
    id: p.id, date: jobScreenTime(p.createdAt), description: shown(p.description), status: title(p.status), reference: shown(p.reference),
    amount: number(p.amount) == null ? null : p.direction === 'inflow' ? number(p.amount) : p.direction === 'outflow' ? -number(p.amount) : null,
    type: text(p.type), rawStatus: text(p.status), releaseType: text(p.releaseType),
  })) || [];
  const activityKnown = Array.isArray(dto.activityLog);
  const activityLog = activityKnown ? dto.activityLog.filter((a) => a && typeof a === 'object').map((a, i) => ({
    id: dto.id + ':activity:' + i, time: jobScreenTime(a.at), user: shown(a.actor?.name), actorId: text(a.actor?.id),
    role: title(a.actor?.type), action: title(a.action), details: shown(a.description),
  })) : [];
  const rawStatus = text(dto.status);
  const rejected = rawStatus === 'DRAFT' && (docDto?.documentSummary?.rejected > 0 || dto.documents?.approvalStatus === 'Rejected');
  const stageTimeline = Array.isArray(summary?.timeline) ? summary.timeline : [];
  const milestone = (key) => stageTimeline.find((t) => t.key === key && t.completed === true)?.at;
  const distinctAssignments = (field) => rawTrips && trips.every((t) => text(t[field])) ? new Set(trips.map((t) => t[field])).size : rawTrips?.length === 0 ? 0 : null;
  const assignedTruckCount = distinctAssignments('truckId'), assignedDriverCount = distinctAssignments('driverId');
  const routeDistances = rawTrips?.filter((t) => t.jobId === dto.id).map((t) => nonnegative(t.distance?.totalKm));
  const distanceKm = routeDistances?.length && routeDistances.every((n) => n != null && n === routeDistances[0]) ? routeDistances[0] : null;
  const counts = { required: null, assigned: assignedTruckCount, total: count(assignment.totalTrips),
    active: rawTrips ? trips.filter((t) => ['DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'PICKUP_COMPLETED', 'IN_TRANSIT', 'CARGO_ARRIVED', 'DEMURRAGE_IN_PROGRESS', 'OFFLOADING', 'OFFLOAD_COMPLETED', 'CONTAINER_RETURNED'].includes(t.statusCode)).length : null,
    completed: rawTrips ? trips.filter((t) => t.statusCode === 'COMPLETED').length : null };
  const summaryDocs = object(docDto?.documentSummary);
  const users = new Set(activityLog.filter((a) => a.actorId).map((a) => a.role + ':' + a.actorId));
  const frequencies = new Map();
  activityLog.filter((a) => a.actorId).forEach((a) => {
    const key = a.role + ':' + a.actorId, entry = frequencies.get(key) || { count: 0, user: a.user };
    frequencies.set(key, { count: entry.count + 1, user: entry.user });
  });
  return {
    apiId: dto.id, id: text(dto.jobNumber) || dto.id, statusCode: rawStatus,
    status: rejected ? 'Rejected' : labels[rawStatus] || (rawStatus === 'DRAFT' ? 'Draft' : '—'),
    forwarderId: text(forwarder.id), truckerId: text(trucker.id), forwarder: shown(forwarder.name),
    truckingCompany: text(trucker.name), assignmentStatus: count(assignment.assignedTrips) == null ? '—' : assignment.assignedTrips > 0 ? 'Assigned' : 'Not Assigned',
    contactPerson: text(requester.name) || shown(forwarder.name), contactPhone: text(requester.phone) || shown(forwarder.phone),
    requestType: text(summary?.tripType?.label) || shown(docDto?.jobType?.label), tripType: '—',
    cargoType: Array.isArray(cargo.containerTypes) && cargo.containerTypes.every((x) => text(x)) ? cargo.containerTypes.join(', ') || '—' : '—',
    cargo: text(cargo.label) || text(dto.cargoContents) || '—', cargoDetails: text(dto.cargoContents) || text(cargo.description) || '—',
    totalWeight: null, origin: text(summary?.origin) || shown(pickup.address), destination: text(summary?.destination) || shown(delivery.address),
    originCountry: '—', destCountry: '—', pickupDate: '—', deliveryDate: '—', specialInstructions: '—',
    createdAt: jobScreenTime(summary?.createdAt || docDto?.createdAt || milestone('created')),
    updatedAt: jobScreenTime(summary?.updatedAt || docDto?.updatedAt), published: '—',
    route: text(summary?.route) || (text(pickup.address) && text(delivery.address) ? pickup.address + ' → ' + delivery.address : '—'),
    distanceKm, durationLabel: '—', routeType: '—', biddingCloses: '—', requiredTrucks: null,
    jobValue: number(pricing.agreedPrice) ?? number(summary?.value), platformFeePct: number(pricing.commissionPercent),
    fee: number(pricing.platformFee), driverPayment: number(pricing.truckerPayout), demurrage: null, otherCosts: null, netEarnings: null,
    finalPayoutStatus: text(pricing.finalPayoutStatus), assignedTruckCount, assignedDriverCount, assignedTrips: count(assignment.assignedTrips), trips, tripCounts: counts, bids, documents, transactions,
    activityLog, trackingUpdates: timelineRows(dto), photos: [], relatedPayouts: [],
    bidsKnown: rawBids !== null, tripsKnown: rawTrips !== null, documentsKnown: Array.isArray(docDto?.documentList),
    transactionsKnown: rawPayments !== null, activityKnown, relatedPayoutsKnown: false,
    documentStatusCounts: { total: count(summaryDocs.total), approved: count(summaryDocs.approved), pending: count(summaryDocs.pending), rejected: count(summaryDocs.rejected) },
    uniqueActivityUsers: activityKnown && activityLog.every((a) => a.actorId || a.role === 'System') ? users.size : null,
    mostActiveUser: activityKnown && activityLog.every((a) => a.actorId || a.role === 'System') ? [...frequencies.values()].sort((a, b) => b.count - a.count)[0]?.user || '—' : '—',
    stageDates: [jobScreenTime(milestone('created')), '—', jobScreenTime(milestone('docsApproved')), jobScreenTime(milestone('assigned')), jobScreenTime(milestone('inTransit')), jobScreenTime(milestone('delivery'))].map((date) => date === '—' ? null : date),
    canApprove: rawStatus === 'DOC_REVIEW', canDeliver: deliverable.has(rawStatus), canCancel: Boolean(rawStatus) && !['COMPLETED', 'CANCELLED'].includes(rawStatus),
    errors,
  };
}

export const jobDetailApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminJobScreen: builder.query({
      async queryFn({ id, owner, role }, api, _options, baseQuery) {
        try {
          const run = transport(api, baseQuery, owner, role);
          let apiId = text(id), resolvedSummary = null;
          if (!apiId) throw fail('Open a job from the Jobs page.');
          if (/^(?:JOB|TK|TRK)-/i.test(apiId)) {
            const rows = await directory(run, '/admin/jobs', { search: apiId }, 'jobs');
            const matches = rows.filter((j) => j.jobNumber === apiId);
            if (matches.length !== 1) throw { status: 404, data: { message: 'Job not found.' } };
            resolvedSummary = matches[0]; apiId = resolvedSummary.id;
          }
          const dto = await run({ url: path(apiId) });
          if (dto?.id !== apiId) throw fail('The job response does not match the requested job.');
          const errors = [];
          const optional = async (label, fn) => { try { return await fn(); } catch (e) {
            if (!session(api, owner, role)) throw e;
            errors.push(label); return null;
          } };
          const [summary, documents, bids, trips, payments] = await Promise.all([
            resolvedSummary ? Promise.resolve(resolvedSummary) : optional('Job information', async () => {
              if (!text(dto.jobNumber)) return null;
              const rows = await directory(run, '/admin/jobs', { search: dto.jobNumber }, 'jobs');
              return rows.find((j) => j.id === apiId) || null;
            }),
            optional('Documents', async () => { const d = await run({ url: docPath(apiId) }); if (d?.id !== apiId) throw fail('Document job ID mismatch.'); if (!Array.isArray(d.documentList)) throw fail('Document collection missing.'); const keys = d.documentList.map((x) => text(x?.id) || text(x?.type)); if (keys.some((key) => !key) || new Set(keys).size !== keys.length) throw fail('Document collection has invalid or repeated records.'); return d; }),
            optional('Bids', () => directory(run, '/admin/bids', { jobId: apiId }, 'bids')),
            text(dto.jobNumber) ? optional('Trips', () => directory(run, '/admin/trips', { search: dto.jobNumber }, 'trips', 'tripId')) : Promise.resolve(null),
            text(dto.jobNumber) ? optional('Transactions', () => directory(run, '/admin/payments/transactions', { search: dto.jobNumber }, 'rows')) : Promise.resolve(null),
          ]);
          if (!session(api, owner, role)) throw fail('The session changed.');
          return { data: mapScreen(dto, summary, documents, bids, trips, payments, errors) };
        } catch (error) { return { error: error?.status ? error : fail('The job data could not be read.') }; }
      },
      providesTags: ['AdminJobs', 'AdminTrips', 'AdminBids', 'AdminDocReviewDetail'],
    }),
    getAdminJobScreenTrip: builder.query({
      async queryFn({ id, jobId, owner, role }, api, _options, baseQuery) {
        try {
          const dto = await transport(api, baseQuery, owner, role)({ url: '/admin/trips/' + encodeURIComponent(id) });
          if (dto?.tripId !== id || dto.jobId !== jobId) throw fail('The trip does not belong to this job.');
          const trip = mapTrip(dto);
          return { data: { ...trip, trackingUpdates: Array.isArray(dto.milestones) ? dto.milestones.filter((m) => m && jobScreenTime(m.at) !== '—').map((m) => ({
            time: jobScreenTime(m.at), status: shown(m.label), details: shown(m.label), location: '—', source: '—', completed: m.completed,
          })).reverse() : [], photos: Array.isArray(dto.issues) ? dto.issues.flatMap((i) => Array.isArray(i?.photoUrls) ? i.photoUrls.filter(jobScreenDocumentUrl).map((url) => ({ url, label: shown(i.description) })) : []) : [] } };
        } catch (error) { return { error: error?.status ? error : fail('The trip data could not be read.') }; }
      },
      providesTags: ['AdminTrips'],
    }),
    changeAdminJobScreen: builder.mutation({
      async queryFn({ id, owner, role, action, documentId, version, documentUrl, tripId, reason, expectedStatus }, api, _options, baseQuery) {
        try {
          const run = transport(api, baseQuery, owner, role);
          const dto = await run({ url: path(id) });
          if (dto?.id !== id || dto.status !== expectedStatus) throw fail('The job changed. Refresh before continuing.');
          let request, check;
          if (['approve', 'reject'].includes(action)) {
            if (dto.status !== 'DOC_REVIEW') throw fail('This job is not awaiting document approval.');
            if (action === 'reject' && !text(reason)) throw fail('Enter a rejection reason.');
            request = { url: path(id) + (action === 'approve' ? '/validate-docs' : '/reject-docs'), method: 'POST', ...(action === 'reject' ? { body: { reason: reason.trim() } } : {}) };
            check = async () => { const saved = await run({ url: path(id) }); return saved.id === id && saved.status === (action === 'approve' ? 'DOCUMENTS_VALIDATED' : 'DRAFT'); };
          } else if (['approveDocument', 'rejectDocument'].includes(action)) {
            if (dto.status !== 'DOC_REVIEW' || !text(documentId)) throw fail('This document cannot be reviewed at this stage.');
            const docs = await run({ url: docPath(id) });
            const d = docs.id === id && docs.documentList?.find((x) => x.id === documentId);
            if (!d || count(d.version) !== version || jobScreenDocumentUrl(d.url) !== documentUrl) throw fail('The document changed. Refresh before reviewing it.');
            if (action === 'rejectDocument' && !text(reason)) throw fail('Enter a rejection reason.');
            request = { url: docPath(id) + '/documents/' + encodeURIComponent(documentId) + (action === 'approveDocument' ? '/approve' : '/reject'), method: 'POST', ...(action === 'rejectDocument' ? { body: { reason: reason.trim() } } : {}) };
            check = async () => {
              const saved = await run({ url: docPath(id) });
              return saved.id === id && saved.documentList?.some((x) => x.id === documentId && x.status === (action === 'approveDocument' ? 'APPROVED' : 'REJECTED') && count(x.version) === version);
            };
          } else if (action === 'cancel') {
            if (['COMPLETED', 'CANCELLED'].includes(dto.status)) throw fail('This job cannot be cancelled.');
            request = { url: path(id) + '/intervene', method: 'POST', body: { type: 'CANCEL_JOB' } };
            check = async () => { const saved = await run({ url: path(id) }); return saved.id === id && saved.status === 'CANCELLED'; };
          } else if (action === 'deliver') {
            if (!deliveryRoles.has(role) || !deliverable.has(dto.status)) throw fail('Your role or this job status does not allow marking delivery.');
            request = { url: path(id) + '/mark-delivered', method: 'POST', body: {} };
            check = async () => { const saved = await run({ url: path(id) }); return saved.id === id && saved.status === 'COMPLETED'; };
          } else if (['delay', 'atDelivery'].includes(action)) {
            if (!deliveryRoles.has(role) || !text(tripId)) throw fail('Your role cannot perform this trip action.');
            const trip = await run({ url: '/admin/trips/' + encodeURIComponent(tripId) });
            if (trip.tripId !== tripId || trip.jobId !== id || trip.status !== dto.status) throw fail('The trip changed. Refresh before continuing.');
            if (action === 'atDelivery' && !arrivals.has(trip.status)) throw fail('This trip cannot be marked at delivery.');
            if (action === 'delay' && (!text(reason) || reason.trim().length > 500 || ['COMPLETED', 'CANCELLED'].includes(trip.status))) throw fail('Enter a delay reason of up to 500 characters for an active trip.');
            request = { url: '/admin/trips/' + encodeURIComponent(tripId) + (action === 'delay' ? '/mark-delayed' : '/mark-at-delivery'), method: 'POST', ...(action === 'delay' ? { body: { reason: reason.trim() } } : {}) };
            check = async () => {
              const saved = await run({ url: '/admin/trips/' + encodeURIComponent(tripId) });
              return saved.tripId === tripId && saved.jobId === id && (action === 'delay' ? saved.isDelayed === true && saved.delayReason === reason.trim() : saved.status === 'CARGO_ARRIVED');
            };
          } else throw fail('This action has no documented admin API.');
          await run(request);
          try { if (!await check()) throw fail('The saved result could not be confirmed. Refresh before retrying.'); }
          catch (e) { throw fail(e.error || 'The action was sent but could not be confirmed. Refresh before retrying.'); }
          return { data: { id, action } };
        } catch (error) { return { error: error?.status ? error : fail('The job could not be updated.') }; }
      },
      invalidatesTags: ['AdminJobs', 'AdminTrips', 'AdminBids', 'AdminDocReviewDetail', 'AdminDocReviewQueue', 'AdminDocReviewStats'],
    }),
  }),
});
export const { useGetAdminJobScreenQuery, useGetAdminJobScreenTripQuery, useChangeAdminJobScreenMutation } = jobDetailApi;
