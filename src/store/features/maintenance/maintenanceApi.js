import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { hasKoboPrecision } from '../../../lib/money.js';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';

const path = '/admin/maintenance';
const text = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
const number = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const integer = (v) => Number.isSafeInteger(v) && v >= 0 ? v : null;
const percent = (v) => number(v) != null && v <= 100 ? v : null;
const bool = (v) => typeof v === 'boolean' ? v : null;
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
export const PENDING_BACKEND = 'Waiting on the backend: this view uses a proposed endpoint that is not live yet.';
// Proposed endpoints (not in the OpenAPI spec yet). A 404/405/501 means "not
// shipped", which screens show as a pending state rather than a failure.
const notLive = { error: { status: 'CUSTOM_ERROR', error: PENDING_BACKEND, pendingBackend: true } };
const pending = (result, also = []) => [404, 405, 501, ...also].includes(result?.error?.status) ? notLive : null;
export const isPendingBackend = (error) => Boolean(error?.pendingBackend);
const types = { PREVENTIVE: 'Preventive', REPAIR: 'Repair', INSPECTION: 'Inspection', BREAKDOWN: 'Breakdown' };
const priorities = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
const statuses = { REQUESTED: 'Requested', SCHEDULED: 'Scheduled', IN_PROGRESS: 'In Progress', SUBMITTED: 'Awaiting Verification', VERIFIED: 'Verified', COMPLETED: 'Completed', OVERDUE: 'Overdue', CANCELLED: 'Cancelled', REJECTED: 'Rejected' };
const truckStatuses = { ACTIVE: 'Active', APPROVED: 'Approved', PENDING_REVIEW: 'Pending Review', REJECTED: 'Rejected', INACTIVE: 'Inactive', MAINTENANCE: 'In Maintenance' };
export const maintenanceTabs = { 'All Maintenance': 'all', Requested: 'requested', Scheduled: 'scheduled', 'In Progress': 'inProgress', 'Awaiting Verification': 'submitted', Completed: 'completed', Overdue: 'overdue', Cancelled: 'cancelled', Rejected: 'rejected' };
export const maintenanceHref = (id) => `/maintenance/detail?id=${encodeURIComponent(id)}`;
export function maintenanceError(error) {
  if (error?.data?.pendingBackend || error?.pendingBackend) return PENDING_BACKEND;
  if (error?.status === 403) return 'Your account cannot perform this maintenance operation.';
  if (error?.status === 401) return 'Please sign in again.';
  return getApiErrorMessage(error, 'The maintenance request could not be completed.');
}
function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || !Number.isFinite(Date.parse(value))) return null;
  if (value.includes('T')) {
    const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
    if (hour > 23 || minute > 59 || second > 59) return null;
  }
  return value;
}
export function maintenanceDate(value) {
  const parsed = dateValue(value);
  return parsed ? new Date(parsed).toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}
export function maintenanceWindow(days = 7) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  return { dateFrom: `${today}T00:00:00+01:00`, dateTo: `${end.toISOString().slice(0, 10)}T23:59:59.999+01:00` };
}
function location(value) {
  const lat = value?.latitude, lng = value?.longitude;
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180 ? `${lat}, ${lng}` : '—';
}
function mapServiceItems(items) {
  if (!Array.isArray(items)) return null;
  if (items.some(item => !text(item?.id)) || new Set(items.map(item => item.id)).size !== items.length) return null;
  return items.map(item => ({ id: item.id, label: text(item.label) || '—', completed: bool(item.completed), completedAt: dateValue(item.completedAt) }));
}
function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
}
function byteSize(value) {
  const bytes = integer(value);
  if (bytes == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const unit = bytes === 0 ? 0 : Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Number((bytes / 1024 ** unit).toFixed(1))} ${units[unit]}`;
}
function mapDocuments(response) {
  const dto = unwrapApiResponseData(response);
  if (!Array.isArray(dto?.documents)) throw new Error('The maintenance response is missing its documents list.');
  if (dto.documents.some(item => !text(item?.id)) || new Set(dto.documents.map(item => item.id)).size !== dto.documents.length) throw new Error('The maintenance documents returned missing or duplicate IDs.');
  const total = integer(dto.total);
  if (total != null && total !== dto.documents.length) throw new Error('The maintenance documents response is incomplete.');
  return { total, attachments: dto.documents.map(item => [text(item.name) || '—', byteSize(item.sizeBytes), item.id, safeUrl(item.downloadUrl)]) };
}
function mapUsage(response, _meta, { truckId }) {
  const dto = unwrapApiResponseData(response) || {};
  if (dto.truckId !== truckId) throw new Error('The maintenance usage response returned a different truck.');
  const from = dateValue(dto.period?.from), to = dateValue(dto.period?.to);
  if (dto.period != null && (!from || !to || Date.parse(from) > Date.parse(to))) throw new Error('The maintenance usage response has an invalid period.');
  const monthly = Array.isArray(dto.monthlyDistance) ? dto.monthlyDistance : null;
  if (monthly && (monthly.some(item => !/^\d{4}-(0[1-9]|1[0-2])$/.test(item?.month)) || new Set(monthly.map(item => item.month)).size !== monthly.length)) throw new Error('The maintenance usage response has invalid months.');
  const sorted = monthly?.slice().sort((a, b) => a.month.localeCompare(b.month));
  return {
    monthly: sorted?.map(item => number(item.distanceKm)) ?? null,
    labels: sorted?.map(item => item.month) ?? null,
    averageMonthlyDistanceKm: number(dto.averageMonthlyDistanceKm),
    period: dto.period == null ? null : { from, to, months: integer(dto.period.months) },
  };
}

function mapRecord(dto) {
  if (!text(dto?.id)) throw new Error('Maintenance response is missing a record ID.');
  const days = Number.isSafeInteger(dto.daysUntilDue) ? dto.daysUntilDue : null;
  const asset = dto.asset && typeof dto.asset === 'object' ? dto.asset : {};
  const last = asset.lastMaintenance && typeof asset.lastMaintenance === 'object' ? asset.lastMaintenance : null;
  const next = asset.nextDue && typeof asset.nextDue === 'object' ? asset.nextDue : null;
  return {
    id: dto.id, reference: text(dto.reference) || '—', truckId: text(dto.truck?.id),
    company: text(dto.company?.name) || '—', plate: text(dto.truck?.plateNumber) || '—', truckType: text(dto.asset?.truckType) || text(dto.truck?.label) || '—',
    type: types[dto.type] || '—', status: statuses[dto.displayStatus ?? dto.status] || '—', statusCode: text(dto.status),
    description: text(dto.description) || '—', serviceCenter: text(dto.serviceCenter?.name) || '—', location: text(dto.serviceCenter?.location) || '—',
    dueDate: maintenanceDate(dto.dueDate), dueAt: dateValue(dto.dueDate), created: maintenanceDate(dto.createdAt),
    recordDate: maintenanceDate(dto.status === 'COMPLETED' ? dto.completedAt : dto.status === 'IN_PROGRESS' ? dto.startedAt : dto.status === 'CANCELLED' ? dto.cancelledAt : dto.dueDate),
    completedAt: dateValue(dto.completedAt), odometer: number(dto.odometerKm), estimatedCost: number(dto.estimatedCost), actualCost: number(dto.actualCost),
    dueLabel: days == null ? '—' : days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `In ${days} days`,
    daysUntilDue: days, priority: Object.hasOwn(priorities, dto.priority) ? priorities[dto.priority] : '—', notes: text(dto.notes) || '—',
    assetStatus: truckStatuses[dto.truck?.status] || '—',
    makeModel: '—', year: '—', vin: '—', truckRef: text(dto.truck?.id) || '—', assetLocation: location(dto.asset?.currentLocation),
    currentOdometer: number(dto.asset?.currentOdometerKm), remainingKm: number(dto.asset?.kmUntilServiceDue), nextDueOdometer: number(dto.asset?.nextDueOdometerKm), nextDueDate: '—', nextDueDays: null, lastUpdated: maintenanceDate(dto.asset?.odometerUpdatedAt),
    lastMaintenance: Object.hasOwn(asset, 'lastMaintenance') ? (last ? { date: maintenanceDate(last.completedAt), odometer: number(last.odometerKm), serviceType: text(last.typeLabel) || types[last.type] || '—' } : null) : undefined,
    nextMaintenance: Object.hasOwn(asset, 'nextDue') ? (next ? { date: maintenanceDate(next.dueDate), daysUntilDue: Number.isSafeInteger(next.daysUntilDue) ? next.daysUntilDue : null } : null) : undefined,
    attachments: null, checklist: mapServiceItems(dto.serviceItems), fitForRoad: bool(dto.asset?.fitForRoad), maintenanceCompliant: bool(dto.asset?.maintenanceCompliant), noOpenIssues: null,
    eligibleForJobs: dto.truckEligibility?.id === dto.truck?.id ? bool(dto.truckEligibility?.eligibleForJobs) : null,
  };
}
function mapList(response, args) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.maintenance)) throw new Error('The maintenance response is missing its collection.');
  const rows = data.maintenance.map(mapRecord);
  const p = data.pagination || {};
  const page = integer(p.page), limit = integer(p.limit), total = integer(p.total), totalPages = integer(p.totalPages);
  if (!page || !limit || total == null || totalPages == null || page !== (args.page ?? 1) || rows.length > limit || rows.length > total || new Set(rows.map(r => r.id)).size !== rows.length
    || totalPages !== Math.ceil(total / limit) && !(total === 0 && totalPages === 1) || page > Math.max(1, totalPages) || total > 0 && !rows.length) throw new Error('The maintenance records could not be loaded completely. Please refresh.');
  return { rows, pagination: { page, limit, total, totalPages } };
}
function params(args = {}) {
  return Object.fromEntries(Object.entries(args).filter(([key, value]) => ['tab', 'search', 'type', 'severity', 'priority', 'flagged', 'companyId', 'truckId', 'dateFrom', 'dateTo', 'page', 'limit'].includes(key) && value !== '' && value != null));
}
function mapStats(response) {
  const dto = unwrapApiResponseData(response) || {};
  const cards = dto.cards || {};
  const metric = (v) => integer(v?.value);
  const segment = (key) => {
    const s = dto.overview?.segments?.find?.(s => s.key === key);
    return { count: integer(s?.count), percent: percent(s?.percent) };
  };
  const eligibility = (key) => ({ count: integer(dto.assetEligibility?.[key]?.count), percent: percent(dto.assetEligibility?.[key]?.percent) });
  return {
    totalTrucks: metric(cards.totalTrucks), inMaintenance: metric(cards.inMaintenance), inMaintenancePercent: percent(cards.inMaintenance?.percentOfFleet),
    // Container type is not a truck/trailer classification.
    trucksCaption: `${integer(cards.totalTrucks?.assetCounts?.trucks)?.toLocaleString('en-NG') ?? '—'} Trucks · ${integer(cards.totalTrucks?.assetCounts?.trailers)?.toLocaleString('en-NG') ?? '—'} Trailers · ${integer(cards.totalTrucks?.assetCounts?.other)?.toLocaleString('en-NG') ?? '—'} Others`,
    dueSoon: cards.dueSoon?.dueWithin?.days === 7 ? metric(cards.dueSoon.dueWithin) : cards.dueSoon?.withinDays === 7 ? metric(cards.dueSoon) : null,
    overdue: metric(cards.overdue), restrictedAssets: metric(cards.restrictedAssets), pendingApprovals: metric(cards.pendingApprovals),
    overview: ['scheduled', 'inProgress', 'completed', 'overdue'].map(segment),
    eligibility: ['eligible', 'underMaintenance', 'pendingInspection', 'restricted'].map(eligibility),
    byType: Object.keys(types).map(type => percent(dto.byType?.find?.(item => item.type === type)?.percent)),
    approvals: { total: integer(dto.approvals?.total), repair: integer(dto.approvals?.repairRequests), preventive: integer(dto.approvals?.preventiveRequests), major: integer(dto.approvals?.majorRepairRequests) },
  };
}

function mapEligibility(dto, truckId) {
  if (dto?.id !== truckId) throw new Error('The eligibility response returned a different truck.');
  const code = text(dto.ineligibility?.reason);
  return {
    truckId, plate: text(dto.plateNumber) || '—', eligible: bool(dto.eligibleForJobs),
    reasonCode: code, message: text(dto.ineligibility?.message) || null,
    restricted: Boolean(dateValue(dto.restrictedAt)), restrictedAt: maintenanceDate(dto.restrictedAt), restrictionReason: text(dto.restrictionReason) || null,
    liftedAt: maintenanceDate(dto.restrictionLiftedAt),
  };
}
function mapCompletion(dto) {
  if (!dto || typeof dto !== 'object') return null;
  return {
    completedAt: maintenanceDate(dto.completedAt), odometer: number(dto.odometerKm), workshop: text(dto.workshop?.name) || '—',
    workPerformed: text(dto.workPerformed) || '—', actualCost: number(dto.actualCost),
    nextDueKm: number(dto.nextDue?.km), nextDueDate: maintenanceDate(dto.nextDue?.date),
    documents: Array.isArray(dto.documents) ? dto.documents.filter((doc) => text(doc?.id)).map((doc) => ({ id: doc.id, name: text(doc.name) || '—', url: safeUrl(doc.downloadUrl) })) : [],
    submittedBy: text(dto.submittedBy?.name) || '—', submittedAt: maintenanceDate(dto.submittedAt),
  };
}
function mapRequirement(dto) {
  return {
    ruleId: dto.ruleId, ruleName: text(dto.ruleName) || '—', category: text(dto.category), mandatory: bool(dto.mandatory), status: text(dto.status),
    lastServiceKm: number(dto.lastServiceKm), lastServiceDate: maintenanceDate(dto.lastServiceDate),
    dueKm: number(dto.dueKm), dueDate: maintenanceDate(dto.dueDate), remainingKm: Number.isFinite(dto.remainingKm) ? dto.remainingKm : null,
    remainingDays: Number.isSafeInteger(dto.remainingDays) ? dto.remainingDays : null, intervalKm: number(dto.intervalKm), intervalDays: integer(dto.intervalDays),
  };
}
function mapFleetRow(dto) {
  const next = dto.nextRequirement && typeof dto.nextRequirement === 'object' ? mapRequirement({ ruleId: 'next', ...dto.nextRequirement }) : null;
  return {
    id: dto.truck.id, plate: text(dto.truck.plateNumber) || '—', vehicleClass: text(dto.truck.vehicleClass), truckType: text(dto.truck.label) || '—',
    companyId: text(dto.company?.id), company: text(dto.company?.name) || '—',
    odometer: number(dto.odometerKm), odometerUpdated: maintenanceDate(dto.odometerUpdatedAt), odometerSource: text(dto.odometerSource),
    complianceStatus: text(dto.complianceStatus), next,
    restriction: dto.restriction && typeof dto.restriction === 'object' ? { id: text(dto.restriction.id), source: text(dto.restriction.source), reason: text(dto.restriction.reason) || '—' } : null,
    activeTripId: text(dto.activeTripId),
  };
}
function mapRule(dto) {
  const trigger = dto.trigger && typeof dto.trigger === 'object' ? { type: text(dto.trigger.type), interval: number(dto.trigger.interval) } : null;
  return {
    id: dto.id, name: text(dto.name) || '—', category: text(dto.category), trigger,
    dueSoonKm: number(dto.dueSoon?.km), dueSoonDays: integer(dto.dueSoon?.days), graceDays: integer(dto.graceDays),
    mandatory: bool(dto.mandatory), blocksAssignment: bool(dto.blocksAssignment),
    vehicleClasses: Array.isArray(dto.scope?.vehicleClasses) ? dto.scope.vehicleClasses.filter(text) : [],
    status: text(dto.status), version: integer(dto.version), trucksAffected: integer(dto.trucksAffected),
    updatedAt: maintenanceDate(dto.updatedAt), updatedBy: text(dto.updatedBy?.name) || '—',
  };
}
function mapException(dto) {
  return {
    id: dto.id, kind: text(dto.kind), truckId: text(dto.truck?.id), plate: text(dto.truck?.plateNumber) || '—', company: text(dto.company?.name) || '—',
    reason: text(dto.reason) || '—', actor: text(dto.actor?.name) || 'System', createdAt: maintenanceDate(dto.createdAt), open: bool(dto.open),
    tripId: text(dto.tripId),
  };
}
function ruleProblem(rule) {
  if (!text(rule.name) || rule.name.trim().length > 120) return 'Give the rule a name (up to 120 characters).';
  if (!text(rule.category)) return 'Choose a maintenance category.';
  if (!['KM', 'DAYS', 'ENGINE_HOURS'].includes(rule.triggerType)) return 'Choose what triggers this rule.';
  const interval = Number(rule.interval);
  if (!Number.isFinite(interval) || interval <= 0) return 'Enter an interval greater than zero.';
  if (rule.dueSoon !== '' && (!Number.isFinite(Number(rule.dueSoon)) || Number(rule.dueSoon) < 0 || Number(rule.dueSoon) >= interval)) return 'The due-soon warning must be smaller than the interval.';
  if (rule.graceDays !== '' && (!Number.isSafeInteger(Number(rule.graceDays)) || Number(rule.graceDays) < 0 || Number(rule.graceDays) > 60)) return 'Grace period must be 0–60 days.';
  return null;
}
function ruleBody(rule) {
  const dueSoon = rule.dueSoon === '' ? null : Number(rule.dueSoon);
  return {
    name: text(rule.name), category: rule.category,
    trigger: { type: rule.triggerType, interval: Number(rule.interval) },
    dueSoon: rule.triggerType === 'DAYS' ? { days: dueSoon } : { km: rule.triggerType === 'KM' ? dueSoon : null, days: null, hours: rule.triggerType === 'ENGINE_HOURS' ? dueSoon : null },
    graceDays: rule.graceDays === '' ? 0 : Number(rule.graceDays),
    mandatory: Boolean(rule.mandatory), blocksAssignment: Boolean(rule.mandatory && rule.blocksAssignment),
    scope: { vehicleClasses: rule.vehicleClasses || [] },
  };
}

const taggedApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminMaintenance', 'AdminMaintenanceRules'] });
export const maintenanceApi = taggedApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminMaintenance: builder.query({
      query: (args = {}) => ({ url: path, params: params(args) }),
      transformResponse: (response, _meta, args = {}) => mapList(response, args),
      providesTags: ['AdminMaintenance'],
    }),
    getAdminMaintenanceStats: builder.query({ query: () => ({ url: `${path}/stats`, params: { withinDays: 7 } }), transformResponse: mapStats, providesTags: ['AdminMaintenance'] }),
    getAdminMaintenanceAsset: builder.query({
      query: ({ truckId }) => `/admin/doc-review/trucks/${encodeURIComponent(truckId)}`,
      transformResponse: (response, _meta, { truckId }) => {
        const dto = unwrapApiResponseData(response);
        if (dto?.id !== truckId) throw new Error('The maintenance asset response returned a different truck.');
        const open = integer(dto.maintenance?.open);
        return { makeModel: [text(dto.make), text(dto.model)].filter(Boolean).join(' ') || '—', year: text(dto.year) ?? integer(dto.year) ?? '—', vin: text(dto.vin) || '—', noOpenIssues: open == null ? null : open === 0 };
      },
      providesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    getAdminMaintenanceDetail: builder.query({
      query: ({ id }) => `${path}/${encodeURIComponent(id)}`,
      transformResponse: (response, _meta, { id }) => {
        const dto = unwrapApiResponseData(response);
        if (dto?.id !== id) throw new Error('The maintenance record could not be confirmed. Please refresh.');
        return mapRecord(dto);
      },
      providesTags: ['AdminMaintenance'],
    }),
    getAdminMaintenanceTruckRecords: builder.query({
      async queryFn({ truckId }, _api, _options, fetch) {
        const rows = [], seen = new Set();
        let expectedTotal = null;
        try {
          for (let page = 1; page <= 500; page++) {
            const args = { truckId, tab: 'all', page, limit: 100 };
            const response = await fetch({ url: path, params: args });
            if (response.error) return response;
            const data = mapList(response.data, args);
            if (expectedTotal != null && expectedTotal !== data.pagination.total) return failure('Maintenance records changed while loading. Please try again.');
            expectedTotal = data.pagination.total;
            for (const row of data.rows) {
              if (row.truckId !== truckId || seen.has(row.id)) return failure('The truck maintenance history is incomplete or inconsistent.');
              seen.add(row.id); rows.push(row);
            }
            if (page >= data.pagination.totalPages) {
              if (rows.length !== expectedTotal) return failure('The truck maintenance history is incomplete.');
              const upcoming = rows.filter(r => r.status === 'Scheduled' && r.dueAt).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
              const last = rows.filter(r => r.statusCode === 'COMPLETED' && r.completedAt).sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
              return { data: {
                history: rows.map((r, i) => ({ id: r.id, n: i + 1, date: r.recordDate, odometer: r.odometer, serviceType: r.type, description: r.description, serviceCenter: r.serviceCenter, status: r.status })),
                upcoming: upcoming.map(r => ({ title: r.description, type: r.type, dueDate: r.dueDate, dueOdometer: null })),
                nextDueDate: upcoming[0]?.dueDate || '—', nextDueDays: upcoming[0]?.daysUntilDue ?? null,
                last: { date: last?.recordDate || '—', odometer: last?.odometer ?? null, serviceType: last?.type || '—' },
              } };
            }
          }
          return failure('The truck maintenance history exceeded the supported page limit.');
        } catch (error) { return failure(error.message); }
      },
      providesTags: ['AdminMaintenance'],
    }),
    getAdminMaintenanceTruckOptions: builder.query({
      async queryFn(_arg, _api, _options, fetch) {
        const rows = [], seen = new Set();
        let expectedTotal = null, expectedPages = null;
        try {
          for (let page = 1; page <= 500; page++) {
            const result = await fetch({ url: '/admin/doc-review/trucks', params: { tab: 'all', page, limit: 100 } });
            if (result.error) return result;
            const dto = unwrapApiResponseData(result.data), pagination = dto?.pagination || {};
            const total = integer(pagination.total), pages = integer(pagination.totalPages), limit = integer(pagination.limit);
            if (!Array.isArray(dto?.trucks) || total == null || pages == null || pagination.page !== page || !limit
              || dto.trucks.length > limit || pages !== Math.ceil(total / limit) && !(total === 0 && pages === 1)
              || expectedTotal != null && (total !== expectedTotal || pages !== expectedPages)) return failure('The truck list could not be loaded completely. Refresh before scheduling.');
            expectedTotal = total; expectedPages = pages;
            for (const truck of dto.trucks) {
              if (!text(truck?.id) || seen.has(truck.id)) return failure('The truck options returned missing or duplicate IDs.');
              seen.add(truck.id);
              if (text(truck.plateNumber)) rows.push({ id: truck.id, plate: truck.plateNumber.trim() });
            }
            if (page >= pages) return seen.size === total ? { data: rows } : failure('The truck options returned an incomplete collection.');
          }
          return failure('The truck options exceeded the supported page limit.');
        } catch (error) { return failure(error.message); }
      },
      providesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    getAdminMaintenanceUsage: builder.query({
      query: ({ truckId, from, to }) => ({ url: `${path}/trucks/${encodeURIComponent(truckId)}/usage`, params: { ...(from ? { from } : {}), ...(to ? { to } : {}) } }),
      transformResponse: mapUsage, providesTags: ['AdminMaintenance'],
    }),
    getAdminMaintenanceDocuments: builder.query({
      query: ({ id }) => `${path}/${encodeURIComponent(id)}/documents`,
      transformResponse: mapDocuments, providesTags: ['AdminMaintenance'],
    }),
    flagAdminMaintenance: builder.mutation({
      async queryFn({ id, reason }, _api, _options, fetch) {
        if (!text(id) || !text(reason)) return failure('Enter a reason for the review.');
        const result = await fetch({ url: `${path}/${encodeURIComponent(id)}/flag`, method: 'POST', body: { reason: reason.trim() } });
        if (result.error) return result;
        const dto = unwrapApiResponseData(result.data);
        return dto?.id === id && dto.flagged === true && dto.reviewStatus === 'PENDING_REVIEW' && text(dto.flagReason) && dateValue(dto.flaggedAt)
          ? { data: dto } : failure('The flag was sent, but its saved state could not be confirmed. Refresh before trying again.');
      },
      invalidatesTags: ['AdminMaintenance'],
    }),
    createAdminMaintenance: builder.mutation({
      async queryFn(form, _api, _options, fetch) {
        const cost = form.estimatedCost === '' ? null : Number(form.estimatedCost);
        if (!text(form.truckId) || !Object.hasOwn(types, form.type) || !Object.hasOwn(priorities, form.priority) || !text(form.description) || !dateValue(form.dueDate)) return failure('Select a truck and enter valid maintenance details.');
        if (cost != null && (number(cost) == null || !hasKoboPrecision(form.estimatedCost))) return failure('Enter a valid non-negative estimated cost with at most two decimal places.');
        if (form.description.trim().length > 1000 || (form.serviceCenterName || '').length > 120 || (form.serviceCenterLocation || '').length > 200 || (form.notes || '').length > 2000) return failure('The maintenance details exceed the supported field lengths.');
        const body = { truckId: form.truckId, type: form.type, priority: form.priority, description: form.description.trim(), dueDate: form.dueDate,
          ...(text(form.serviceCenterName) ? { serviceCenterName: form.serviceCenterName.trim() } : {}),
          ...(text(form.serviceCenterLocation) ? { serviceCenterLocation: form.serviceCenterLocation.trim() } : {}),
          ...(cost != null ? { estimatedCost: cost } : {}), ...(text(form.notes) ? { notes: form.notes.trim() } : {}) };
        const result = await fetch({ url: path, method: 'POST', body });
        if (result.error) return result;
        const dto = unwrapApiResponseData(result.data)?.maintenance;
        if (!text(dto?.id) || dto.status !== 'SCHEDULED' || dto.truck?.id !== form.truckId || dto.priority !== form.priority) return failure('Scheduling was sent, but the saved record could not be confirmed. Refresh before trying again.');
        try { return { data: mapRecord(dto) }; } catch (error) { return failure(error.message); }
      },
      invalidatesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    getAdminMaintenanceServiceCenters: builder.query({
      query: ({ page = 1, limit = 10, search } = {}) => ({ url: `${path}/service-centers`, params: { page, limit, ...(text(search) ? { search: search.trim() } : {}) } }),
      transformResponse: (response, _meta, { page: requestedPage = 1 } = {}) => {
        const dto = unwrapApiResponseData(response);
        const centers = dto?.centers;
        if (!Array.isArray(centers) || centers.some(item => !text(item?.id)) || new Set(centers.map(item => item.id)).size !== centers.length) throw new Error('The service centers response is missing valid records.');
        const p = dto.pagination || {};
        const page = integer(p.page), limit = integer(p.limit), total = integer(p.total), totalPages = integer(p.totalPages);
        if (page !== requestedPage || !limit || total == null || totalPages == null || centers.length > limit || centers.length > total
          || totalPages !== Math.ceil(total / limit) && !(total === 0 && totalPages === 1)
          || page > Math.max(1, totalPages) || total > 0 && !centers.length) throw new Error('The service centres could not be loaded completely. Please refresh.');
        return { rows: centers.map(item => ({ id: item.id, name: text(item.name) || '—', location: text(item.location) || '—' })), total, totalPages };
      }, providesTags: ['AdminMaintenance'],
    }),
    getAdminMaintenanceCalendar: builder.query({
      query: ({ from, to }) => ({ url: `${path}/calendar`, params: { from, to } }),
      transformResponse: (response) => {
        const dto = unwrapApiResponseData(response);
        if (!Array.isArray(dto?.days)) throw new Error('The maintenance calendar response is missing its days.');
        const rows = [];
        for (const day of dto.days) {
          if (!dateValue(day?.date) || !Array.isArray(day.items)) throw new Error('The maintenance calendar returned an invalid day.');
          for (const item of day.items) rows.push({ ...mapRecord(item), calendarDate: maintenanceDate(day.date) });
        }
        if (new Set(rows.map(item => item.id)).size !== rows.length) throw new Error('The maintenance calendar repeated a record.');
        return rows;
      }, providesTags: ['AdminMaintenance'],
    }),
    getAdminMaintenancePolicies: builder.query({
      query: () => `${path}/policies`,
      transformResponse: (response) => {
        const dto = unwrapApiResponseData(response) || {};
        return { overdueGraceDays: number(dto.overdueGraceDays), dueSoonDays: number(dto.dueSoonDays), mileageLimitKm: number(dto.mileageLimitKm) };
      }, providesTags: ['AdminMaintenance'],
    }),
    updateAdminMaintenancePolicies: builder.mutation({
      async queryFn(values, _api, _options, fetch) {
        const body = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === '' ? null : Number(value)]));
        if (number(body.overdueGraceDays) == null || body.overdueGraceDays > 60 || number(body.dueSoonDays) == null || body.dueSoonDays < 1 || body.dueSoonDays > 90 || number(body.mileageLimitKm) == null || body.mileageLimitKm < 500 || body.mileageLimitKm > 100000) return failure('Enter valid policy values within the displayed limits.');
        const result = await fetch({ url: `${path}/policies`, method: 'PATCH', body });
        if (result.error) return result;
        const dto = unwrapApiResponseData(result.data)?.policies;
        return Object.keys(body).every(key => dto?.[key] === body[key]) ? { data: dto }
          : failure('The policies were sent, but their saved values could not be confirmed. Refresh before trying again.');
      }, invalidatesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    exportAdminMaintenance: builder.query({
      query: (args = {}) => ({ url: `${path}/export`, params: Object.fromEntries(Object.entries(params(args)).filter(([key]) => !['page', 'limit'].includes(key))), responseHandler: 'text' }),
      transformResponse: (response) => {
        if (typeof response !== 'string' || !response.trim() || /^\s*[<{]/.test(response)) throw new Error('The maintenance export did not return CSV.');
        return response;
      },
    }),
    importAdminMaintenance: builder.mutation({
      query: (file) => { const body = new FormData(); body.append('file', file); return { url: `${path}/import`, method: 'POST', body }; },
      transformResponse: (response) => {
        const data = unwrapApiResponseData(response);
        if (integer(data?.created) == null || integer(data?.failed) == null || !Array.isArray(data?.results) || data.results.length !== data.created + data.failed || data.results.filter(r => r.status === 'CREATED').length !== data.created || data.results.filter(r => r.status === 'FAILED').length !== data.failed) throw new Error('The import response did not confirm its results. Check the maintenance list before importing again.');
        return { created: data.created, failed: data.failed, errors: data.results.filter(r => r.status === 'FAILED').map(r => `Line ${r.line}: ${text(r.error) || 'Import failed'}`) };
      },
      invalidatesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    updateAdminMaintenanceStatus: builder.mutation({
      async queryFn({ id, action }, _api, _options, fetch) {
        const expected = { start: 'IN_PROGRESS', complete: 'COMPLETED', cancel: 'CANCELLED' }[action];
        if (!text(id) || !expected) return failure('Unsupported maintenance action.');
        const result = await fetch({ url: `${path}/${encodeURIComponent(id)}/${action}`, method: 'POST' });
        if (result.error) return result;
        const confirmation = await fetch(`${path}/${encodeURIComponent(id)}`);
        if (confirmation.error) return failure('The update was accepted, but its final state could not be confirmed. Refresh before trying again.');
        const data = unwrapApiResponseData(confirmation.data);
        if (data?.id !== id || data.status !== expected) return failure('The updated maintenance status could not be confirmed. Refresh before trying again.');
        try { return { data: mapRecord(data) }; } catch (error) { return failure(error.message); }
      },
      invalidatesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    restrictAdminMaintenanceTruck: builder.mutation({
      async queryFn({ truckId, reference, reason }, _api, _options, fetch) {
        if (!text(truckId)) return failure('The maintenance record does not contain a truck ID.');
        const why = text(reason) || `Restricted from maintenance record ${reference}.`;
        if (why.length > 500) return failure('Keep the reason under 500 characters.');
        const result = await fetch({ url: `${path}/trucks/${encodeURIComponent(truckId)}/restrict`, method: 'POST', body: { reason: why } });
        if (result.error) return result;
        const confirmation = await fetch(`${path}/trucks/${encodeURIComponent(truckId)}/eligibility`);
        const data = unwrapApiResponseData(confirmation.data);
        if (confirmation.error || data?.id !== truckId || data.eligibleForJobs !== false || !dateValue(data.restrictedAt)) return failure('The restriction was accepted, but could not be confirmed. Refresh before trying again.');
        return { data: { restricted: true } };
      },
      invalidatesTags: ['AdminMaintenance', 'AdminFleet'],
    }),

    getAdminMaintenanceEligibility: builder.query({
      query: ({ truckId }) => `${path}/trucks/${encodeURIComponent(truckId)}/eligibility`,
      transformResponse: (response, _meta, { truckId }) => mapEligibility(unwrapApiResponseData(response), truckId),
      providesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    liftAdminMaintenanceRestriction: builder.mutation({
      async queryFn({ truckId, reason }, _api, _options, fetch) {
        if (!text(truckId)) return failure('This truck has no ID.');
        if (!text(reason)) return failure('Enter a reason. Every manual clear is audited.');
        if (reason.trim().length > 500) return failure('Keep the reason under 500 characters.');
        const result = await fetch({ url: `${path}/trucks/${encodeURIComponent(truckId)}/lift-restriction`, method: 'POST', body: { reason: reason.trim() } });
        if (result.error) return result;
        const confirmation = await fetch(`${path}/trucks/${encodeURIComponent(truckId)}/eligibility`);
        if (confirmation.error) return failure('The restriction was lifted, but the truck state could not be confirmed. Refresh before trying again.');
        try { return { data: mapEligibility(unwrapApiResponseData(confirmation.data), truckId) }; } catch (error) { return failure(error.message); }
      },
      invalidatesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    reviewAdminMaintenanceRequest: builder.mutation({
      async queryFn({ id, decision, reason, dueDate, serviceCenterName, serviceCenterLocation, notes }, _api, _options, fetch) {
        if (!text(id) || !['approve', 'reject'].includes(decision)) return failure('Unsupported review action.');
        if (decision === 'reject' && !text(reason)) return failure('Enter the reason the company will see.');
        if (dueDate && !dateValue(dueDate)) return failure('Enter a valid date.');
        const body = decision === 'reject' ? { reason: reason.trim() } : {
          ...(dueDate ? { dueDate } : {}),
          ...(text(serviceCenterName) ? { serviceCenterName: serviceCenterName.trim() } : {}),
          ...(text(serviceCenterLocation) ? { serviceCenterLocation: serviceCenterLocation.trim() } : {}),
          ...(text(notes) ? { notes: notes.trim() } : {}),
        };
        const result = await fetch({ url: `${path}/${encodeURIComponent(id)}/${decision}`, method: 'POST', body });
        if (result.error) return result;
        const confirmation = await fetch(`${path}/${encodeURIComponent(id)}`);
        const dto = unwrapApiResponseData(confirmation.data);
        const expected = decision === 'approve' ? 'SCHEDULED' : 'REJECTED';
        if (confirmation.error || dto?.id !== id || dto.status !== expected) return failure('The decision was sent, but the record could not be confirmed. Refresh before trying again.');
        try { return { data: mapRecord(dto) }; } catch (error) { return failure(error.message); }
      },
      invalidatesTags: ['AdminMaintenance'],
    }),
    // ---- Proposed endpoints (see the Fleet Maintenance backend brief) ----
    verifyAdminMaintenanceCompletion: builder.mutation({
      async queryFn({ id, decision, reason }, _api, _options, fetch) {
        if (!text(id) || !['verify', 'return'].includes(decision)) return failure('Unsupported verification action.');
        if (decision === 'return' && !text(reason)) return failure('Tell the company what to fix before resubmitting.');
        const result = await fetch({ url: `${path}/${encodeURIComponent(id)}/${decision}`, method: 'POST', body: decision === 'return' ? { reason: reason.trim() } : {} });
        if (result.error) return pending(result) || result;
        const dto = unwrapApiResponseData(result.data)?.maintenance;
        const expected = decision === 'verify' ? 'VERIFIED' : 'IN_PROGRESS';
        if (dto?.id !== id || dto.status !== expected) return failure('The decision was sent, but the record could not be confirmed. Refresh before trying again.');
        try { return { data: mapRecord(dto) }; } catch (error) { return failure(error.message); }
      },
      invalidatesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    getAdminMaintenanceSubmissions: builder.query({
      async queryFn(args = {}, _api, _options, fetch) {
        const query = { tab: 'submitted', page: args.page || 1, limit: args.limit || 10 };
        const result = await fetch({ url: path, params: query });
        // An older backend rejects the unknown `submitted` tab with 400.
        if (result.error) return pending(result, [400]) || result;
        try {
          const list = mapList(result.data, query);
          // An older backend ignores the unknown tab and returns every status.
          if (list.rows.some((row) => row.statusCode !== 'SUBMITTED')) return notLive;
          const raw = unwrapApiResponseData(result.data).maintenance;
          return { data: { ...list, rows: list.rows.map((row, index) => ({ ...row, completion: mapCompletion(raw[index]?.completion) })) } };
        } catch (error) { return failure(error.message); }
      },
      providesTags: ['AdminMaintenance'],
    }),
    getAdminMaintenanceFleet: builder.query({
      async queryFn(args = {}, _api, _options, fetch) {
        const params = Object.fromEntries(Object.entries(args).filter(([key, value]) => ['status', 'companyId', 'vehicleClass', 'restricted', 'search', 'page', 'limit'].includes(key) && value !== '' && value != null));
        const result = await fetch({ url: `${path}/fleet`, params });
        if (result.error) return pending(result) || result;
        const dto = unwrapApiResponseData(result.data);
        if (!Array.isArray(dto?.trucks)) return failure('The fleet compliance response is missing its trucks.');
        const p = dto.pagination || {};
        return { data: {
          rows: dto.trucks.filter((item) => text(item?.truck?.id)).map(mapFleetRow),
          pagination: { page: integer(p.page) ?? 1, total: integer(p.total), totalPages: integer(p.totalPages) ?? 1 },
          counts: Object.fromEntries(Object.entries(dto.counts || {}).map(([key, value]) => [key, integer(value)])),
        } };
      },
      providesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    getAdminMaintenanceRequirements: builder.query({
      async queryFn({ truckId }, _api, _options, fetch) {
        if (!text(truckId)) return failure('This truck has no ID.');
        const result = await fetch(`${path}/trucks/${encodeURIComponent(truckId)}/requirements`);
        if (result.error) return pending(result) || result;
        const dto = unwrapApiResponseData(result.data);
        if (!Array.isArray(dto?.requirements)) return failure('The requirements response is missing its list.');
        return { data: dto.requirements.filter((item) => text(item?.ruleId)).map(mapRequirement) };
      },
      providesTags: ['AdminMaintenance'],
    }),
    getAdminMaintenanceRules: builder.query({
      async queryFn(args = {}, _api, _options, fetch) {
        const result = await fetch({ url: `${path}/rules`, params: args.status ? { status: args.status } : {} });
        if (result.error) return pending(result) || result;
        const dto = unwrapApiResponseData(result.data);
        if (!Array.isArray(dto?.rules)) return failure('The rules response is missing its list.');
        return { data: dto.rules.filter((item) => text(item?.id)).map(mapRule) };
      },
      providesTags: ['AdminMaintenanceRules'],
    }),
    getAdminMaintenanceRule: builder.query({
      async queryFn({ id }, _api, _options, fetch) {
        const result = await fetch(`${path}/rules/${encodeURIComponent(id)}`);
        if (result.error) return pending(result) || result;
        const dto = unwrapApiResponseData(result.data);
        if (dto?.id !== id) return failure('The rule could not be confirmed. Please refresh.');
        return { data: { ...mapRule(dto), versions: Array.isArray(dto.versions) ? dto.versions.map((v) => ({ version: integer(v?.version), changedBy: text(v?.changedBy?.name) || '—', changedAt: maintenanceDate(v?.changedAt), reason: text(v?.reason) || '—' })) : [] } };
      },
      providesTags: ['AdminMaintenanceRules'],
    }),
    previewAdminMaintenanceRule: builder.mutation({
      async queryFn(rule, _api, _options, fetch) {
        const result = await fetch({ url: `${path}/rules/preview`, method: 'POST', body: ruleBody(rule) });
        if (result.error) return pending(result) || result;
        const dto = unwrapApiResponseData(result.data) || {};
        return { data: { trucksInScope: integer(dto.trucksInScope), wouldBeDue: integer(dto.wouldBeDue), wouldBeRestricted: integer(dto.wouldBeRestricted) } };
      },
    }),
    saveAdminMaintenanceRule: builder.mutation({
      async queryFn({ id, reason, ...rule }, _api, _options, fetch) {
        const problem = ruleProblem(rule);
        if (problem) return failure(problem);
        if (id && !text(reason)) return failure('Enter a reason for this change. Rule edits are versioned and audited.');
        const result = await fetch({ url: id ? `${path}/rules/${encodeURIComponent(id)}` : `${path}/rules`, method: id ? 'PATCH' : 'POST', body: { ...ruleBody(rule), ...(id ? { reason: reason.trim() } : {}) } });
        if (result.error) return pending(result) || result;
        const dto = unwrapApiResponseData(result.data)?.rule;
        if (!text(dto?.id) || (id && dto.id !== id)) return failure('The rule was sent, but the saved version could not be confirmed. Refresh before trying again.');
        return { data: mapRule(dto) };
      },
      invalidatesTags: ['AdminMaintenanceRules', 'AdminMaintenance', 'AdminFleet'],
    }),
    archiveAdminMaintenanceRule: builder.mutation({
      async queryFn({ id, reason }, _api, _options, fetch) {
        if (!text(reason)) return failure('Enter a reason for archiving this rule.');
        const result = await fetch({ url: `${path}/rules/${encodeURIComponent(id)}`, method: 'PATCH', body: { status: 'ARCHIVED', reason: reason.trim() } });
        if (result.error) return pending(result) || result;
        return unwrapApiResponseData(result.data)?.rule?.status === 'ARCHIVED' ? { data: true } : failure('The rule could not be confirmed as archived. Refresh before trying again.');
      },
      invalidatesTags: ['AdminMaintenanceRules', 'AdminMaintenance', 'AdminFleet'],
    }),
    getAdminMaintenanceExceptions: builder.query({
      async queryFn(args = {}, _api, _options, fetch) {
        const result = await fetch({ url: `${path}/exceptions`, params: { page: args.page || 1, limit: args.limit || 10, ...(args.kind ? { kind: args.kind } : {}) } });
        if (result.error) return pending(result) || result;
        const dto = unwrapApiResponseData(result.data);
        if (!Array.isArray(dto?.exceptions)) return failure('The exceptions response is missing its list.');
        const p = dto.pagination || {};
        return { data: { rows: dto.exceptions.filter((item) => text(item?.id)).map(mapException), pagination: { page: integer(p.page) ?? 1, total: integer(p.total), totalPages: integer(p.totalPages) ?? 1 } } };
      },
      providesTags: ['AdminMaintenance'],
    }),
    getAdminMaintenanceCompliance: builder.query({
      async queryFn(_args, _api, _options, fetch) {
        const result = await fetch(`${path}/reports/compliance`);
        if (result.error) return pending(result) || result;
        const dto = unwrapApiResponseData(result.data) || {};
        return { data: {
          complianceRate: percent(dto.complianceRate),
          assignmentRejections: integer(dto.assignmentRejections?.count),
          byCompany: Array.isArray(dto.byCompany) ? dto.byCompany.map((item) => ({ name: text(item?.name) || '—', rate: percent(item?.complianceRate), trucks: integer(item?.trucks), overdue: integer(item?.overdue) })) : [],
          byVehicleClass: Array.isArray(dto.byVehicleClass) ? dto.byVehicleClass.map((item) => ({ name: text(item?.label) || text(item?.vehicleClass) || '—', rate: percent(item?.complianceRate) })) : [],
        } };
      },
      providesTags: ['AdminMaintenance'],
    }),
  }),
});
export const { useGetAdminMaintenanceQuery, useGetAdminMaintenanceStatsQuery, useGetAdminMaintenanceAssetQuery, useGetAdminMaintenanceDetailQuery, useGetAdminMaintenanceTruckRecordsQuery, useLazyExportAdminMaintenanceQuery, useImportAdminMaintenanceMutation, useUpdateAdminMaintenanceStatusMutation, useRestrictAdminMaintenanceTruckMutation, useGetAdminMaintenanceUsageQuery, useGetAdminMaintenanceDocumentsQuery, useFlagAdminMaintenanceMutation, useCreateAdminMaintenanceMutation, useGetAdminMaintenanceTruckOptionsQuery, useGetAdminMaintenanceServiceCentersQuery, useGetAdminMaintenanceCalendarQuery, useGetAdminMaintenancePoliciesQuery, useUpdateAdminMaintenancePoliciesMutation, useGetAdminMaintenanceEligibilityQuery, useLiftAdminMaintenanceRestrictionMutation, useReviewAdminMaintenanceRequestMutation, useVerifyAdminMaintenanceCompletionMutation, useGetAdminMaintenanceSubmissionsQuery, useGetAdminMaintenanceFleetQuery, useGetAdminMaintenanceRequirementsQuery, useGetAdminMaintenanceRulesQuery, useGetAdminMaintenanceRuleQuery, usePreviewAdminMaintenanceRuleMutation, useSaveAdminMaintenanceRuleMutation, useArchiveAdminMaintenanceRuleMutation, useGetAdminMaintenanceExceptionsQuery, useGetAdminMaintenanceComplianceQuery } = maintenanceApi;
