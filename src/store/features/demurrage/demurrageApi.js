import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const records = (value) => Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) : [];
const number = (value) => {
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) value = Number(value);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};
const failure = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
const timestamp = (value) => text(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
export const demurrageMoney = (value) => number(value) == null ? '—' : `₦${number(value).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const demurrageDays = (value) => number(value) == null ? '—' : `${number(value)} days`;
export const demurrageDetailUrl = (row) => `/demurrage/detail?jobId=${encodeURIComponent(row.jobApiId)}`;
export const demurrageJobUrl = (id) => `/jobs/detail?id=${encodeURIComponent(id)}`;
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

export function adaptAdminDemurrage(dto) {
  const containerNumbers = Array.isArray(dto.containerNumbers) ? dto.containerNumbers.map(text).filter(Boolean) : null;
  const start = timestamp(dto.cargoArrivedAt), end = timestamp(dto.freeUntil);
  const freeDays = number(dto.freeDays) ?? (start != null && end != null && end >= start ? (end - start) / 86400000 : null);
  const chargeStartAt = text(dto.chargeStartAt);
  return {
    key: text(dto.jobId), jobApiId: text(dto.jobId), id: text(dto.id) || text(dto.demurrageId) || '—',
    jobId: text(dto.jobNumber) || text(dto.jobId) || '—', jobType: text(dto.jobType) || '—',
    containerNumbers, container: containerNumbers?.length ? containerNumbers.join(', ') : '—',
    size: text(dto.size) || '—', vessel: text(dto.vessel) || '—', voyage: text(dto.voyage) || '—',
    customer: text(dto.forwarderName) || '—', customerType: text(dto.forwarderName) ? 'Forwarder' : '—',
    freeDays, freePeriod: period(dto.cargoArrivedAt, dto.freeUntil),
    cargoArrivedAt: text(dto.cargoArrivedAt), freeUntil: text(dto.freeUntil),
    daysUsed: number(dto.daysUsed), usedPeriod: text(dto.usedPeriod) || '—',
    charge: number(dto.amount), rate: number(dto.ratePerDay), statusCode: text(dto.status), status: label(dto.status),
    daysOver: number(dto.daysOver), overSince: text(dto.overSince) || '—',
    chargeStartAt, chargeStart: date(chargeStartAt), chargeDate: dateKey(chargeStartAt),
    dischargePort: text(dto.dischargePort) || '—', dischargeDate: date(dto.dischargeDate),
    reference: text(dto.reference) || '—', paidAt: text(dto.paidAt), paid: number(dto.paidAmount), outstanding: number(dto.outstanding),
    note: text(dto.note) || '—', noteUpdatedAt: date(dto.noteUpdatedAt),
    assignedTo: text(dto.assignedTo) || '—', shippingLine: text(dto.shippingLine) || '—',
    customerEmail: text(dto.customerEmail) || '—', customerPhone: text(dto.customerPhone) || '—',
    customerVerification: label(dto.customerVerification), lineVerification: label(dto.lineVerification),
    lineEmail: text(dto.lineEmail) || '—', linePhone: text(dto.linePhone) || '—',
    route: text(dto.route) || '—', createdOn: date(dto.createdAt, true), rateType: text(dto.rateType) || '—',
    subtotal: number(dto.subtotal), vat: number(dto.vat), formula: text(dto.formula) || '—',
    disputeSummary: text(dto.disputeSummary) || '—', invoiceUrl: text(dto.invoiceUrl),
    invoiceCount: Array.isArray(dto.invoices) ? dto.invoices.length : null,
    invoices: records(dto.invoices).map((invoice) => ({
      id: text(invoice.id) || '—', date: date(invoice.createdAt), period: text(invoice.period) || '—',
      days: number(invoice.days) ?? '—', rate: number(invoice.rate), amount: number(invoice.amount),
      status: label(invoice.status), url: text(invoice.url),
    })),
    timeline: {
      dischargeCompleted: { date: date(dto.dischargeCompletedAt, true), detail: text(dto.dischargeDescription) || '—' },
      freeStarted: { date: date(dto.cargoArrivedAt, true), detail: freeDays == null ? '—' : `${freeDays} days free period granted` },
      freeEnded: { date: end != null && end <= Date.now() ? date(dto.freeUntil, true) : '—', detail: '—' },
      chargeStarted: { date: date(chargeStartAt, true), detail: '—' },
      current: { date: date(dto.updatedAt, true), detail: label(dto.status) },
      updated: { date: date(dto.updatedAt, true), detail: text(dto.updateDescription) || '—' },
    },
    history: { created: date(dto.createdAt, true), recalculated: date(dto.recalculatedAt, true), notified: date(dto.customerNotifiedAt, true) },
    timestamp: timestamp(dto.createdAt) ?? timestamp(dto.cargoArrivedAt),
  };
}

export function mergeDemurrageDetail(row, calculation, job) {
  calculation = record(calculation); job = record(job);
  if (job.id !== row.jobApiId) job = {};
  const containers = records(job.containers).filter((container) => !row.containerNumbers || row.containerNumbers.includes(container.number));
  const sizes = [...new Set(containers.map((container) => [text(container.size), text(container.type)].filter(Boolean).join(' / ')).filter(Boolean))];
  const pickup = text(job.pickup?.address) || text(job.pickup?.port), delivery = text(job.delivery?.address);
  // Job TDO/freeDays and cargo-arrival demurrage are distinct time windows.
  // Never use port discharge dates, current config or paidAt to fabricate
  // this record's historical rate, invoice, VAT or amount already collected.
  const chargeStartAt = text(calculation.demurrageStartedAt) || row.chargeStartAt;
  const historicalCharge = row.statusCode === 'RESOLVED' || calculation.status === 'paid';
  const freeDays = row.freeDays ?? (number(calculation.freeWindowMinutes) == null ? null : number(calculation.freeWindowMinutes) / 1440);
  const result = {
    ...row, jobId: text(job.jobNumber) || row.jobId, jobType: text(job.jobType) || text(job.tripType?.label) || row.jobType,
    container: row.container !== '—' ? row.container : containers.map((container) => text(container.number)).filter(Boolean).join(', ') || '—',
    size: row.size !== '—' ? row.size : sizes.join(', ') || '—',
    customer: text(job.forwarder?.name) || row.customer,
    customerType: text(job.forwarder?.name) ? 'Forwarder' : row.customerType,
    customerEmail: text(job.forwarder?.email) || row.customerEmail, customerPhone: text(job.forwarder?.phone) || row.customerPhone,
    assignedTo: text(job.trucker?.name) || row.assignedTo,
    route: pickup && delivery ? `${pickup} → ${delivery}` : row.route,
    createdOn: timestamp(job.createdAt) == null ? row.createdOn : date(job.createdAt, true),
    charge: historicalCharge ? row.charge : number(calculation.demurrageAmount) ?? row.charge,
    rate: historicalCharge ? row.rate : number(calculation.ratePerDay) ?? row.rate,
    freeDays, chargeStartAt, chargeStart: date(chargeStartAt), chargeDate: dateKey(chargeStartAt),
    subtotal: number(calculation.subtotal) ?? row.subtotal, vat: number(calculation.vat) ?? row.vat,
    formula: text(calculation.formula) || row.formula,
    timeline: { ...row.timeline, chargeStarted: { date: date(chargeStartAt, true), detail: '—' },
      current: { ...row.timeline.current, detail: text(calculation.message) || row.timeline.current.detail } },
  };
  return result;
}

export function demurrageSummary(directory) {
  const rows = directory?.rows;
  const count = (status) => rows && rows.every((row) => row.statusCode != null) ? rows.filter((row) => row.statusCode === status).length : null;
  const activeRows = rows?.filter((row) => row.statusCode === 'ACTIVE');
  const activeAmount = activeRows && rows.every((row) => row.statusCode != null) && activeRows.every((row) => row.charge != null)
    ? activeRows.reduce((sum, row) => sum + row.charge, 0) : null;
  return {
    active: count('ACTIVE'), upcoming: count('UPCOMING'), resolved: count('RESOLVED'),
    disputes: rows?.some((row) => row.statusCode === 'DISPUTE') ? count('DISPUTE') : null,
    activeAmount, upcomingAmount: null, resolvedThisMonth: null, resolvedAmountThisMonth: null,
    collectedThisMonth: null, collectionRateThisMonth: null, disputeAmount: null,
  };
}

async function readDirectory(baseQuery, api) {
  const rows = [], seen = new Set();
  let page = 1, total = null, pages = null;
  do {
    if (api.signal.aborted) return failure('Demurrage loading was cancelled.');
    const result = await baseQuery({ url: '/admin/demurrage', params: { page, limit: 100 } });
    if (result.error) return { error: result.error };
    const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination);
    if (!Array.isArray(dto.demurrage) || pagination.page !== page || !Number.isInteger(pagination.total) || pagination.total < 0
      || !Number.isInteger(pagination.totalPages) || pagination.totalPages < 0 || !Number.isInteger(pagination.limit) || pagination.limit <= 0
      || (Math.ceil(pagination.total / pagination.limit) !== pagination.totalPages && !(pagination.total === 0 && pagination.totalPages === 1))) return failure('The demurrage response is missing valid records or pagination.');
    if (page === 1) { total = pagination.total; pages = Math.max(1, pagination.totalPages); }
    if (pagination.total !== total || Math.max(1, pagination.totalPages) !== pages) return failure('Demurrage records changed while loading. Please refresh.');
    for (const entry of dto.demurrage) {
      const id = text(entry?.jobId);
      if (!id || seen.has(id)) return failure('The demurrage response contains missing or repeated job IDs.');
      seen.add(id); rows.push(adaptAdminDemurrage(entry));
    }
    if (page < pages && !dto.demurrage.length) return failure('The demurrage response returned an incomplete page.');
    page += 1;
  } while (page <= pages);
  if (rows.length !== total) return failure('The complete demurrage list could not be loaded.');
  rows.sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity));
  return { data: { rows, total } };
}

async function calculationResult(id, baseQuery) {
  const result = await baseQuery({ url: `/jobs/${encodeURIComponent(id)}/demurrage` });
  if (result.error) return { error: result.error };
  const dto = record(unwrapApiResponseData(result.data));
  return text(dto.status) ? { data: dto } : failure('The demurrage calculation response is missing its status.');
}

function updateCalculatedRows(dispatch, calculations) {
  dispatch(demurrageApi.util.updateQueryData('getAdminDemurrageDirectory', undefined, (directory) => {
    for (const { id, data } of calculations) {
      const row = directory.rows.find((entry) => entry.jobApiId === id);
      if (!row) continue;
      const historicalCharge = row.statusCode === 'RESOLVED' || data.status === 'paid';
      if (!historicalCharge && number(data.demurrageAmount) != null) row.charge = number(data.demurrageAmount);
      if (!historicalCharge && number(data.ratePerDay) != null) row.rate = number(data.ratePerDay);
      if (timestamp(data.demurrageStartedAt) != null) {
        row.chargeStartAt = data.demurrageStartedAt; row.chargeStart = date(data.demurrageStartedAt); row.chargeDate = dateKey(data.demurrageStartedAt);
        row.timeline.chargeStarted.date = date(data.demurrageStartedAt, true);
      }
    }
  }));
}

export const demurrageApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminDemurrage', 'AdminDemurrageCalculation'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminDemurrageDirectory: builder.query({
      queryFn: (_args, api, _options, baseQuery) => readDirectory(baseQuery, api), providesTags: ['AdminDemurrage', 'AdminJobs'],
    }),
    getAdminDemurrageCalculation: builder.query({
      queryFn: (id, _api, _options, baseQuery) => calculationResult(id, baseQuery),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try { const { data } = await queryFulfilled; updateCalculatedRows(dispatch, [{ id, data }]); } catch { /* Query errors are shown by the existing screen toast. */ }
      },
      providesTags: ['AdminDemurrageCalculation', 'AdminJobs', 'AdminPricingConfig'],
    }),
    getAdminDemurrageBulkCalculation: builder.query({
      async queryFn(ids, api, _options, baseQuery) {
        const directory = demurrageApi.endpoints.getAdminDemurrageDirectory.select()(api.getState()).data;
        const allowed = new Set(directory?.rows.map((row) => row.jobApiId));
        if (!Array.isArray(ids) || !ids.length || ids.some((id) => !text(id) || !allowed.has(id)) || new Set(ids).size !== ids.length)
          return failure('Load and select valid demurrage jobs before calculating.');
        const calculations = [];
        for (let start = 0; start < ids.length; start += 4) {
          if (api.signal.aborted) return failure('Demurrage calculation was cancelled.');
          const results = await Promise.all(ids.slice(start, start + 4).map(async (id) => ({ id, result: await calculationResult(id, baseQuery) })));
          for (const { id, result } of results) {
            if (result.error) return { error: result.error };
            calculations.push({ id, data: result.data });
          }
        }
        return { data: { calculations, count: calculations.length } };
      },
      async onQueryStarted(_ids, { dispatch, queryFulfilled }) {
        try { const { data } = await queryFulfilled; updateCalculatedRows(dispatch, data.calculations); } catch { /* Do not present a failed batch as completed. */ }
      }, providesTags: ['AdminDemurrageCalculation', 'AdminJobs', 'AdminPricingConfig'],
    }),
    getAdminDemurrageJobContext: builder.query({
      query: (id) => ({ url: `/admin/jobs/${encodeURIComponent(id)}` }),
      transformResponse: (response) => record(unwrapApiResponseData(response)), providesTags: ['AdminJobs'],
    }),
    getAdminDemurrageRules: builder.query({
      query: () => ({ url: '/admin/config' }),
      transformResponse: (response) => {
        const config = record(unwrapApiResponseData(response)?.config), values = record(config.demurrage);
        return { freeDays: number(values.freeMinutes) == null ? null : number(values.freeMinutes) / 1440, rate: number(values.ratePerDay) };
      }, providesTags: ['AdminPricingConfig'],
    }),
    updateAdminDemurrageRules: builder.mutation({
      async queryFn(values, api, _options, baseQuery) {
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

export const { useGetAdminDemurrageDirectoryQuery, useGetAdminDemurrageCalculationQuery, useLazyGetAdminDemurrageBulkCalculationQuery, useGetAdminDemurrageJobContextQuery, useGetAdminDemurrageRulesQuery, useUpdateAdminDemurrageRulesMutation } = demurrageApi;
