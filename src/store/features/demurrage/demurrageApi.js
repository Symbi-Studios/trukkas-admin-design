import { defaultSerializeQueryArgs } from '@reduxjs/toolkit/query';
import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const records = (value) => Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) : [];
const number = (value) => {
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) value = Number(value);
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER ? value : null;
};
const count = (value) => Number.isSafeInteger(number(value)) && number(value) >= 0 ? number(value) : null;
const percent = (value) => number(value) != null && number(value) >= 0 && number(value) <= 100 ? number(value) : null;
const failure = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
const STATUSES = ['UPCOMING', 'ACTIVE', 'DISPUTED', 'RESOLVED', 'WAIVED'];
const financeRole = (api) => ['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(api.getState().auth.admin?.role);
const argumentsFor = value => typeof value === 'string' ? { id:value } : value || {};
function scopedQuery(baseQuery,api,args = {}) {
  const auth = api.getState().auth, owner = auth.admin?.id, role = auth.admin?.role;
  const current = () => { const next = api.getState().auth; return !api.signal.aborted && Boolean(next.accessToken) && owner && next.admin?.id === owner && next.admin?.role === role && (args.owner == null || args.owner === owner) && (args.role == null || args.role === role); };
  return async request => {
    if (!current()) return failure('Your session changed. Reopen Demurrage before continuing.');
    const result = await baseQuery(request);
    return current() ? result : failure('Your session changed. Reopen Demurrage before continuing.');
  };
}
const serializeDemurrageQuery = args => defaultSerializeQueryArgs(args)+':v2';
function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  if(value.length > 10) {
    const [hour,minute,second]=value.slice(11,19).split(':').map(Number),offset=value.match(/[+-](\d{2}):(\d{2})$/);
    if(hour>23 || minute>59 || second>59 || offset && (Number(offset[1])>23 || Number(offset[2])>59)) return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export const demurrageMoney = (value) => number(value) == null ? '—' : `₦${number(value).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const demurrageDays = (value) => number(value) == null ? '—' : `${number(value)} days`;
export const demurrageDetailUrl = (row) => `/demurrage/detail?id=${encodeURIComponent(row.chargeApiId)}`;
export const demurrageJobUrl = (id) => `/jobs/detail?id=${encodeURIComponent(id)}`;
export const demurrageRequestKey = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join('');
function date(value, withTime = false) {
  const parsed = timestamp(value);
  return parsed == null ? '—' : new Date(parsed).toLocaleString('en-US', {
    timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
function dateKey(value) {
  if (timestamp(value) == null) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const part = (name) => parts.find((entry) => entry.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function period(start, end) {
  return timestamp(start) != null && timestamp(end) != null && timestamp(end) >= timestamp(start) ? `${date(start)} – ${date(end)}` : '—';
}
function verification(party, fallback) {
  return label(party.verification?.kyc ?? party.verificationStatus ?? fallback);
}
function invoices(value) {
  return records(value).map((invoice) => ({
    id: text(invoice.id) || '—', date: date(invoice.date), period: period(invoice.period?.from, invoice.period?.to),
    days: number(invoice.days) ?? '—', rate: number(invoice.dailyRate), amount: number(invoice.amount),
    status: label(invoice.status), url: text(invoice.url), previewUrl: text(invoice.previewUrl), downloadUrl: text(invoice.downloadUrl),
  }));
}
export function adaptAdminDemurrage(value) {
  const dto = record(value), customer = record(dto.customer), trucker = record(dto.trucker);
  const containerNumbers = Array.isArray(dto.containerNumbers) ? dto.containerNumbers.map(text).filter(Boolean) : null;
  const start = timestamp(dto.cargoArrivedAt), end = timestamp(dto.freeUntil);
  const freeDays = number(dto.freeDays) ?? (number(dto.freeMinutes) == null ? null : number(dto.freeMinutes) / 1440) ?? (start != null && end != null && end >= start ? (end - start) / 86400000 : null);
  const chargeStartAt = text(dto.chargeStartAt);
  const chargeApiId = text(dto.id) || text(dto.demurrageId) || text(dto.reference);
  const events = records(dto.timeline);
  const ownContainers = records(dto.containers);
  const sizes = [...new Set(ownContainers.map(container => [text(container.size),text(container.type)].filter(Boolean).join(' / ')).filter(Boolean))];
  const event = (type, fallback, description) => {
    const entry = events.filter(item => (item.key || item.type) === type)
      .sort((a,b) => (timestamp(b.time || b.at || b.createdAt) ?? -Infinity) - (timestamp(a.time || a.at || a.createdAt) ?? -Infinity))[0];
    return { date: date(['SKIPPED','PENDING'].includes(entry?.outcome) ? null : entry?.time || entry?.at || entry?.createdAt || fallback, true), detail: text(entry?.description) || text(entry?.detail) || text(description) || '—' };
  };
  const arrived = event('ARRIVED', dto.cargoArrivedAt, freeDays == null ? null : `${freeDays} days free period granted`);
  const disputes = Array.isArray(dto.disputes) ? records(dto.disputes) : null;
  const validInvoices = Array.isArray(dto.invoices) && dto.invoices.every((item) => item && typeof item === 'object' && !Array.isArray(item));
  const disputeSummary = text(dto.disputeSummary) || (disputes?.length ? disputes.map((item) => [text(item.reason), text(item.details), text(item.status)].filter(Boolean).join(' — ')).filter(Boolean).join('\n') : null);
  return {
    key: chargeApiId, chargeApiId, jobApiId: text(dto.jobId), version: count(dto.version), source: text(dto.source),
    id: chargeApiId || '—', jobId: text(dto.jobNumber) || text(dto.jobId) || '—', jobType: text(dto.jobType) || '—',
    containerNumbers, container: text(dto.containerNumber) || (containerNumbers?.length ? containerNumbers.join(', ') : '—'),
    size: sizes.join(', ') || text(dto.size) || '—', vessel: text(dto.vessel) || '—', voyage: text(dto.voyage) || '—',
    customer: text(customer.name) || text(dto.forwarderName) || '—', customerType: text(customer.name) || text(dto.forwarderName) ? 'Forwarder' : '—',
    freeDays, freePeriod: period(dto.cargoArrivedAt, dto.freeUntil),
    cargoArrivedAt: text(dto.cargoArrivedAt), freeUntil: text(dto.freeUntil),
    daysUsed: number(dto.daysUsed), usedPeriod: period(dto.usedPeriod?.from, dto.usedPeriod?.to),
    charge: number(dto.amount), rate: number(dto.ratePerDay), statusCode: text(dto.status), status: dto.status === 'DISPUTED' ? 'Dispute' : label(dto.status),
    daysOver: number(dto.daysOver), overSince: text(dto.overdueDescription) || text(dto.overSince) || '—',
    chargeStartAt, chargeStart: date(chargeStartAt), chargeDate: dateKey(dto.source === 'MANUAL' || dto.source === 'manual' ? dto.createdAt : dto.freeUntil),
    dischargePort: text(dto.dischargePort?.name) || text(dto.dischargePort) || '—', dischargeDate: date(dto.dischargeDate),
    reference: text(dto.reference) || '—', paidAt: text(dto.paidAt), paid: number(dto.paidAmount), outstanding: number(dto.outstanding),
    note: text(dto.notes) || text(dto.note) || '—', noteValue: typeof dto.notes === 'string' ? dto.notes : typeof dto.note === 'string' ? dto.note : '—', noteUpdatedAt: date(dto.noteUpdatedAt),
    assignedTo: text(trucker.name) || text(dto.assignedTo) || '—', shippingLine: text(dto.shippingLine) || '—',
    customerEmail: text(customer.email) || text(dto.customerEmail) || '—', customerPhone: text(customer.phone) || text(dto.customerPhone) || '—',
    customerVerification: verification(customer, dto.customerVerification), lineVerification: label(dto.lineVerification),
    lineEmail: text(dto.lineEmail) || '—', linePhone: text(dto.linePhone) || '—',
    route: text(dto.route) || '—', createdOn: date(dto.createdAt, true), rateType: label(dto.rateType),
    subtotal: number(dto.subtotal), vat: number(dto.vat), vatPercent: percent(dto.vatPercent), formula: text(dto.formula) || '—',
    disputeSummary: disputeSummary || '—', invoiceUrl: text(dto.invoiceUrl), invoiceCount: validInvoices ? dto.invoices.length : null,
    invoices: validInvoices ? invoices(dto.invoices) : [],
    timeline: {
      dischargeCompleted: event('DISCHARGE', null, dto.dischargeDescription),
      freeStarted: arrived,
      freeEnded: event('FREE_PERIOD_END', end != null && end <= Date.now() ? dto.freeUntil : null),
      chargeStarted: event('CHARGE_START', chargeStartAt),
      current: { date: date(dto.updatedAt, true), detail: dto.status === 'DISPUTED' ? 'Dispute' : label(dto.status) },
      updated: { date: date(dto.updatedAt, true), detail: text(dto.updateDescription) || '—' },
    },
    history: { created: date(dto.createdAt, true), recalculated: event('RECALCULATED', dto.recalculatedAt).date, notified: event('CUSTOMER_NOTIFIED', dto.lastInvoiceEmailedAt).date },
    timestamp: timestamp(dto.createdAt) ?? timestamp(dto.cargoArrivedAt),
  };
}
export function mergeDemurrageDetail(row, job, invoiceData) {
  job = record(job);
  if (job.id !== row.jobApiId) job = {};
  const containers = records(job.containers).filter((container) => row.container !== '—' ? row.container.split(', ').includes(container.number) : !row.containerNumbers || row.containerNumbers.includes(container.number));
  const sizes = [...new Set(containers.map((container) => [text(container.size), text(container.type)].filter(Boolean).join(' / ')).filter(Boolean))];
  const pickup = text(job.pickup?.address) || text(job.pickup?.port), delivery = text(job.delivery?.address);
  return {
    ...row, jobId: text(job.jobNumber) || row.jobId, jobType: text(job.jobType) || text(job.tripType?.label) || row.jobType,
    container: row.container !== '—' ? row.container : containers.map((container) => text(container.number)).filter(Boolean).join(', ') || '—',
    size: row.size !== '—' ? row.size : sizes.join(', ') || '—',
    customer: row.customer !== '—' ? row.customer : text(job.forwarder?.name) || '—',
    customerEmail: row.customerEmail !== '—' ? row.customerEmail : text(job.forwarder?.email) || '—',
    customerPhone: row.customerPhone !== '—' ? row.customerPhone : text(job.forwarder?.phone) || '—',
    assignedTo: row.assignedTo !== '—' ? row.assignedTo : text(job.trucker?.name) || '—',
    route: row.route !== '—' ? row.route : pickup && delivery ? `${pickup} → ${delivery}` : '—',
    createdOn: timestamp(job.createdAt) == null ? row.createdOn : date(job.createdAt, true),
    invoices: invoiceData?.rows ?? row.invoices, invoiceCount: invoiceData?.rows?.length ?? row.invoiceCount,
  };
}
export function demurrageSummary(directory, stats) {
  const rows = directory?.rows;
  const known = rows && rows.every((row) => STATUSES.includes(row.statusCode));
  const resolved = known ? rows.filter((row) => row.statusCode === 'RESOLVED').length : null;
  return { active: stats?.active ?? null, activeAmount: stats?.activeAmount ?? null,
    upcoming: stats?.upcoming ?? null, upcomingAmount: stats?.upcomingAmount ?? null,
    resolved, resolvedThisMonth: stats?.resolvedThisMonth ?? null, resolvedAmountThisMonth: stats?.resolvedAmountThisMonth ?? null,
    collectedThisMonth: stats?.collectedThisMonth ?? null, collectionRateThisMonth: stats?.collectionRateThisMonth ?? null,
    disputes: stats?.disputes ?? null, disputeAmount: stats?.disputeAmount ?? null };
}
function adaptStats(response) {
  const dto = record(unwrapApiResponseData(response));
  return { active: count(dto.active?.count), activeAmount: number(dto.active?.amount),
    upcoming: count(dto.upcoming?.count), upcomingAmount: number(dto.upcoming?.estimatedAmount),
    resolvedThisMonth: count(dto.resolvedThisMonth?.count), resolvedAmountThisMonth: number(dto.resolvedThisMonth?.amount),
    collectedThisMonth: number(dto.collectedThisMonth), collectionRate: percent(dto.collectionRate?.percent), collectionRateThisMonth: percent(dto.collectionRateThisMonth?.percent),
    disputes: count(dto.disputes?.count), disputeAmount: number(dto.disputes?.amount) };
}
export function demurragePeriod(periodName, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year').value), month = Number(parts.find((part) => part.type === 'month').value);
  const firstMonth = periodName === 'Last Month' ? month - 1 : periodName === 'This Year' ? 1 : month;
  const lastMonth = periodName === 'Last Month' ? month - 1 : periodName === 'This Year' ? 12 : month;
  const start = new Date(Date.UTC(year, firstMonth - 1, 1)), end = new Date(Date.UTC(year, lastMonth, 0));
  return { dateFrom: `${start.toISOString().slice(0, 10)}T00:00:00+01:00`, dateTo: `${end.toISOString().slice(0, 10)}T23:59:59.999+01:00` };
}
function adaptPeriodSummary(response) {
  const dto = record(unwrapApiResponseData(response)), validCurrency = dto.currency === 'NGN';
  const buckets = Array.isArray(dto.statuses) ? dto.statuses : null;
  const styles = [['Active','ACTIVE','#f14b67'],['Upcoming','UPCOMING','#f2b400'],['Resolved','RESOLVED','#0da56a'],['Disputes','DISPUTED','#762ce8'],['Waived','WAIVED','var(--tk-ink-300)']];
  const find = status => { const rows = buckets?.filter(row => row?.status === status); return rows?.length === 1 ? rows[0] : null; };
  const nonnegative = value => number(value) != null && number(value) >= 0 ? number(value) : null;
  const items = styles.map(([name,status,color]) => {
    const row = find(status), amount = validCurrency ? nonnegative(row?.amount) : null, share = percent(row?.share);
    return { label:name,status,value:amount,share,count:count(row?.count),display:amount == null ? '—' : demurrageMoney(amount)+' ('+(share == null ? '—' : share+'%')+')',color };
  });
  const complete = buckets?.length === 5 && STATUSES.every(status => find(status)) && buckets.every(row => validCurrency && nonnegative(row?.amount) != null && percent(row?.share) != null && count(row?.count) != null);
  const sum = complete ? buckets.reduce((total,row) => total+number(row.amount),0) : null;
  const validShares = complete && (sum === 0 ? buckets.every(row => number(row.share) === 0) : Math.abs(buckets.reduce((total,row) => total+number(row.share),0)-100) <= 0.3);
  return { chart:validShares ? items.map(row => ({label:row.label,value:row.value,color:row.color})) : [],
    totalCharges:validCurrency ? nonnegative(dto.totalCharges) : null,totalCollected:validCurrency ? nonnegative(dto.totalCollected) : null,
    outstanding:validCurrency ? nonnegative(dto.outstanding) : null,waived:validCurrency ? nonnegative(dto.waived) : null,collectionRate:percent(dto.collectionRate),items };
}
async function readDirectory(baseQuery, api, filters = {}) {
  const { bucket,search,dateFrom,dateTo } = filters;
  const params = { bucket,search,dateFrom,dateTo };
  const rows = [], seen = new Set();
  let page = 1, total = null, pages = null;
  do {
    if (api.signal.aborted) return failure('Demurrage loading was cancelled.');
    const result = await baseQuery({ url: '/admin/demurrage', params: { ...params, page, limit: 100 } });
    if (result.error) return { error: result.error };
    const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination);
    if (!Array.isArray(dto.demurrage) || pagination.page !== page || !Number.isInteger(pagination.total) || pagination.total < 0
      || !Number.isInteger(pagination.totalPages) || pagination.totalPages < 0 || !Number.isInteger(pagination.limit) || pagination.limit <= 0
      || pagination.limit > 100 || pagination.totalPages > 500 || dto.demurrage.length > pagination.limit
      || (Math.ceil(pagination.total / pagination.limit) !== pagination.totalPages && !(pagination.total === 0 && pagination.totalPages === 1))) return failure('The demurrage response is missing valid records or pagination.');
    if (page === 1) { total = pagination.total; pages = Math.max(1, pagination.totalPages); }
    if (pagination.total !== total || Math.max(1, pagination.totalPages) !== pages) return failure('Demurrage records changed while loading. Please refresh.');
    for (const value of dto.demurrage) {
      const row = adaptAdminDemurrage(value), id = row.chargeApiId;
      if (!id || seen.has(id)) return failure('The demurrage response contains missing or repeated charge IDs.');
      seen.add(id); rows.push(row);
    }
    if (page < pages && !dto.demurrage.length) return failure('The demurrage response returned an incomplete page.');
    page += 1;
  } while (page <= pages);
  if (rows.length !== total) return failure('The complete demurrage list could not be loaded.');
  rows.sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity));
  return { data: { rows, total } };
}
async function readCharge(baseQuery, id) {
  if (!text(id)) return failure('A demurrage charge ID is required.');
  const result = await baseQuery({ url: `/admin/demurrage/${encodeURIComponent(id)}` });
  if (result.error) return { error: result.error };
  const row = adaptAdminDemurrage(unwrapApiResponseData(result.data));
  return row.chargeApiId && (row.chargeApiId === id || row.reference === id) ? { data: row } : failure('The server did not return the requested demurrage charge.');
}
const financialTags = ['AdminDemurrage', 'AdminPricingConfig', 'AdminJobs', 'AdminTransactions', 'AdminCompanies', 'AdminForwarders', 'AdminDrivers', 'AdminEscrowOverview', 'AdminEscrowLedger', 'AdminEscrowAccounts', 'AdminEscrowActivity', 'AdminEscrowAlerts', 'AdminEscrowHolds', 'AdminEscrowReleases', 'AdminEscrowDisputes', 'AdminJobSettlements', 'AdminSettlements', 'AdminSettlementSummary', 'AdminSettlementAlerts', 'AdminPayoutDirectory', 'AdminPayoutWithdrawalStats'];
const invalidate = (_result, error) => !error || error.status === 'CUSTOM_ERROR' || error.status === 'FETCH_ERROR' || error.status === 'PARSING_ERROR' || Number(error.status) >= 500 ? financialTags : [];
async function confirmedAction(baseQuery, id, path, method, body, headers) {
  const result = await baseQuery({ url: `/admin/demurrage/${encodeURIComponent(id)}/${path}`, method, body, headers });
  if (result.error) return { error: result.error };
  const dto = record(unwrapApiResponseData(result.data));
  const confirmed = path === 'notes' ? dto.id === id && typeof dto.note === 'string' && dto.note === body.note
    : path === 'disputes' ? text(dto.disputeId) && dto.status === 'OPEN' && dto.demurrageStatus === 'DISPUTED'
    : path === 'email-invoice' ? dto.deliveryStatus === 'SENT' && timestamp(dto.sentAt) != null
    : dto.id === id && dto.status === (body.method === 'COLLECT' ? 'RESOLVED' : 'WAIVED') && number(dto.outstanding) === 0 && count(dto.version) != null && dto.version > body.expectedVersion && number(dto.amount) != null && number(dto.amount) >= 0 && number(dto.paidAmount) != null && number(dto.paidAmount) >= 0;
  return confirmed ? { data: dto } : failure('The action was sent but could not be confirmed. Refresh before trying again.');
}
export const demurrageApi = baseApi.enhanceEndpoints({ addTagTypes: [...financialTags, 'AdminDemurrageCalculation'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminDemurrageDirectory: builder.query({ serializeQueryArgs:serializeDemurrageQuery, queryFn: (args = {}, api, _options, baseQuery) => readDirectory(scopedQuery(baseQuery,api,args), api, args), providesTags: ['AdminDemurrage', 'AdminJobs'] }),
    getAdminDemurrageStats: builder.query({ serializeQueryArgs:serializeDemurrageQuery, async queryFn(args,api,_options,baseQuery) { const result = await scopedQuery(baseQuery,api,args)({url:'/admin/demurrage/stats'}); return result.error ? result : {data:adaptStats(result.data)}; }, providesTags: ['AdminDemurrage'] }),
    getAdminDemurrageSummary: builder.query({ serializeQueryArgs:serializeDemurrageQuery, async queryFn(args = {},api,_options,baseQuery) { const result = await scopedQuery(baseQuery,api,args)({url:'/admin/demurrage/summary',params:{dateFrom:args.dateFrom,dateTo:args.dateTo}}); return result.error ? result : {data:adaptPeriodSummary(result.data)}; }, providesTags: ['AdminDemurrage'] }),
    getAdminDemurrageDetail: builder.query({ serializeQueryArgs:serializeDemurrageQuery, queryFn: (value, api, _options, baseQuery) => { const args=argumentsFor(value); return readCharge(scopedQuery(baseQuery,api,args), args.id); }, providesTags: ['AdminDemurrage', 'AdminJobs'] }),
    getAdminDemurrageDisputes: builder.query({ serializeQueryArgs:serializeDemurrageQuery,
      async queryFn(value,api,_options,baseQuery) {
        const args=argumentsFor(value),result=await scopedQuery(baseQuery,api,args)({url:'/admin/demurrage/'+encodeURIComponent(args.id)+'/disputes'});
        if (result.error) return result;
        const dto=record(unwrapApiResponseData(result.data));
        return {data:{summary:Array.isArray(dto.disputes) ? records(dto.disputes).map(item=>[text(item.reason),text(item.details),text(item.status)].filter(Boolean).join(' — ')).filter(Boolean).join('\n') || '—' : null}};
      }, providesTags:['AdminDemurrage'],
    }),
    getAdminDemurrageInvoices: builder.query({ serializeQueryArgs:serializeDemurrageQuery,
      async queryFn(value,api,_options,baseQuery) {
        const args=argumentsFor(value),result=await scopedQuery(baseQuery,api,args)({url:'/admin/demurrage/'+encodeURIComponent(args.id)+'/invoices'});
        if(result.error) return result;
        const dto=record(unwrapApiResponseData(result.data));
        if(!Array.isArray(dto.invoices) || dto.invoices.some(row=>!text(row?.id)) || new Set(dto.invoices.map(row=>row.id)).size!==dto.invoices.length) return failure('The invoice response is incomplete.');
        return {data:{rows:invoices(dto.invoices)}};
      }, providesTags:['AdminDemurrage'],
    }),
    getAdminDemurrageBulkCalculation: builder.query({ serializeQueryArgs:serializeDemurrageQuery,
      async queryFn(args, api, _options, baseQuery) {
        const { ids,owner,role } = args;
        baseQuery = scopedQuery(baseQuery,api,args);
        const directory = demurrageApi.endpoints.getAdminDemurrageDirectory.select({owner,role})(api.getState()).data;
        const allowed = new Set(directory?.rows.map((row) => row.chargeApiId));
        if (!Array.isArray(ids) || !ids.length || ids.some((id) => !text(id) || !allowed.has(id)) || new Set(ids).size !== ids.length) return failure('Load and select valid demurrage charges before calculating.');
        const calculations = [];
        for (let start = 0; start < ids.length; start += 4) {
          if (api.signal.aborted) return failure('Demurrage calculation was cancelled.');
          const results = await Promise.all(ids.slice(start, start + 4).map(async (id) => ({ id, result: await readCharge(baseQuery, id) })));
          for (const { id, result } of results) { if (result.error) return { error: result.error }; calculations.push({ id, data: result.data }); }
        }
        return { data: { calculations, count: calculations.length } };
      },
      async onQueryStarted(_ids, { dispatch, queryFulfilled }) {
        try { await queryFulfilled; dispatch(demurrageApi.util.invalidateTags(['AdminDemurrage'])); }
        catch { /* Existing toast reports failed reads. */ }
      },
    }),
    getAdminDemurrageJobContext: builder.query({ serializeQueryArgs:serializeDemurrageQuery, async queryFn(value,api,_options,baseQuery) { const args=argumentsFor(value),result=await scopedQuery(baseQuery,api,args)({url:'/admin/jobs/'+encodeURIComponent(args.id)}); if(result.error) return result; const dto=record(unwrapApiResponseData(result.data)); return dto.id===args.id ? {data:dto} : failure('The job does not belong to this demurrage charge.'); }, providesTags: ['AdminJobs'] }),
    getAdminDemurrageInvoice: builder.query({ serializeQueryArgs:serializeDemurrageQuery,
      async queryFn(args, api, _options, baseQuery) {
        const { id,preview=false } = args;
        baseQuery = scopedQuery(baseQuery,api,args);
        const result = await baseQuery({ url: `/admin/demurrage/${encodeURIComponent(id)}/invoice`, params: { disposition: preview ? 'inline' : 'attachment' }, headers: { Accept: 'application/pdf' }, responseHandler: async (response) => {
          if (response.ok) return response.blob();
          const body = await response.text(); try { return JSON.parse(body); } catch { return { message: 'Unable to download the demurrage invoice.' }; }
        } });
        if (result.error) return { error: result.error };
        if (!(result.data instanceof Blob) || await result.data.slice(0, 5).text() !== '%PDF-') return failure('The server did not return a valid PDF invoice.');
        return { data: { url: URL.createObjectURL(result.data), name: `demurrage-${id}.pdf` } };
      },
    }),
    createAdminDemurrage: builder.mutation({
      async queryFn(form, api, _options, baseQuery) {
        baseQuery = scopedQuery(baseQuery,api,form);
        if (!financeRole(api)) return failure('Only Super Admins and Finance Admins can create charges.');
        const daysOver = number(form.daysOver), freeDays = form.freeDays === '' ? null : number(form.freeDays), ratePerDay = form.rate === '' ? null : number(form.rate);
        if (!text(form.jobId) || !text(form.container) || !text(form.customer) || daysOver == null || daysOver < 0 || (form.freeDays !== '' && (freeDays == null || freeDays < 0)) || (form.rate !== '' && (ratePerDay == null || ratePerDay < 0))) return failure('Enter a job ID, container, customer and valid non-negative charge values.');
        const body = { jobId: text(form.jobId), containerNumber: text(form.container), customerName: text(form.customer), daysOver, ...(freeDays == null ? {} : { freeDays }), ...(ratePerDay == null ? {} : { ratePerDay }) };
        const result = await baseQuery({ url: '/admin/demurrage', method: 'POST', body });
        if (result.error) return { error: result.error };
        const dto = record(unwrapApiResponseData(result.data)), row = adaptAdminDemurrage(dto);
        return row.chargeApiId && row.jobApiId === body.jobId && STATUSES.includes(row.statusCode) ? { data: { id: row.chargeApiId, warning: text(dto.warning) } } : failure('The create request was sent but could not be confirmed. Check the charge list before creating again.');
      }, invalidatesTags: invalidate,
    }),
    saveAdminDemurrageNote: builder.mutation({ queryFn: (args, api, _options, baseQuery) => { const {id,note}=args; return typeof note !== 'string' || !text(id) ? failure('A charge ID and note are required.') : confirmedAction(scopedQuery(baseQuery,api,args), id, 'notes', 'PATCH', { note }); }, invalidatesTags: (_result, error) => !error || error.status === 'CUSTOM_ERROR' ? ['AdminDemurrage'] : [] }),
    raiseAdminDemurrageDispute: builder.mutation({ queryFn: (args, api, _options, baseQuery) => { const {id,reason,details}=args; return !text(id) || !text(reason) ? failure('A charge ID and dispute reason are required.') : confirmedAction(scopedQuery(baseQuery,api,args), id, 'disputes', 'POST', { reason: text(reason), ...(text(details) ? { details: text(details) } : {}) }); }, invalidatesTags: invalidate }),
    resolveAdminDemurrage: builder.mutation({
      queryFn: (args, api, _options, baseQuery) => {
        const {id,method,reason,expectedVersion,key}=args;
        baseQuery = scopedQuery(baseQuery,api,args);
        if (!financeRole(api)) return failure('Only Super Admins and Finance Admins can resolve charges.');
        if (!text(id) || !['COLLECT', 'WAIVE'].includes(method) || count(expectedVersion) == null || !/^[A-Za-z0-9_-]{8,128}$/.test(key || '') || (method === 'WAIVE' && !text(reason))) return failure('Load the current charge version and select a valid resolution method. A waiver requires a reason.');
        return confirmedAction(baseQuery, id, 'resolve', 'POST', { method, expectedVersion, ...(text(reason) ? { reason: text(reason) } : {}) }, { 'x-idempotency-key': key });
      }, invalidatesTags: invalidate,
    }),
    emailAdminDemurrageInvoice: builder.mutation({ queryFn: (args, api, _options, baseQuery) => { const {id,key}=args; return !text(id) || !/^[A-Za-z0-9_-]{8,128}$/.test(key || '') ? failure('A valid charge ID and request key are required.') : confirmedAction(scopedQuery(baseQuery,api,args), id, 'email-invoice', 'POST', undefined, { 'x-idempotency-key': key }); }, invalidatesTags: (_result, error) => !error || error.status === 'CUSTOM_ERROR' ? ['AdminDemurrage'] : [] }),
    getAdminDemurrageRules: builder.query({ serializeQueryArgs:serializeDemurrageQuery,
      async queryFn(args,api,_options,baseQuery) {
        const result=await scopedQuery(baseQuery,api,args)({url:'/admin/config'});
        if(result.error) return result;
        const config=record(unwrapApiResponseData(result.data)?.config),values=record(config.demurrage);
        return {data:{freeDays:number(values.freeMinutes)==null?null:number(values.freeMinutes)/1440,rate:number(values.ratePerDay)}};
      }, providesTags:['AdminPricingConfig'],
    }),
    updateAdminDemurrageRules: builder.mutation({
      async queryFn(values, api, _options, baseQuery) {
        baseQuery = scopedQuery(baseQuery,api,values);
        if (api.getState().auth.admin?.role !== 'SUPER_ADMIN') return failure('Only Super Admins can update demurrage rules.');
        const freeDays = number(values.freeDays), rate = number(values.rate);
        if (freeDays == null || freeDays * 1440 < 1 || rate == null || rate < 0) return failure('Enter valid free days (at least one minute) and a non-negative daily rate.');
        const result = await baseQuery({ url: '/admin/config', method: 'POST', body: { demurrageGracePeriodMinutes: freeDays * 1440, demurrageRatePerDay: rate } });
        if (result.error) return { error: result.error };
        const dto = record(unwrapApiResponseData(result.data)), updates = record(dto.updates);
        if (!text(dto.message)) return failure('The server did not confirm the rules update. Refresh the settings before trying again.');
        if (number(updates.demurrageGracePeriodMinutes) !== freeDays * 1440 || number(updates.demurrageRatePerDay) !== rate) {
          const confirmation = await baseQuery({ url: '/admin/config' });
          const saved = record(unwrapApiResponseData(confirmation.data)?.config?.demurrage);
          if (confirmation.error || number(saved.freeMinutes) !== freeDays * 1440 || number(saved.ratePerDay) !== rate)
            return failure('The rules update was sent, but both saved values could not be confirmed. Refresh the settings before saving again.');
        }
        return { data: { message: text(dto.message) } };
      }, invalidatesTags: ['AdminPricingConfig', 'AdminDemurrage', 'AdminDemurrageCalculation'],
    }),
  }),
});
export const { useGetAdminDemurrageDirectoryQuery, useGetAdminDemurrageStatsQuery, useGetAdminDemurrageSummaryQuery, useGetAdminDemurrageDetailQuery,
  useGetAdminDemurrageInvoicesQuery, useGetAdminDemurrageDisputesQuery, useLazyGetAdminDemurrageBulkCalculationQuery, useGetAdminDemurrageJobContextQuery, useLazyGetAdminDemurrageInvoiceQuery,
  useCreateAdminDemurrageMutation, useSaveAdminDemurrageNoteMutation, useRaiseAdminDemurrageDisputeMutation, useResolveAdminDemurrageMutation,
  useEmailAdminDemurrageInvoiceMutation, useGetAdminDemurrageRulesQuery, useUpdateAdminDemurrageRulesMutation } = demurrageApi;
