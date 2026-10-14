import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
const date = (value) => { const parsed = value ? new Date(value) : null; return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
const money = (value) => value == null ? '—' : `₦${value.toLocaleString('en-NG')}`;
const format = (value, unit) => value == null ? '—' : unit === 'NGN' ? money(value) : unit === 'NGN/day' ? `${money(value)}/day` : unit === 'NGN/km' ? `${money(value)}/km` : unit === '%' ? `${value}%` : `${value.toLocaleString('en-NG')} ${unit}`;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const count = (value) => Number.isSafeInteger(number(value)) && number(value) >= 0 ? number(value) : null;
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
const statusLabels = { DRAFT: 'Draft', PENDING_APPROVAL: 'Pending Approval', PENDING: 'Pending Approval', ACTIVE: 'Active', INACTIVE: 'Inactive', APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };
const unitLabels = { PER_TRUCK: 'Per Truck', PER_KM: 'Per km', PER_TONNE: 'Per Tonne', PER_JOB: 'Per Job' };
const percentage = (value) => number(value) == null ? '—' : `${number(value) > 0 ? '+' : ''}${number(value).toLocaleString('en-NG', { maximumFractionDigits: 2 })}%`;
export const pricingMoney = (value) => Number.isFinite(value) ? money(value) : '—';
export const pricingNumber = (value) => Number.isFinite(value) ? value.toLocaleString('en-NG') : '—';
export const pricingDetailUrl = (id) => `/pricing/detail?id=${encodeURIComponent(id)}`;

function dateParts(value) {
  const raw = text(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw)) return { updated: '—', time: '—' };
  const [year, month, day] = raw.slice(0, 10).split('-').map(Number);
  const parsed = new Date(raw);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || Number.isNaN(parsed.getTime())) return { updated: '—', time: '—' };
  return { updated: date(raw), time: raw.includes('T') ? parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—' };
}
function routeLabel(dto) {
  if (text(dto.route)) return text(dto.route);
  const origin = text(record(dto.originPort).name) || text(dto.originState);
  const destination = text(record(dto.destinationPort).name) || text(dto.destinationState);
  return origin || destination ? `${origin || '—'} → ${destination || '—'}` : '—';
}
export function adaptAdminPricingService(value) {
  const dto = record(value), dates = dateParts(dto.updatedAt);
  const vehicle = [text(record(dto.containerSize).name), text(record(dto.containerType).name), text(record(dto.truckType).name)].filter(Boolean).join(' / ');
  return {
    id: text(dto.id), entity: 'services', service: text(dto.name) || '—', route: routeLabel(dto),
    coverage: text(dto.coverage) || text(dto.destinationState) || '—', truckType: vehicle || '—',
    unit: unitLabels[dto.unit] || label(dto.unit), basePrice: number(dto.basePrice),
    // A rate card is not a quote. Surcharges and totals depend on a particular job.
    surcharge: number(dto.surchargeTotal), surchargePct: number(dto.surchargePercent) == null ? '—' : `${number(dto.surchargePercent)}%`, totalPrice: number(dto.totalPrice),
    statusCode: text(dto.status), status: statusLabels[dto.status] || label(dto.status),
    updated: dates.updated, updatedTime: dates.time,
    requestedBy: text(record(dto.createdBy).name) || '—', requesterId: text(dto.createdById) || text(record(dto.createdBy).id),
    submitted: dateParts(dto.submittedAt).updated, standardPrice: number(dto.currentPrice), exceptionPrice: number(dto.basePrice),
  };
}
function adaptPriceList(value) {
  const dto = record(value);
  return { id: text(dto.id), entity: 'price-lists', name: text(dto.name) || '—', service: text(dto.name) || '—', region: text(dto.region) || '—', route: routeLabel(dto),
    services: count(dto.servicesCount), currency: text(dto.currency) || '—', lastUpdated: dateParts(dto.updatedAt).updated,
    statusCode: text(dto.status), status: statusLabels[dto.status] || label(dto.status), requestedBy: text(record(dto.createdBy).name) || '—',
    requesterId: text(dto.createdById) || text(record(dto.createdBy).id), standardPrice: null, exceptionPrice: null, submitted: dateParts(dto.submittedAt).updated };
}
function adaptSurcharge(value) {
  const dto = record(value), parsed = number(dto.value);
  const unit = dto.calc === 'PERCENT_OF_BASE' ? '%' : dto.calc === 'PER_KM' ? 'NGN/km' : dto.calc === 'FIXED_PER_TRUCK' ? 'NGN/truck' : null;
  const scope = [text(record(dto.service).name), text(record(dto.priceList).name), text(record(dto.originPort).name), text(dto.destinationState), text(dto.cargoType) ? label(dto.cargoType) : null].filter(Boolean).join(' / ');
  return { id: text(dto.id), entity: 'surcharges', source: 'surcharge', name: text(dto.name) || '—', service: text(dto.name) || '—',
    description: text(dto.description) || label(dto.kind), appliesTo: scope || '—', rate: unit ? format(parsed, unit) : '—',
    unit: unit || '—', value: parsed, min: 0, effectiveFrom: dateParts(dto.effectiveFrom).updated,
    statusCode: text(dto.status), status: statusLabels[dto.status] || label(dto.status), editable: dto.status === 'DRAFT' && parsed != null && unit != null,
    icon: 'badge-percent', iconTint: 'amber', route: routeLabel(dto), requestedBy: text(record(dto.createdBy).name) || '—',
    requesterId: text(dto.createdById) || text(record(dto.createdBy).id), standardPrice: null, exceptionPrice: null, submitted: dateParts(dto.submittedAt).updated };
}
function adaptException(value) {
  const dto = record(value);
  return { id: text(dto.id), entity: 'exceptions', service: text(record(dto.service).name) || '—',
    route: routeLabel(record(dto.job).route && typeof record(dto.job).route === 'object' ? record(dto.job).route : dto), reason: text(dto.reason) || '—',
    requestedBy: text(record(dto.requestedBy).name) || '—', requesterId: text(dto.requestedById) || text(record(dto.requestedBy).id),
    standardPrice: number(dto.currentPrice), exceptionPrice: number(dto.proposedPrice),
    statusCode: text(dto.status), status: statusLabels[dto.status] || label(dto.status), submitted: dateParts(dto.createdAt).updated };
}
function adaptHistory(value) {
  const dto = record(value), dates = dateParts(dto.createdAt);
  const inNaira = dto.currency === 'NGN' || ['NGN', 'NGN/day', 'NGN/km', 'NGN/truck'].includes(dto.unit);
  return { id: text(dto.id), service: text(dto.entityName) || '—', route: text(dto.route) || '—',
    // History also contains currency/percentage settings. Render only monetary changes as Naira.
    from: inNaira ? number(dto.oldValue) : null, to: inNaira ? number(dto.newValue) : null,
    pct: percentage(dto.changePercent), updated: dates.updated, time: dates.time, by: text(record(dto.admin).name) || '—' };
}
const adapters = { services: adaptAdminPricingService, 'price-lists': adaptPriceList, surcharges: adaptSurcharge, exceptions: adaptException, history: adaptHistory };
const collectionKeys = { services: 'services', 'price-lists': 'priceLists', surcharges: 'surcharges', exceptions: 'exceptions', history: 'history' };
function pricingPage(response, entity) {
  const data = record(unwrapApiResponseData(response));
  const rows = Array.isArray(data.items) ? data.items : data[collectionKeys[entity]];
  const pagination = record(data.pagination);
  const total = count(pagination.total) ?? count(data.total), totalPages = count(pagination.totalPages) ?? count(data.totalPages);
  if (!Array.isArray(rows) || total == null || totalPages == null || rows.some((row) => !text(record(row).id))) throw new Error(`The ${entity} response is missing its records or pagination contract.`);
  return { rows, total, totalPages };
}
async function pricingCollection(entity, baseQuery, signal, params = {}, complete = true, limit = 100) {
  const rows = new Map(); let page = 1, pages = 1, total = null;
  try {
    do {
      if (signal.aborted) return { error: { status: 'CUSTOM_ERROR', error: 'Pricing request cancelled.' } };
      const result = await baseQuery({ url: `/admin/pricing/${entity}`, params: { ...params, page, limit } });
      if (result.error) return { error: result.error };
      const current = pricingPage(result.data, entity);
      if (total != null && total !== current.total) throw new Error('Pricing records changed while loading. Please retry.');
      total = current.total; pages = Math.max(1, current.totalPages);
      if (page < pages && !current.rows.length) throw new Error('The pricing response ended before all records were loaded.');
      for (const row of current.rows) rows.set(row.id, adapters[entity](row));
      page += 1;
    } while (complete && page <= pages);
    if (complete && rows.size !== total) throw new Error('The pricing response did not include every record.');
    return { data: { rows: [...rows.values()], total } };
  } catch (error) { return { error: { status: 'CUSTOM_ERROR', error: error.message } }; }
}

const pricingReviewerRoles = new Set(['SUPER_ADMIN', 'FINANCE_ADMIN']);
const pricingEntities = new Set(['services', 'price-lists', 'surcharges', 'exceptions']);
export function canChangePricing(row, action, admin) {
  if (!row?.id || !pricingEntities.has(row.entity) || !admin?.id) return false;
  const rates = row.entity === 'services' ? [row.basePrice] : row.entity === 'surcharges' ? [row.value] : row.entity === 'exceptions' ? [row.standardPrice, row.exceptionPrice] : [];
  if (!rates.every((value) => Number.isFinite(value) && value >= 0)) return false;
  if (action === 'duplicate') return row.entity !== 'exceptions' && ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE'].includes(row.statusCode);
  if (!pricingReviewerRoles.has(admin.role)) return false;
  if (action === 'deactivate') return row.entity !== 'exceptions' && row.statusCode === 'ACTIVE';
  if (action === 'activate') return row.entity !== 'exceptions' && row.statusCode === 'PENDING_APPROVAL';
  return action === 'approve' && row.entity === 'exceptions' && row.statusCode === 'PENDING' && row.requesterId && row.requesterId !== admin.id;
}
function pricingRecord(response, entity) {
  const dto = record(unwrapApiResponseData(response));
  return text(dto.id) ? dto : record(dto[({ services: 'service', 'price-lists': 'priceList', surcharges: 'surcharge', exceptions: 'exception' })[entity]]);
}
async function changePricingRecord({ row, action }, api, baseQuery) {
  const admin = api.getState().auth.admin;
  if (!canChangePricing(row, action, admin)) return { error: { status: 'CUSTOM_ERROR', error: 'Your role or this pricing status does not allow this action.' } };
  const sameSession = () => !api.signal.aborted && api.getState().auth.accessToken && api.getState().auth.admin?.id === admin.id && api.getState().auth.admin?.role === admin.role;
  if (!sameSession()) return { error: { status: 'CUSTOM_ERROR', error: 'The session changed. Refresh before continuing.' } };
  const path = '/admin/pricing/' + row.entity + '/' + encodeURIComponent(row.id);
  const before = await baseQuery(path);
  if (before.error) return before;
  const dto = pricingRecord(before.data, row.entity), current = adapters[row.entity](dto);
  if (!sameSession() || current.id !== row.id || current.statusCode !== row.statusCode || !canChangePricing(current, action, admin)) return { error: { status: 'CUSTOM_ERROR', error: 'This pricing record changed. Refresh before continuing.' } };
  // Approve the same displayed rate the admin reviewed.
  const comparable = row.entity === 'services' ? ['basePrice'] : row.entity === 'surcharges' ? ['value'] : row.entity === 'exceptions' ? ['standardPrice', 'exceptionPrice'] : [];
  if (comparable.some((key) => row[key] == null || current[key] !== row[key])) return { error: { status: 'CUSTOM_ERROR', error: 'The rate changed. Refresh before continuing.' } };
  const result = await baseQuery({ url: path + '/' + action, method: 'POST', ...(action !== 'duplicate' ? { body: {} } : {}) });
  if (result.error) return result;
  const savedDto = pricingRecord(result.data, row.entity), id = action === 'duplicate' ? text(savedDto.id) : row.id;
  const unconfirmed = () => ({ error: { status: 'CUSTOM_ERROR', error: 'The pricing change was sent but could not be confirmed. Refresh before trying again.' } });
  if (!sameSession() || !id || action === 'duplicate' && id === row.id) return unconfirmed();
  const confirmation = await baseQuery('/admin/pricing/' + row.entity + '/' + encodeURIComponent(id));
  if (confirmation.error || !sameSession()) return unconfirmed();
  const saved = adapters[row.entity](pricingRecord(confirmation.data, row.entity));
  const status = { duplicate: 'DRAFT', activate: 'ACTIVE', deactivate: 'INACTIVE', approve: 'APPROVED' }[action];
  if (saved.id !== id || saved.statusCode !== status || comparable.some((key) => saved[key] !== current[key])) return unconfirmed();
  return { data: saved };
}

export function downloadPricingCsv(name, headers, rows) {
  const cell = (value) => {
    const raw = value == null ? '—' : String(value);
    const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const csv = [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

// Response paths are nested; POST /admin/config accepts these flat DTO keys.
const fields = [
  { key: 'platformFee', path: ['pricing', 'platformFee'], name: 'Platform Fee', description: 'Flat platform fee charged on every job', appliesTo: 'All jobs', unit: 'NGN', min: 0, group: 'fee', icon: 'coins' },
  { key: 'vatPercent', path: ['pricing', 'vatPercent'], name: 'VAT', description: 'VAT percentage applied to total job cost', appliesTo: 'All jobs', unit: '%', min: 0, max: 100, group: 'fee', icon: 'badge-percent' },
  { key: 'commissionPercent', path: ['pricing', 'commissionPercent'], name: 'Platform Commission', description: 'Commission charged on completed jobs', appliesTo: 'Completed jobs', unit: '%', min: 0, max: 100, group: 'fee', icon: 'badge-percent' },
  { key: 'withdrawalFeePercent', path: ['pricing', 'withdrawalFeePercent'], name: 'Withdrawal Fee', description: 'Platform fee on wallet withdrawals', appliesTo: 'Wallet withdrawals', unit: '%', min: 0, max: 10, group: 'fee', icon: 'wallet' },
  { key: 'depositFeePercent', path: ['pricing', 'depositFeePercent'], name: 'Deposit Fee', description: 'Platform fee on wallet deposits', appliesTo: 'Wallet deposits', unit: '%', min: 0, max: 10, group: 'fee', icon: 'wallet' },
  { key: 'demurrageRatePerDay', path: ['demurrage', 'ratePerDay'], name: 'Demurrage Rate', description: 'Daily charge for late offloading after the free window', appliesTo: 'Forwarder late offloading', unit: 'NGN/day', min: 0, group: 'fee', icon: 'hourglass' },
  { key: 'driverDemurrageRatePerDay', path: ['driverDemurrage', 'ratePerDay'], name: 'Driver Demurrage Rate', description: 'Daily deduction for delivery beyond ETA and the grace period', appliesTo: 'Trucker late delivery', unit: 'NGN/day', min: 0, group: 'fee', icon: 'hourglass' },
  { key: 'lateCancellationFee', path: ['cancellation', 'lateCancellationFee'], name: 'Late Cancellation Fee', description: 'Flat fee charged outside the free cancellation window', appliesTo: 'Late cancellations', unit: 'NGN', min: 0, group: 'fee', icon: 'circle-x' },
  { key: 'noShowFee', path: ['cancellation', 'noShowFee'], name: 'No-Show Fee', description: 'Flat fee charged when a driver does not show up', appliesTo: 'Driver no-shows', unit: 'NGN', min: 0, group: 'fee', icon: 'triangle-alert' },
  { key: 'minFeePercent', path: ['pricing', 'minFeePercent'], name: 'Minimum Fare', description: 'Minimum job fee as a percentage of recommended fare', unit: '%', min: 1, max: 100, group: 'rule', icon: 'shield-check' },
  { key: 'maxFeePercent', path: ['pricing', 'maxFeePercent'], name: 'Maximum Fare', description: 'Maximum bid or counter-offer as a percentage of recommended fare', unit: '%', min: 100, max: 500, group: 'rule', icon: 'shield-check' },
  { key: 'mobilizationPercent', path: ['escrow', 'mobilizationPercent'], name: 'Mobilization Payment', description: 'Percentage paid as mobilization; the remainder is the final payment', unit: '%', min: 0, max: 100, group: 'rule', icon: 'wallet' },
  { key: 'demurrageGracePeriodMinutes', path: ['demurrage', 'freeMinutes'], name: 'Offloading Free Window', description: 'Free window before forwarder demurrage starts', unit: 'minutes', min: 1, group: 'rule', icon: 'hourglass' },
  { key: 'driverDemurrageGracePeriodMinutes', path: ['driverDemurrage', 'freeMinutes'], name: 'Delivery Grace Period', description: 'Grace period added to the delivery ETA before driver demurrage', unit: 'minutes', min: 1, group: 'rule', icon: 'hourglass' },
  { key: 'freeCancellationWindowHours', path: ['cancellation', 'freeCancellationWindowHours'], name: 'Free Cancellation Window', description: 'Window within which cancellation is free of charge', unit: 'hours', min: 0, group: 'rule', icon: 'clock' },
  { key: 'defaultCurrency', path: ['platform', 'defaultCurrency'], name: 'Base Currency', description: 'Default platform currency', unit: 'currency', options: ['NGN', 'USD', 'GBP'], group: 'rule', icon: 'coins' },
];
export function adaptAdminPricingConfig(response) {
  const dto = unwrapApiResponseData(response)?.config;
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) throw new Error('The platform configuration response is missing its config object.');
  const rows = fields.map((field) => {
    const raw = field.path.reduce((value, part) => value?.[part], dto);
    const value = field.options ? text(raw) : number(raw);
    return { ...field, id: `config:${field.key}`, source: 'config', value, rate: field.options ? value || '—' : format(value, field.unit), iconTint: 'blue', status: value == null ? 'Unavailable' : 'Configured', effectiveFrom: '—', editable: value != null };
  });
  return { currency: text(dto.platform?.defaultCurrency), fees: rows.filter((row) => row.group === 'fee'), rules: rows.filter((row) => row.group === 'rule') };
}
export function pricingError(error) {
  if (error?.status === 401) return 'Your session has expired. Please sign in again.';
  if (error?.status === 403) return 'You do not have permission to access or change these pricing settings.';
  const message = unwrapApiResponseData(error?.data)?.message;
  return (Array.isArray(message) ? message.join(' ') : text(message)) || text(error?.error) || text(error?.message) || 'Unable to load pricing settings. Please try again.';
}
function validateValue(field, value) {
  if (!field) throw new Error('Unsupported pricing setting.');
  if (field.options) { if (!field.options.includes(value)) throw new Error('Select a supported currency.'); return value; }
  const parsed = number(value);
  if (parsed == null || parsed < field.min || (field.max != null && parsed > field.max)) throw new Error('Enter a valid value within the allowed range.');
  return parsed;
}
export const pricingApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminPricing'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminPricingSummary: builder.query({
      query: () => ({ url: '/admin/pricing/summary', params: { days: 30 } }),
      transformResponse: (response) => {
        const data = record(unwrapApiResponseData(response));
        const exceptions = record(data.exceptions), changes = record(data.rateChanges);
        const exceptionCounts = ['pending', 'approved', 'rejected', 'cancelled'].map((key) => count(exceptions[key]));
        return { activePriceLists: count(record(data.priceLists).active), totalServices: count(record(data.services).total), avgPriceChange: percentage(changes.avgChangePercent),
          priceExceptions: exceptionCounts.every((value) => value != null) ? exceptionCounts.reduce((sum, value) => sum + value, 0) : null,
          surchargesActive: count(record(data.surcharges).active), pending: count(record(data.pendingApprovals).total), approved: null, rejected: null };
      }, providesTags: ['AdminPricing'],
    }),
    getAdminPricingServices: builder.query({ async queryFn(_args, api, _options, baseQuery) { return pricingCollection('services', baseQuery, api.signal); }, providesTags: ['AdminPricing'] }),
    getAdminPricingPriceLists: builder.query({ async queryFn(_args, api, _options, baseQuery) { return pricingCollection('price-lists', baseQuery, api.signal); }, providesTags: ['AdminPricing'] }),
    getAdminPricingSurcharges: builder.query({ async queryFn(_args, api, _options, baseQuery) { return pricingCollection('surcharges', baseQuery, api.signal); }, providesTags: ['AdminPricing'] }),
    getAdminPricingExceptions: builder.query({ async queryFn(_args, api, _options, baseQuery) { return pricingCollection('exceptions', baseQuery, api.signal); }, providesTags: ['AdminPricing'] }),
    getAdminPricingHistory: builder.query({ async queryFn(_args, api, _options, baseQuery) { return pricingCollection('history', baseQuery, api.signal); }, providesTags: ['AdminPricing'] }),
    getAdminPricingRecentHistory: builder.query({ async queryFn(_args, api, _options, baseQuery) { return pricingCollection('history', baseQuery, api.signal, {}, false, 5); }, providesTags: ['AdminPricing'] }),
    getAdminPricingService: builder.query({
      query: (id) => ({ url: `/admin/pricing/services/${encodeURIComponent(id)}` }),
      transformResponse: (response, _meta, id) => {
        const dto = pricingRecord(response, 'services');
        if (dto.id !== id) throw new Error('The service detail response did not identify this pricing record.');
        return adaptAdminPricingService(dto);
      }, providesTags: ['AdminPricing'],
    }),
    changeAdminPricingRecord: builder.mutation({
      queryFn: (args, api, _options, baseQuery) => changePricingRecord(args, api, baseQuery),
      invalidatesTags: ['AdminPricing'],
    }),
    getAdminPricingConfig: builder.query({ query: () => ({ url: '/admin/config' }), transformResponse: adaptAdminPricingConfig, providesTags: ['AdminPricingConfig'] }),
    getAdminPricingTerminalRates: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const result = await baseQuery({ url: '/admin/reference/ports' });
        if (result.error) return result;
        const ports = unwrapApiResponseData(result.data)?.ports;
        if (!Array.isArray(ports) || ports.some((port) => !text(port?.id))) return { error: { status: 'CUSTOM_ERROR', error: 'The ports response is missing valid port records.' } };
        const rows = [], warnings = [];
        for (let start = 0; start < ports.length; start += 4) {
          const results = await Promise.all(ports.slice(start, start + 4).map(async (port) => ({ port, result: await baseQuery({ url: `/admin/reference/ports/${encodeURIComponent(port.id)}/terminals` }) })));
          for (const { port, result: terminalResult } of results) {
            if (terminalResult.error?.status === 401) return { error: terminalResult.error };
            const terminals = unwrapApiResponseData(terminalResult.data)?.terminals;
            if (terminalResult.error || !Array.isArray(terminals) || terminals.some((terminal) => !text(terminal?.id))) { warnings.push(text(port.name) || port.id); continue; }
            for (const terminal of terminals) for (const [key, title, unit] of [['handlingFee', 'Terminal Handling Fee', 'NGN'], ['baseFeePerKm', 'Recommended Fare per km', 'NGN/km']]) {
              const value = number(terminal[key]);
              rows.push({ id: `terminal:${terminal.id}:${key}`, terminalId: terminal.id, key, name: `${title} · ${text(terminal.name) || 'Terminal'}`, description: `${text(port.name) || 'Port'} / ${text(terminal.name) || 'Terminal'}`, appliesTo: `${text(port.name) || 'Port'} / ${text(terminal.name) || 'Terminal'}`, source: 'terminal', value, unit, min: 0, rate: format(value, unit), effectiveFrom: '—', lastUpdated: dateParts(terminal.updatedAt).updated, status: terminal.isActive === true && port.isActive === true ? 'Active Terminal' : terminal.isActive === false || port.isActive === false ? 'Inactive Terminal / Port' : '—', icon: 'anchor', iconTint: 'blue', editable: value != null });
            }
          }
        }
        return { data: { rows, warnings } };
      }, providesTags: ['AdminTerminalRates'],
    }),
    updateAdminPricingConfig: builder.mutation({
      query: ({ key, value }) => ({ url: '/admin/config', method: 'POST', body: { [key]: validateValue(fields.find((field) => field.key === key), value) } }),
      invalidatesTags: (_result, error) => error ? [] : ['AdminPricingConfig', 'AdminPricing'],
    }),
    updateAdminPricingTerminalRate: builder.mutation({
      query: ({ id, key, value }) => {
        if (!text(id) || !['handlingFee', 'baseFeePerKm'].includes(key)) throw new Error('Unsupported terminal pricing setting.');
        return { url: `/admin/reference/terminals/${encodeURIComponent(id)}`, method: 'PATCH', body: { [key]: validateValue({ min: 0 }, value) } };
      }, invalidatesTags: (_result, error) => error ? [] : ['AdminTerminalRates', 'AdminPricing'],
    }),
    updateAdminPricingSurcharge: builder.mutation({
      query: ({ id, status, value }) => {
        if (!text(id) || status !== 'DRAFT') throw new Error('Only draft surcharges can be edited.');
        return { url: `/admin/pricing/surcharges/${encodeURIComponent(id)}`, method: 'PATCH', body: { value: validateValue({ min: 0 }, value) } };
      }, invalidatesTags: (_result, error) => error ? [] : ['AdminPricing'],
    }),
  }),
});
export const { useGetAdminPricingConfigQuery, useGetAdminPricingTerminalRatesQuery, useUpdateAdminPricingConfigMutation, useUpdateAdminPricingTerminalRateMutation, useUpdateAdminPricingSurchargeMutation,
  useGetAdminPricingSummaryQuery, useGetAdminPricingServicesQuery, useGetAdminPricingPriceListsQuery, useGetAdminPricingSurchargesQuery,
  useGetAdminPricingExceptionsQuery, useGetAdminPricingHistoryQuery, useGetAdminPricingRecentHistoryQuery, useGetAdminPricingServiceQuery, useChangeAdminPricingRecordMutation } = pricingApi;
