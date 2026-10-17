import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { mapAdminTripDto, mapAdminTripStatsDto } from './tripsApi.js';

const text = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
const count = (v) => Number.isSafeInteger(v) && v >= 0 ? v : null;
const error = (message) => ({ status: 'CUSTOM_ERROR', error: message });
const allowed = new Set(['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN']);
const operators = new Set(['SUPER_ADMIN', 'OPS_ADMIN']);
const arrivals = new Set(['DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'PICKUP_COMPLETED', 'IN_TRANSIT']);
const path = (id) => '/admin/trips/' + encodeURIComponent(id);
function current(api, owner, role) {
  const auth = api.getState().auth;
  return !api.signal.aborted && Boolean(auth.accessToken) && auth.admin?.id === owner && auth.admin?.role === role && allowed.has(role);
}
function transport(api, baseQuery, owner, role) {
  return async (request) => {
    if (!current(api, owner, role)) throw error('The session changed. Reopen Trips before continuing.');
    const result = await baseQuery(request);
    if (!current(api, owner, role)) throw error('The session changed. Reopen Trips before continuing.');
    if (result.error) throw result.error;
    return unwrapApiResponseData(result.data);
  };
}
function readPage(dto, page, requestedLimit) {
  const p = dto?.pagination;
  if (!Array.isArray(dto?.trips) || count(p?.page) !== page || !count(p?.limit) || count(p?.total) == null
    || count(p?.totalPages) == null || p.limit > requestedLimit || dto.trips.length > p.limit
    || p.totalPages !== Math.ceil(p.total / p.limit) && !(p.total === 0 && p.totalPages === 1)
    || dto.trips.length > p.total || p.total > 0 && page <= p.totalPages && !dto.trips.length) throw error('The trips response is incomplete. Refresh to try again.');
  const ids = dto.trips.map((t) => text(t?.tripId));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw error('The trips response contains invalid or repeated IDs.');
  return { rows: dto.trips, pagination: { page: p.page, limit: p.limit, total: p.total, totalPages: Math.max(1, p.totalPages) } };
}
function companyPayout(dto, trip) {
  const payout = dto.companyPayout;
  if (!payout || typeof payout !== 'object' || Array.isArray(payout) || !text(payout.id) || payout.kind !== 'JOB_SETTLEMENT'
    || !trip.truckerId || payout.payeeId !== trip.truckerId || !Array.isArray(payout.tripIds)
    || !payout.tripIds.every(id => text(id)) || !payout.tripIds.includes(trip.id)) return null;
  return {
    id: payout.id,
    status: ({ PENDING: 'Pending', PARTIALLY_PAID: 'Partially Paid', COMPLETED: 'Completed', ON_HOLD: 'On Hold', CANCELLED: 'Cancelled' })[payout.status] || '—',
    url: '/settlements/detail?id=' + encodeURIComponent(payout.id),
  };
}
function presentation(dto) {
  const t = mapAdminTripDto(dto);
  const containerParts = [text(t.container.size), text(t.container.type)].filter(Boolean).join(' ');
  return {
    ...t, job: t.jobNumber, from: t.origin || '—', to: t.destination || '—',
    driver: t.driverName || '—', truckData: t.truck, truck: t.truck.plateNumber || '—',
    containerLabel: (text(t.container.number) || t.containerNumber || '—') + (containerParts ? ' (' + containerParts + ')' : ''),
    segmentIndex: t.currentSegment?.index ?? null, segmentTotal: t.currentSegment?.total ?? null,
    distanceLabel: t.distance.remainingKm == null ? '—' : t.distance.remainingKm.toLocaleString('en-NG', { maximumFractionDigits: 1 }) + ' km',
    etaLabel: t.displayEta || '—', progress: t.progressPercent,
    live: t.telemetryLive === true && t.hasGpsPosition && !['COMPLETED', 'CANCELLED'].includes(t.statusCode),
    payout: companyPayout(dto, t),
    // The reference's multi-truck note requires independent assignments; containers share a job assignment today.
    multipleTruckAssignmentsKnown: false,
    siblingIds: t.otherTripsOnJob.map((s) => s.id).filter((id) => id && id !== '—' && id !== t.id),
  };
}
function date(v) {
  if (!text(v) || !/^\d{4}-\d{2}-\d{2}T/.test(v) || !Number.isFinite(Date.parse(v))) return null;
  return new Date(v);
}
function periodLabel(from, to) {
  const a = date(from), b = date(to);
  if (!a || !b || b < a) return '—';
  const format = new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric' });
  return format.format(a) + ' – ' + format.format(b);
}
function statsPresentation(dto) {
  const mapped = mapAdminTripStatsDto(dto);
  return { ...mapped, periodLabel: periodLabel(mapped.period.from, mapped.period.to),
    comparisonLabel: periodLabel(mapped.period.comparedToFrom, mapped.period.comparedToTo),
    cards: Object.fromEntries(Object.entries(mapped.cards).map(([key, c]) => [key, {
      ...c, displayValue: c.value == null ? '—' : c.value.toLocaleString('en-NG'),
      displayChange: c.changePercent == null ? '—' : Math.abs(c.changePercent) + '%',
      direction: ['UP', 'DOWN', 'FLAT'].includes(c.trend) ? c.trend : null,
      sparkline: c.sparkline.length > 0 && c.sparkline.every((n) => count(n) != null) ? c.sparkline : [],
    }])) };
}
function filters(params) {
  return Object.fromEntries(Object.entries(params).filter(([key, value]) =>
    ['statusFilter', 'origin', 'destination', 'driverId', 'dateFrom', 'dateTo'].includes(key) && value != null && value !== ''));
}
export const tripScreenApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminTripScreenList: builder.query({
      async queryFn({ owner, role, page = 1, ...params }, api, _options, baseQuery) {
        try {
          const dto = await transport(api, baseQuery, owner, role)({ url: '/admin/trips', params: { ...filters(params), page, limit: 10 } });
          const result = readPage(dto, page, 10);
          return { data: { rows: result.rows.map(presentation), pagination: result.pagination } };
        } catch (e) { return { error: e?.status ? e : error('Unable to read trips.') }; }
      },
      providesTags: ['AdminTrips'],
    }),
    getAdminTripScreenStats: builder.query({
      async queryFn({ owner, role, dateFrom, dateTo }, api, _options, baseQuery) {
        try { return { data: statsPresentation(await transport(api, baseQuery, owner, role)({ url: '/admin/trips/stats', params: filters({ dateFrom, dateTo }) })) }; }
        catch (e) { return { error: e?.status ? e : error('Unable to read trip totals.') }; }
      },
      providesTags: ['AdminTrips'],
    }),
    getAdminTripScreenFilters: builder.query({
      async queryFn({ owner, role, dateFrom, dateTo }, api, _options, baseQuery) {
        try {
          const run = transport(api, baseQuery, owner, role), rows = [], seen = new Set();
          let pages = 1, total = null;
          for (let page = 1; page <= pages; page += 1) {
            const result = readPage(await run({ url: '/admin/trips', params: { ...filters({ dateFrom, dateTo }), page, limit: 100 } }), page, 100);
            if (result.pagination.totalPages > 500 || total != null && (total !== result.pagination.total || pages !== result.pagination.totalPages)) throw error('Trip filter options changed while loading. Refresh them.');
            total = result.pagination.total; pages = result.pagination.totalPages;
            for (const row of result.rows) {
              if (seen.has(row.tripId)) throw error('Trip filter options contain repeated records.');
              seen.add(row.tripId); rows.push(mapAdminTripDto(row));
            }
          }
          if (rows.length !== total) throw error('Trip filter options are incomplete.');
          const drivers = new Map();
          rows.forEach((t) => { if (t.driverId && t.driverName) drivers.set(t.driverId, t.driverName); });
          const names = [...drivers.values()];
          return { data: {
            origins: [...new Set(rows.map((t) => t.origin).filter(Boolean))].sort(),
            destinations: [...new Set(rows.map((t) => t.destination).filter(Boolean))].sort(),
            drivers: [...drivers.entries()].map(([id, name]) => ({ id, label: names.filter((n) => n === name).length > 1 ? name + ' · ' + id : name })),
          } };
        } catch (e) { return { error: e?.status ? e : error('Unable to read trip filter options.') }; }
      },
      providesTags: ['AdminTrips'],
    }),
    getAdminTripScreenDetail: builder.query({
      async queryFn({ id, owner, role }, api, _options, baseQuery) {
        try {
          const dto = await transport(api, baseQuery, owner, role)({ url: path(id) });
          if (dto?.tripId !== id) throw error('The returned trip does not match this selection.');
          return { data: presentation(dto) };
        } catch (e) { return { error: e?.status ? e : error('Unable to read trip details.') }; }
      },
      providesTags: ['AdminTrips'],
    }),
    exportAdminTripScreen: builder.query({
      async queryFn({ owner, role, ...params }, api, _options, baseQuery) {
        try {
          const download = await transport(api, baseQuery, owner, role)({
            url: '/admin/trips/export', params: filters(params), headers: { Accept: 'text/csv' },
            responseHandler: async (response) => {
              const body = await response.text();
              if (!response.ok) { try { return JSON.parse(body); } catch { return { message: 'Unable to export trips.' }; } }
              return { csv: body, contentType: response.headers.get('Content-Type') };
            },
          });
          const csv = download?.csv, type = download?.contentType?.split(';')[0].trim().toLowerCase();
          if (typeof csv !== 'string' || !csv.trim() || type !== 'text/csv' || /^[<{\[]/.test(csv.replace(/^\uFEFF/, '').trimStart())) throw error('The export response is not a valid CSV download.');
          return { data: csv };
        } catch (e) { return { error: e?.status ? e : error('Unable to export trips.') }; }
      },
    }),
    changeAdminTripScreen: builder.mutation({
      async queryFn({ owner, role, id, jobId, expectedStatus, driverId, action, message, reason }, api, _options, baseQuery) {
        try {
          const run = transport(api, baseQuery, owner, role), before = await run({ url: path(id) });
          if (before?.tripId !== id || before.jobId !== jobId || before.status !== expectedStatus) throw error('The trip changed. Refresh it before continuing.');
          if (action === 'message') {
            if (!text(driverId) || before.driver?.id !== driverId) throw error('The assigned driver changed. Reopen the contact form.');
            if (!text(message) || message.trim().length > 2000) throw error('Enter a message of up to 2,000 characters.');
            const sent = await run({ url: path(id) + '/message-driver', method: 'POST', body: { message: message.trim() } });
            if (!text(sent?.threadId) || sent.driverId !== driverId) throw error('The message was sent but its recipient could not be confirmed. Refresh before retrying.');
          } else {
            if (!operators.has(role)) throw error('Your role cannot update trips.');
            if (action === 'delay') {
              if (!text(reason) || reason.trim().length > 500 || !text(before.status) || ['COMPLETED', 'CANCELLED'].includes(before.status)) throw error('Enter a delay reason of up to 500 characters for an active trip.');
              await run({ url: path(id) + '/mark-delayed', method: 'POST', body: { reason: reason.trim() } });
            } else if (action === 'arrival') {
              if (!arrivals.has(before.status)) throw error('This trip cannot be marked at delivery.');
              await run({ url: path(id) + '/mark-at-delivery', method: 'POST' });
            } else throw error('This trip action is unavailable.');
            try {
              const saved = await run({ url: path(id) });
              if (saved.tripId !== id || saved.jobId !== jobId || (action === 'delay' ? saved.isDelayed !== true || saved.delayReason !== reason.trim() : saved.status !== 'CARGO_ARRIVED')) throw error('The saved result could not be confirmed.');
            } catch { throw error('The action was sent but could not be confirmed. Refresh before retrying.'); }
          }
          return { data: { id, action } };
        } catch (e) { return { error: e?.status ? e : error('Unable to update this trip.') }; }
      },
      invalidatesTags: ['AdminTrips', 'AdminJobs'],
    }),
  }),
});
export const { useGetAdminTripScreenListQuery, useGetAdminTripScreenStatsQuery, useGetAdminTripScreenFiltersQuery,
  useGetAdminTripScreenDetailQuery, useLazyExportAdminTripScreenQuery, useChangeAdminTripScreenMutation } = tripScreenApi;
