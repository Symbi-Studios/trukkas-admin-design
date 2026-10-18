import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { serviceCore, serviceBody, assertServiceEquipment, pricingServiceRoles } from './pricingServiceContracts.js';
import { adaptPricingFormOptions } from './pricingFormOptions.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
const date = (value) => { const parsed = value ? new Date(value) : null; return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
const money = (value) => value == null ? '—' : `₦${value.toLocaleString('en-NG')}`;
const format = (value, unit) => value == null ? '—' : unit === 'NGN' ? money(value) : unit === 'NGN/day' ? `${money(value)}/day` : unit === 'NGN/km' ? `${money(value)}/km` : unit === 'NGN/truck' ? `${money(value)}/truck` : unit === '%' ? `${value}%` : `${value.toLocaleString('en-NG')} ${unit}`;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const count = (value) => Number.isSafeInteger(number(value)) && number(value) >= 0 ? number(value) : null;
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
const statusLabels = { DRAFT: 'Draft', PENDING_APPROVAL: 'Pending Approval', PENDING: 'Pending Approval', ACTIVE: 'Active', INACTIVE: 'Inactive', APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };
const unitLabels = { PER_TRUCK: 'Per Truck', PER_KM: 'Per km', PER_TONNE: 'Per Tonne', PER_JOB: 'Per Job' };
const currencyLabels = { NGN: 'NGN (₦)', USD: 'USD ($)', GBP: 'GBP (£)' };
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
  if (text(dto.routeLabel)) return text(dto.routeLabel);
  if (text(dto.route)) return text(dto.route);
  const origin = text(record(dto.originPort).name) || text(dto.originPort) || text(dto.originState);
  const destination = text(record(dto.destinationPort).name) || text(dto.destinationPort) || text(dto.destinationState);
  return origin || destination ? `${origin || '—'} → ${destination || '—'}` : '—';
}
function coverageLabel(value) {
  if (text(value)) return text(value);
  const coverage = record(value);
  const endpoints = [text(coverage.origin), text(coverage.destination)].filter(Boolean);
  return endpoints.length ? endpoints.join(' → ') : null;
}
function vehicleContainerLabel(dto) {
  const labels = [
    text(dto.vehicleLabel), text(dto.containerLabel),
    text(record(dto.containerSize).name), text(record(dto.containerType).name), text(record(dto.truckType).name),
  ].filter(Boolean);
  return labels.length ? [...new Set(labels)].join(' / ') : null;
}
function submitter(value) {
  const dto = record(value);
  return { name: text(dto.name) || '—', id: text(dto.id) };
}
export function adaptAdminPricingService(value) {
  const dto = record(value), dates = dateParts(dto.updatedAt);
  const vehicle = vehicleContainerLabel(dto), submittedBy = submitter(dto.submittedBy);
  return {
    id: text(dto.id), entity: 'services', code: text(dto.code), core: serviceCore(dto), updatedAt: text(dto.updatedAt), service: text(dto.name) || '—', route: routeLabel(dto),
    coverage: coverageLabel(dto.coverage) || text(dto.destinationState) || '—', truckType: vehicle || '—', currency: currencyLabels[dto.currency] || text(dto.currency) || '—',
    unit: unitLabels[dto.unit] || label(dto.unit), basePrice: number(dto.basePrice),
    // Use the documented service totals; job quote totals have a different scope.
    surcharge: number(dto.surchargeTotal), surchargePct: number(dto.surchargePercent) == null ? '—' : `${number(dto.surchargePercent)}%`, totalPrice: number(dto.totalPrice),
    statusCode: text(dto.status), status: statusLabels[dto.status] || label(dto.status),
    updated: dates.updated, updatedTime: dates.time,
    requestedBy: submittedBy.name, requesterId: submittedBy.id,
    submitted: dateParts(dto.submittedAt).updated, standardPrice: number(dto.currentPrice), exceptionPrice: number(dto.basePrice),
  };
}
function adaptPriceList(value) {
  const dto = record(value), submittedBy = submitter(dto.submittedBy);
  return { id: text(dto.id), entity: 'price-lists', name: text(dto.name) || '—', service: text(dto.name) || '—', region: text(dto.region) || '—', route: text(record(dto.originPort).name) || '—',
    services: count(dto.servicesCount) ?? count(dto.rateCount), currency: text(dto.currency) || '—', lastUpdated: dateParts(dto.updatedAt).updated,
    statusCode: text(dto.status), status: statusLabels[dto.status] || label(dto.status), requestedBy: submittedBy.name,
    requesterId: submittedBy.id, standardPrice: null, exceptionPrice: null, submitted: dateParts(dto.submittedAt).updated };
}
function adaptSurcharge(value) {
  const dto = record(value), parsed = number(dto.value), submittedBy = submitter(dto.submittedBy);
  const unit = dto.calc === 'PERCENT_OF_BASE' ? '%' : dto.calc === 'PER_KM' ? 'NGN/km' : dto.calc === 'FIXED_PER_TRUCK' ? 'NGN/truck' : null;
  const legacyScope = [text(record(dto.service).name), text(record(dto.priceList).name), text(record(dto.originPort).name), text(dto.destinationState), text(dto.cargoType) ? label(dto.cargoType) : null].filter(Boolean);
  const scopeLabels = Array.isArray(dto.scopeLabels) ? dto.scopeLabels.map(text).filter(Boolean) : [];
  const scope = scopeLabels.length ? scopeLabels.join(' / ') : legacyScope.join(' / ');
  return { id: text(dto.id), entity: 'surcharges', source: 'surcharge', name: text(dto.name) || '—', service: text(dto.name) || '—',
    description: text(dto.description) || label(dto.kind), appliesTo: scope || '—', rate: unit ? format(parsed, unit) : '—',
    unit: unit || '—', calc: text(dto.calc), value: parsed, min: 0, effectiveFrom: dateParts(dto.effectiveFrom).updated,
    statusCode: text(dto.status), status: statusLabels[dto.status] || label(dto.status), editable: dto.status === 'DRAFT' && parsed != null && unit != null,
    icon: 'badge-percent', iconTint: 'amber', route: scope || routeLabel(dto), requestedBy: submittedBy.name,
    requesterId: submittedBy.id, standardPrice: null, exceptionPrice: null, submitted: dateParts(dto.submittedAt).updated };
}
function adaptException(value) {
  const dto = record(value), requestedBy = submitter(dto.requestedBy);
  return { id: text(dto.id), entity: 'exceptions', service: text(dto.serviceLabel) || text(record(dto.service).name) || '—',
    route: text(dto.routeLabel) || routeLabel(record(dto.job).route && typeof record(dto.job).route === 'object' ? record(dto.job).route : dto), reason: text(dto.reason) || '—',
    requestedBy: requestedBy.name, requesterId: requestedBy.id || text(dto.requestedById),
    standardPrice: number(dto.currentPrice), exceptionPrice: number(dto.proposedPrice),
    statusCode: text(dto.status), status: statusLabels[dto.status] || label(dto.status), submitted: dateParts(dto.createdAt).updated };
}
function adaptHistory(value) {
  const dto = record(value), dates = dateParts(dto.createdAt);
  const inNaira = dto.currency === 'NGN' || ['NGN', 'NGN/day', 'NGN/km', 'NGN/truck'].includes(dto.unit);
  return { id: text(dto.id), service: text(dto.entityName) || '—', route: text(dto.route) || '—',
    // History also contains currency/percentage settings. Render only monetary changes as Naira.
    from: inNaira ? number(dto.oldValue) : null, to: inNaira ? number(dto.newValue) : null,
    pct: percentage(dto.changePercent), updated: dates.updated, time: dates.time, by: text(record(dto.admin).name) || text(dto.adminName) || '—' };
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
async function pricingRecordSnapshot(entity, id, baseQuery, signal) {
  if (signal.aborted) return { error: { status: 'CUSTOM_ERROR', error: 'Pricing request cancelled.' } };
  const result = await baseQuery({ url: '/admin/pricing/' + entity + '/' + encodeURIComponent(id) });
  if (result.error) return result;
  const dto = pricingRecord(result.data, entity);
  return dto.id === id ? { data: adapters[entity](dto) } : { error: { status: 'CUSTOM_ERROR', error: 'The pricing detail response did not identify this record. Refresh before continuing.' } };
}

const pricingReviewerRoles = new Set(['SUPER_ADMIN', 'FINANCE_ADMIN']);
const pricingEntities = new Set(['services', 'price-lists', 'surcharges', 'exceptions']);
export function canChangePricing(row, action, admin) {
  if (!row?.id || !pricingEntities.has(row.entity) || !admin?.id) return false;
  const rates = row.entity === 'services' ? [row.basePrice] : row.entity === 'surcharges' ? [row.value] : row.entity === 'exceptions' ? [row.standardPrice, row.exceptionPrice] : [];
  if (!rates.every((value) => Number.isFinite(value) && value >= 0)) return false;
  if (action === 'duplicate') return row.entity !== 'exceptions' && ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE'].includes(row.statusCode);
  if (action === 'submit') return row.entity === 'services' && row.statusCode === 'DRAFT' && pricingServiceRoles.has(admin.role);
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
  const before = await pricingRecordSnapshot(row.entity, row.id, baseQuery, api.signal);
  if (before.error) return before;
  const current = before.data;
  if (!sameSession() || current.id !== row.id || current.statusCode !== row.statusCode || !canChangePricing(current, action, admin)) return { error: { status: 'CUSTOM_ERROR', error: 'This pricing record changed. Refresh before continuing.' } };
  // Approve the same displayed rate the admin reviewed.
  const comparable = row.entity === 'services' ? ['basePrice'] : row.entity === 'surcharges' ? ['value'] : row.entity === 'exceptions' ? ['standardPrice', 'exceptionPrice'] : [];
  if (comparable.some((key) => row[key] == null || current[key] !== row[key])) return { error: { status: 'CUSTOM_ERROR', error: 'The rate changed. Refresh before continuing.' } };
  if (action === 'submit' && (!row.updatedAt || current.updatedAt !== row.updatedAt)) return { error: { status: 'CUSTOM_ERROR', error: 'The draft changed. Refresh before submitting.' } };
  const result = await baseQuery({ url: path + '/' + action, method: 'POST', ...(!['duplicate', 'submit'].includes(action) ? { body: {} } : {}) });
  if (result.error) return result;
  const savedDto = pricingRecord(result.data, row.entity), id = action === 'duplicate' ? text(savedDto.id) : row.id;
  const unconfirmed = () => ({ error: { status: 'CUSTOM_ERROR', error: 'The pricing change was sent but could not be confirmed. Refresh before trying again.' } });
  const status = { duplicate: 'DRAFT', submit: 'PENDING_APPROVAL', activate: 'ACTIVE', deactivate: 'INACTIVE', approve: 'APPROVED' }[action];
  const responseRow = adapters[row.entity](savedDto);
  if (!sameSession() || !id || savedDto.id !== id || responseRow.statusCode !== status || comparable.some((key) => responseRow[key] !== current[key]) || action === 'duplicate' && (id === row.id || !text(savedDto.code))) return unconfirmed();
  const confirmation = await pricingRecordSnapshot(row.entity, id, baseQuery, api.signal);
  if (confirmation.error || !sameSession()) return unconfirmed();
  const saved = confirmation.data;
  if (saved.id !== id || saved.statusCode !== status || comparable.some((key) => saved[key] !== current[key])) return unconfirmed();
  if (action === 'submit' && saved.requesterId !== admin.id) return unconfirmed();
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
function pricingPdfFilename(headers) {
  const disposition = headers?.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  let filename = plain ? (plain[1] || plain[2]).trim() : 'pricing-services.pdf';
  if (encoded) { try { filename = decodeURIComponent(encoded.trim()); } catch { /* Use the regular filename when filename* is malformed. */ } }
  filename = filename.split(/[\\/]/).pop().replace(/[<>:"|?*\x00-\x1f]/g, '').trim();
  return filename.toLowerCase().endsWith('.pdf') ? filename : 'pricing-services.pdf';
}
function downloadPricingPdf(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
async function exportPricingServices({ ids }, _api, _extraOptions, baseQuery) {
  const selectedIds = Array.isArray(ids) ? [...new Set(ids.map(text).filter(Boolean))] : [];
  if (!selectedIds.length) return { error: { status: 'CUSTOM_ERROR', error: 'Select at least one service before exporting.' } };
  const result = await baseQuery({
    url: '/admin/pricing/services/export',
    params: { format: 'pdf', ids: selectedIds.join(',') },
    responseHandler: async (response) => {
      if (response.ok) return response.blob();
      return response.headers.get('content-type')?.toLowerCase().includes('application/json') ? response.json() : response.text();
    },
  });
  if (result.error) return result;
  const blob = result.data;
  const contentType = result.meta?.response?.headers?.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!(blob instanceof Blob) || blob.size === 0 || (contentType && contentType !== 'application/pdf')) {
    return { error: { status: 'CUSTOM_ERROR', error: 'The pricing export response was not a valid PDF.' } };
  }
  if (await blob.slice(0, 5).text() !== '%PDF-') return { error: { status: 'CUSTOM_ERROR', error: 'The pricing export response was not a valid PDF.' } };
  const filename = pricingPdfFilename(result.meta?.response?.headers);
  downloadPricingPdf(blob, filename);
  return { data: { filename } };
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
  const responseData = unwrapApiResponseData(response), dto = responseData?.config;
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) throw new Error('The platform configuration response is missing its config object.');
  const rows = fields.map((field) => {
    const raw = field.path.reduce((value, part) => value?.[part], dto);
    const value = field.options ? text(raw) : number(raw);
    const effectiveFrom = record(responseData.meta?.effectiveFrom)[field.path.join('.')];
    return { ...field, id: `config:${field.key}`, source: 'config', value, rate: field.options ? value || '—' : format(value, field.unit), iconTint: 'blue', status: value == null ? 'Unavailable' : 'Configured', effectiveFrom: dateParts(effectiveFrom).updated, editable: value != null };
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
async function savePricingSetting(source, args, api, baseQuery) {
  const failed = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
  const unconfirmed = () => failed('The pricing save was sent but its saved value could not be confirmed. Refresh before trying again.');
  try {
    const admin = api.getState().auth.admin;
    const check = () => {
      const auth = api.getState().auth;
      if (api.signal.aborted || !admin?.id || !auth.accessToken || auth.admin?.id !== admin.id || auth.admin?.role !== admin.role) throw new Error('The session changed. Refresh before continuing.');
    };
    check();
    if (source === 'config' && admin.role !== 'SUPER_ADMIN') return failed('Only Super Admins can change platform pricing settings.');
    const { id, portId, key, expectedValue, calc } = args;
    const field = source === 'config' ? fields.find((item) => item.key === key) : { min: 0 };
    const value = validateValue(field, args.value);
    const previous = validateValue(field, expectedValue);
    if (source === 'terminal' && (!text(id) || !text(portId) || !['handlingFee', 'baseFeePerKm'].includes(key))) return failed('Unsupported terminal pricing setting.');
    if (source === 'surcharge' && (!text(id) || args.status !== 'DRAFT' || !['PERCENT_OF_BASE', 'FIXED_PER_TRUCK', 'PER_KM'].includes(calc))) return failed('Only confirmed draft surcharges can be edited.');
    const readUrl = source === 'config' ? '/admin/config' : source === 'terminal' ? '/admin/reference/ports/' + encodeURIComponent(portId) + '/terminals' : '/admin/pricing/surcharges/' + encodeURIComponent(id);
    const decode = (dto) => {
      if (source === 'config') {
        const raw = field.path.reduce((current, part) => current?.[part], record(dto.config));
        return { value: field.options ? text(raw) : number(raw) };
      }
      if (source === 'terminal') {
        const matches = Array.isArray(dto.terminals) ? dto.terminals.filter((item) => item?.id === id && item.portId === portId) : [];
        return { value: matches.length === 1 ? number(matches[0][key]) : null };
      }
      const saved = pricingRecord(dto, 'surcharges');
      return { value: saved.id === id && saved.status === 'DRAFT' && saved.calc === calc ? number(saved.value) : null };
    };
    const before = await baseQuery({ url: readUrl }); check(); if (before.error) return before;
    if (decode(record(unwrapApiResponseData(before.data))).value !== previous) return failed('This pricing value or status changed. Refresh before saving.');
    const write = source === 'config' ? { url: '/admin/config', method: 'POST', body: { [key]: value } } : source === 'terminal' ? { url: '/admin/reference/terminals/' + encodeURIComponent(id), method: 'PATCH', body: { [key]: value } } : { url: readUrl, method: 'PATCH', body: { value } };
    check();
    const result = await baseQuery(write); check(); if (result.error) return result;
    const dto = record(unwrapApiResponseData(result.data));
    let confirmed;
    if (source === 'config') {
      const raw = record(dto.updates)[key];
      confirmed = (field.options ? text(raw) : number(raw)) === value;
    } else if (source === 'terminal') {
      const saved = record(dto.terminal);
      confirmed = saved.id === id && saved.portId === portId && number(saved[key]) === value;
    } else confirmed = decode(dto).value === value;
    // Re-read once to confirm the result; never replay a write for verification.
    const after = await baseQuery({ url: readUrl }); check();
    if (!confirmed || after.error || decode(record(unwrapApiResponseData(after.data))).value !== value) return unconfirmed();
    return { data: { value } };
  } catch (error) { return failed(error.message); }
}
const pricingConfigTags = ['AdminPricingConfig', 'AdminPricing', 'AdminSettings', 'AdminSettingsStatus'];
export const pricingApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminPricing', 'AdminSettings', 'AdminSettingsStatus'] }).injectEndpoints({
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
          surchargesActive: count(record(data.surcharges).active), pending: count(record(data.pendingApprovals).total), approved: count(record(data.approvals).approved), rejected: count(record(data.approvals).rejected) };
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
    getAdminPricingServiceFormOptions: builder.query({
      async queryFn({ owner, role }, api, _options, baseQuery) {
        const current = () => !api.signal.aborted && Boolean(api.getState().auth.accessToken && owner) && api.getState().auth.admin?.id === owner && api.getState().auth.admin?.role === role;
        try {
          if (!current()) throw new Error('The session changed. Reopen Pricing before continuing.');
          const result = await baseQuery({ url: '/admin/pricing/options' });
          if (!current()) throw new Error('The session changed. Reopen Pricing before continuing.');
          if (result.error) return result;
          return { data: adaptPricingFormOptions(unwrapApiResponseData(result.data)) };
        } catch (error) { return { error: { status: 'CUSTOM_ERROR', error: error.message } }; }
      },
    }),
    saveAdminPricingService: builder.mutation({
      async queryFn({ owner, role, id, fields, expectedUpdatedAt }, api, _options, baseQuery) {
        const current = () => !api.signal.aborted && Boolean(api.getState().auth.accessToken && owner) && api.getState().auth.admin?.id === owner && api.getState().auth.admin?.role === role;
        const fail = error => ({ error: { status: 'CUSTOM_ERROR', error } });
        try {
          if (!current() || !pricingServiceRoles.has(role)) return fail('Your session or admin role cannot save service pricing.');
          const body = serviceBody(fields, !id), root = '/admin/pricing/services';
          if (id) {
            const before = await baseQuery({ url: root + '/' + encodeURIComponent(id) });
            if (!current()) return fail('The session changed. Reload before continuing.');
            if (before.error) return before;
            const dto = pricingRecord(before.data, 'services');
            if (dto.id !== id || dto.status !== 'DRAFT' || !text(expectedUpdatedAt) || !Number.isFinite(Date.parse(expectedUpdatedAt)) || dto.updatedAt !== expectedUpdatedAt) return fail('Only an unchanged draft can be edited. Reload before saving.');
            assertServiceEquipment(body, dto);
          }
          const result = await baseQuery({ url: root + (id ? '/' + encodeURIComponent(id) : ''), method: id ? 'PATCH' : 'POST', body });
          if (!current()) return fail('The session changed. Refresh before trying again.');
          if (result.error) return result;
          const dto = pricingRecord(result.data, 'services'), savedId = id || text(dto.id);
          if (!savedId || dto.id !== savedId) return fail('The save returned no confirmed service ID. Refresh before trying again.');
          const matches = raw => {
            const core = serviceCore(raw);
            return raw.id === savedId && text(raw.code) && raw.status === 'DRAFT' && raw.currency === 'NGN' && text(raw.updatedAt) && Number.isFinite(Date.parse(raw.updatedAt))
              && Object.entries(body).every(([key, value]) => Object.hasOwn(core, key) && core[key] === value);
          };
          let saved = dto;
          if (!matches(saved)) {
            const reread = await baseQuery({ url: root + '/' + encodeURIComponent(savedId) });
            if (!current()) return fail('The session changed. Refresh before trying again.');
            if (reread.error) return fail('The save was sent, but its saved fields could not be confirmed. Refresh before trying again.');
            saved = pricingRecord(reread.data, 'services');
          }
          return matches(saved) ? { data: adaptAdminPricingService(saved) } : fail('The save was sent, but its saved fields could not be confirmed. Refresh before trying again.');
        } catch (error) { return fail(error.message); }
      }, invalidatesTags: ['AdminPricing'],
    }),
    changeAdminPricingRecord: builder.mutation({
      queryFn: (args, api, _options, baseQuery) => changePricingRecord(args, api, baseQuery),
      invalidatesTags: ['AdminPricing'],
    }),
    exportAdminPricingServices: builder.mutation({ queryFn: exportPricingServices }),
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
              rows.push({ id: `terminal:${terminal.id}:${key}`, terminalId: terminal.id, portId: port.id, key, name: `${title} · ${text(terminal.name) || 'Terminal'}`, description: `${text(port.name) || 'Port'} / ${text(terminal.name) || 'Terminal'}`, appliesTo: `${text(port.name) || 'Port'} / ${text(terminal.name) || 'Terminal'}`, source: 'terminal', value, unit, min: 0, rate: format(value, unit), effectiveFrom: dateParts(record(terminal.effectiveFrom)[key]).updated, lastUpdated: dateParts(terminal.updatedAt).updated, status: terminal.isActive === true && port.isActive === true ? 'Active Terminal' : terminal.isActive === false || port.isActive === false ? 'Inactive Terminal / Port' : '—', icon: 'anchor', iconTint: 'blue', editable: value != null });
            }
          }
        }
        return { data: { rows, warnings } };
      }, providesTags: ['AdminTerminalRates'],
    }),
    updateAdminPricingConfig: builder.mutation({
      queryFn: (args, api, _options, baseQuery) => savePricingSetting('config', args, api, baseQuery),
      invalidatesTags: pricingConfigTags,
    }),
    updateAdminPricingTerminalRate: builder.mutation({
      queryFn: (args, api, _options, baseQuery) => savePricingSetting('terminal', args, api, baseQuery),
      invalidatesTags: ['AdminTerminalRates', 'AdminPricing'],
    }),
    updateAdminPricingSurcharge: builder.mutation({
      queryFn: (args, api, _options, baseQuery) => savePricingSetting('surcharge', args, api, baseQuery),
      invalidatesTags: ['AdminPricing'],
    }),
  }),
});
export const { useGetAdminPricingConfigQuery, useGetAdminPricingTerminalRatesQuery, useUpdateAdminPricingConfigMutation, useUpdateAdminPricingTerminalRateMutation, useUpdateAdminPricingSurchargeMutation,
  useGetAdminPricingSummaryQuery, useGetAdminPricingServicesQuery, useGetAdminPricingPriceListsQuery, useGetAdminPricingSurchargesQuery,
  useGetAdminPricingExceptionsQuery, useGetAdminPricingHistoryQuery, useGetAdminPricingRecentHistoryQuery, useGetAdminPricingServiceQuery, useGetAdminPricingServiceFormOptionsQuery, useSaveAdminPricingServiceMutation, useChangeAdminPricingRecordMutation, useExportAdminPricingServicesMutation } = pricingApi;
