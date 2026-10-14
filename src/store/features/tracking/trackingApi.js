import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { geofenceBoundaryError } from './geofenceGeometry.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const numeric = (value) => (typeof value === 'number' || typeof value === 'string' && value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
const nonNegative = (value) => { const n = numeric(value); return n != null && n >= 0 ? n : null; };
const count = (value) => { const n = nonNegative(value); return Number.isSafeInteger(n) ? n : null; };
const failure = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
const collection = (value, adapt) => Array.isArray(value) && value.every((row) => row && typeof row === 'object' && !Array.isArray(row)) ? value.map(adapt) : null;
function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [y, m, d, h, min, sec] = value.slice(0, 19).split(/[-T:]/).map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate() && h <= 23 && min <= 59 && sec <= 59 && Number.isFinite(Date.parse(value)) ? value : null;
}
function displayTime(value) {
  const at = timestamp(value);
  return at ? new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(at)) : '—';
}
function coordinate(dto) {
  const lat = numeric(dto?.latitude), lng = numeric(dto?.longitude);
  return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}
function points(value, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) return null;
  const result = value.map(coordinate);
  return result.every(Boolean) ? result : null;
}
const ids = (value) => Array.isArray(value) && value.every((id) => text(id)) ? value : null;
function overview(response) {
  const dto = record(unwrapApiResponseData(response));
  const alerts = collection(dto.alerts, (alert) => ({
    id: text(alert.id), tripId: text(alert.tripId), type: text(alert.type), severity: text(alert.severity),
    message: text(alert.message), occurredAt: timestamp(alert.occurredAt),
  }));
  const topDelays = collection(dto.topDelays, (delay) => ({
    route: text(delay.route), delayedTrips: count(delay.delayedTrips), averageDelayMinutes: nonNegative(delay.averageDelayMinutes),
  }));
  return {
    alerts, topDelays,
    alertsText: alerts?.length ? alerts.map((alert) => [alert.severity || '—', alert.message || '—', displayTime(alert.occurredAt)].join(' · ')).join(' | ') : '—',
    topDelaysText: topDelays?.length ? topDelays.map((delay) => (delay.route || '—') + ' · ' + (delay.delayedTrips ?? '—') + ' delayed · ' + (delay.averageDelayMinutes ?? '—') + ' min').join(' | ') : '—',
    routes: collection(dto.routes, (route) => ({ jobId: text(route.jobId), tripIds: ids(route.tripIds), source: text(route.source), points: route.source === 'RECORDED_GPS' ? points(route.points, 2) : null })),
    clusters: collection(dto.clusters, (cluster) => ({ position: coordinate(cluster), count: count(cluster.count), tripIds: ids(cluster.tripIds) })),
    heatmap: collection(dto.heatmap, (point) => ({ position: coordinate(point), weight: nonNegative(point.weight) })),
    geofences: collection(dto.geofences, (fence) => ({ id: text(fence.id), name: text(fence.name), polygon: points(fence.polygon, 3), truckIds: ids(fence.truckIds), notifyOnEntry: typeof fence.notifyOnEntry === 'boolean' ? fence.notifyOnEntry : null, notifyOnExit: typeof fence.notifyOnExit === 'boolean' ? fence.notifyOnExit : null })),
  };
}
function geofenceBody(fields) {
  const dto = record(fields), boundaryError = geofenceBoundaryError(dto.vertices);
  const notifyOnEntry = dto.notifyOnEntry ?? true, notifyOnExit = dto.notifyOnExit ?? true;
  if (boundaryError) throw new Error(boundaryError);
  if (!text(dto.truckId) || typeof notifyOnEntry !== 'boolean' || typeof notifyOnExit !== 'boolean' || !notifyOnEntry && !notifyOnExit) throw new Error('Select a truck and enable entry or exit notifications.');
  return { polygon: dto.vertices.map(({ lat, lng }) => ({ latitude: lat, longitude: lng })), truckIds: [dto.truckId], notifyOnEntry, notifyOnExit };
}
export const trackingApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminTracking'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminTrackingOverview: builder.query({
      query: ({ statusFilter, search } = {}) => ({ url: '/admin/tracking', params: { ...(text(statusFilter) ? { statusFilter } : {}), ...(text(search) ? { search: search.trim() } : {}) } }),
      transformResponse: overview,
      providesTags: ['AdminTracking', 'AdminTrips'],
    }),
    shareAdminTripLocation: builder.mutation({
      async queryFn(id, _api, _options, baseQuery) {
        if (!text(id)) return failure('Select a trip first.');
        const owner = _api.getState().auth.admin?.id;
        const result = await baseQuery({ url: '/admin/trips/' + encodeURIComponent(id) + '/location-share', method: 'POST', body: {} });
        if (result.error) return result;
        if (!owner || _api.signal.aborted || _api.getState().auth.admin?.id !== owner || !_api.getState().auth.accessToken) return failure('The session changed. Refresh before continuing.');
        const dto = record(unwrapApiResponseData(result.data)), expiresAt = timestamp(dto.expiresAt);
        let url;
        try { const parsed = new URL(dto.url); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) url = parsed.href; } catch { /* Require a usable server-issued link. */ }
        return url && expiresAt && Date.parse(expiresAt) > Date.now() ? { data: { url, expiresAt, expiryLabel: displayTime(expiresAt) } } : failure('The server did not return a valid location link and expiry. Refresh before trying again.');
      },
    }),
    createAdminTrackingGeofence: builder.mutation({
      async queryFn(fields, _api, _options, baseQuery) {
        let body; try { body = geofenceBody(fields); } catch (error) { return failure(error.message); }
        if (!text(fields.tripId)) return failure('Select a trip first.');
        const owner = _api.getState().auth.admin?.id;
        const sameSession = () => owner && !_api.signal.aborted && _api.getState().auth.admin?.id === owner && _api.getState().auth.accessToken;
        if (!sameSession()) return failure('The session changed. Refresh before continuing.');
        const tripResult = await baseQuery('/admin/trips/' + encodeURIComponent(fields.tripId));
        if (tripResult.error) return tripResult;
        const trip = record(unwrapApiResponseData(tripResult.data));
        if (!sameSession()) return failure('The session changed. Refresh before continuing.');
        if (trip.tripId !== fields.tripId || trip.truck?.id !== fields.truckId) return failure('This trip has a different assigned truck. Close the dialog and refresh before drawing again.');
        const result = await baseQuery({ url: '/admin/tracking/geofences', method: 'POST', body });
        if (result.error) {
          const uncertain = ['FETCH_ERROR', 'TIMEOUT_ERROR', 'PARSING_ERROR'].includes(result.error.status) || Number(result.error.status) >= 500;
          return { error: { ...result.error, ...(uncertain ? { saveUnconfirmed: true } : {}) } };
        }
        if (!sameSession()) return { error: { status: 'CUSTOM_ERROR', error: 'The session changed after saving. Refresh before trying again.', saveUnconfirmed: true } };
        const dto = record(unwrapApiResponseData(result.data));
        const boundary = (value) => {
          const parsed = points(value, 3);
          if (!parsed) return null;
          if (parsed.length > 3 && parsed[0].lat === parsed.at(-1).lat && parsed[0].lng === parsed.at(-1).lng) parsed.pop();
          return parsed;
        };
        const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
        return text(dto.id) && same(boundary(dto.polygon), boundary(body.polygon)) && ids(dto.truckIds) && same([...dto.truckIds].sort(), [...body.truckIds].sort())
          && dto.notifyOnEntry === body.notifyOnEntry && dto.notifyOnExit === body.notifyOnExit
          ? { data: dto } : { error: { status: 'CUSTOM_ERROR', error: 'The geofence save could not be confirmed. Close this dialog and refresh before trying again.', saveUnconfirmed: true } };
      },
      invalidatesTags: ['AdminTracking'],
    }),
  }),
});
export const { useGetAdminTrackingOverviewQuery, useShareAdminTripLocationMutation, useCreateAdminTrackingGeofenceMutation } = trackingApi;
