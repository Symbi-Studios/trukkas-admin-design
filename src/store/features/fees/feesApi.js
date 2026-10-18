import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
export function feeNumber(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()))) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= Number.MAX_SAFE_INTEGER ? parsed : null;
}
const count = (value) => Number.isSafeInteger(feeNumber(value)) && feeNumber(value) >= 0 ? feeNumber(value) : null;
const display = (value) => text(value) ?? '—';
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) ?? '—';
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
export const feePeriods = [
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'Year' },
];
export const feeCategories = [
  { value: null, label: 'All Categories' },
  { value: 'PLATFORM', label: 'Platform' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'OTHER', label: 'Other' },
];
const validPeriod = (value) => feePeriods.some((period) => period.value === value);
export function feeMoney(value) {
  const parsed = feeNumber(value);
  return parsed == null ? '—' : (parsed < 0 ? '-' : '') + '₦' + Math.abs(parsed).toLocaleString('en-NG');
}
export function feeMillions(value) {
  const parsed = feeNumber(value);
  return parsed == null ? '—' : (parsed < 0 ? '-' : '') + '₦' + (Math.abs(parsed) / 1000000).toFixed(2) + 'M';
}
export const feeDetailUrl = (rule) => '/fees/detail?id=' + encodeURIComponent(rule.id);
function date(value, includeTime = false) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) || includeTime && value.length === 10) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return '—';
  if (value.length > 10) {
    const [hour, minute, second] = value.slice(11, 19).split(':').map(Number), offset = value.match(/[+-](\d{2}):(\d{2})$/);
    if (hour > 23 || minute > 59 || second > 59 || offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59)) return '—';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', year: 'numeric', month: 'short', day: 'numeric', ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(parsed);
}
const person = (value) => text(value) ?? text(record(value).name) ?? '—';
const labels = (value) => Array.isArray(value) ? value.length ? value.map(label).join(', ') : '—' : label(value);

export const emptyFeeSummary = {
  totalRevenue:null, totalRevenueDelta:'—',
  totalPlatformFees:null, totalPlatformFeesDelta:'—',
  totalCommissions:null, totalCommissionsDelta:'—',
  totalDeductions:null, totalDeductionsDelta:'—',
  avgEffectiveRate:'—', avgEffectiveRateDelta:'—',
  totalFeesCollected:null, totalCommissionsPaid:null,
  totalDeductionsCollected:null, netPlatformRevenue:null, avgEffectiveRateLabel:'—',
};
// These are the existing chart slots, not invented fee distribution records.
export const unavailableFeeDistribution = [
  { label:'Platform Fees', value:null, amount:null, color:'var(--tk-viz-1)' },
  { label:'Service Fees', value:null, amount:null, color:'var(--tk-viz-3)' },
  { label:'Processing Fees', value:null, amount:null, color:'var(--tk-viz-6)' },
  { label:'Other Fees', value:null, amount:null, color:'var(--tk-ink-300)' },
];
// Null means an unknown collection,
// rather than a successful request claiming that there are zero rules.
export const unavailableFeeCatalog = { rules:null, total:null };
const ruleFields = [
  'id','name','sub','description','appliesTo','jobType','cargoType','rate','calcType','status',
  'effectiveFrom','effectiveTo','priority','minFee','maxFee','currency','applicableOn','rounding',
  'taxInclusive','createdBy','createdOn','lastUpdated','userTypes','jobTypes','cargoTypes',
  'locations','otherConditions','formula','exampleJobValue','exampleFee','exampleNote',
];
export const unavailableFeeRule = {
  ...Object.fromEntries(ruleFields.map((field) => [field,'—'])),
  // Keep the existing default rule glyph; it carries no financial information.
  icon:'target', systemRule:null, auditHistory:null, exampleInputLabel:'—',
};

export function adaptAdminFeeRevenue(response) {
  return { ...emptyFeeSummary, totalRevenue: feeNumber(unwrapApiResponseData(response)?.jobs?.platformRevenueMonth) };
}
export function adaptFeeSummary(response) {
  const dto = record(unwrapApiResponseData(response)), ngn = dto.currency === 'NGN';
  const amount = (key) => ngn && feeNumber(record(dto[key]).amount) != null && feeNumber(record(dto[key]).amount) >= 0 ? feeNumber(record(dto[key]).amount) : null;
  const delta = (value) => feeNumber(value) == null ? '—' : (feeNumber(value) > 0 ? '+' : '') + feeNumber(value).toLocaleString('en-NG', { maximumFractionDigits: 2 }) + '%';
  const percent = (value) => feeNumber(value) != null && feeNumber(value) >= 0 && feeNumber(value) <= 100 ? feeNumber(value) : null;
  const currentRate = percent(record(dto.effectiveRate).percent), previousRate = percent(record(dto.effectiveRate).previous);
  const rateLabel = currentRate == null ? '—' : currentRate.toLocaleString('en-NG', { maximumFractionDigits: 2 }) + '%';
  const distribution = Array.isArray(dto.distribution) ? dto.distribution : [];
  const keys = ['PLATFORM', 'SERVICE', 'PROCESSING', 'OTHER'];
  return {
    summary: { ...emptyFeeSummary,
      totalRevenue: amount('revenue'), totalRevenueDelta: delta(record(dto.revenue).deltaPercent),
      totalPlatformFees: amount('platformFees'), totalPlatformFeesDelta: delta(record(dto.platformFees).deltaPercent),
      totalCommissions: amount('commissionsPaid'), totalCommissionsDelta: delta(record(dto.commissionsPaid).deltaPercent),
      totalDeductions: amount('deductions'), totalDeductionsDelta: delta(record(dto.deductions).deltaPercent),
      avgEffectiveRate: rateLabel, avgEffectiveRateLabel: rateLabel,
      avgEffectiveRateDelta: currentRate != null && previousRate > 0 ? delta((currentRate - previousRate) / previousRate * 100) : '—',
      totalFeesCollected: amount('feesCollected'), totalCommissionsPaid: amount('commissionsPaid'),
      totalDeductionsCollected: amount('deductions'), netPlatformRevenue: amount('netPlatformRevenue'),
    },
    distribution: unavailableFeeDistribution.map((slot, index) => {
      const matches = distribution.filter((entry) => record(entry).key === keys[index]);
      const entry = matches.length === 1 ? record(matches[0]) : {};
      return { ...slot, value: percent(entry.percent), amount: ngn && feeNumber(entry.amount) != null && feeNumber(entry.amount) >= 0 ? feeNumber(entry.amount) : null };
    }),
  };
}
export function adaptFeeRule(value) {
  const dto = record(value), id = text(dto.id);
  if (!id) return null;
  const calculationType = text(dto.calculationType);
  const example = record(dto.example), inputs = record(example.inputs);
  const exampleLabels = { JOB_VALUE: 'Job Value', WITHDRAWAL_AMOUNT: 'Withdrawal Amount', DEPOSIT_AMOUNT: 'Deposit Amount', DEMURRAGE_AMOUNT: 'Demurrage Amount', LATE_DELIVERY_DEDUCTION: 'Late Delivery Deduction', SUBTOTAL: 'Subtotal', NONE: 'Input' };
  const exampleInput = example.inputKind === 'JOB_VALUE' && example.jobValueApplicable === true ? inputs.jobValue ?? inputs.amount
    : ['WITHDRAWAL_AMOUNT', 'DEPOSIT_AMOUNT', 'DEMURRAGE_AMOUNT', 'LATE_DELIVERY_DEDUCTION', 'SUBTOTAL'].includes(example.inputKind) ? inputs.amount : null;
  const numericValue = calculationType === 'FLAT' ? dto.currency === 'NGN' ? feeNumber(dto.amount) : null : calculationType === 'PERCENTAGE' ? feeNumber(dto.rate) : null;
  return {
    ...unavailableFeeRule, id, name: display(dto.name), sub: display(dto.subtitle), description: display(dto.description),
    category: text(dto.category), location: display(dto.location), appliesTo: display(dto.appliesTo), jobType: label(dto.jobType), cargoType: label(dto.cargoType),
    calcType: label(calculationType), calculationType, numericValue,
    rate: numericValue == null ? '—' : calculationType === 'FLAT' ? feeMoney(numericValue) : numericValue.toLocaleString('en-NG') + '%',
    status: label(dto.status), statusCode: text(dto.status), effectiveFrom: date(dto.effectiveFrom), effectiveTo: date(dto.effectiveTo),
    icon: unavailableFeeRule.icon, iconTint: 'blue', currency: display(dto.currency),
    systemRule: typeof dto.systemRule === 'boolean' ? dto.systemRule : null,
    editable: typeof dto.editable === 'boolean' ? dto.editable : null,
    charged: typeof dto.charged === 'boolean' ? dto.charged : null,
    priority: count(dto.priority) ?? '—', minFee: dto.currency === 'NGN' ? feeMoney(dto.minimumFee) : '—', maxFee: dto.currency === 'NGN' ? feeMoney(dto.maximumFee) : '—',
    applicableOn: display(dto.applicableOn), rounding: display(dto.rounding), taxInclusive: typeof dto.taxInclusive === 'boolean' ? dto.taxInclusive ? 'Yes' : 'No' : '—',
    createdBy: person(dto.createdBy), createdOn: date(dto.createdAt), lastUpdated: date(dto.updatedAt),
    userTypes: labels(dto.userTypes), jobTypes: labels(dto.jobTypes), cargoTypes: labels(dto.cargoTypes), locations: labels(dto.locations), otherConditions: labels(dto.conditions),
    formula: display(dto.formula), exampleInputLabel: exampleLabels[example.inputKind] || '—', exampleJobValue: dto.currency === 'NGN' ? feeMoney(exampleInput) : '—',
    exampleFee: dto.currency === 'NGN' ? feeMoney(dto.example?.result) : '—', exampleNote: display(dto.example?.note),
  };
}

async function allPages(baseQuery, api, url, select, identity) {
  const rows = [], seen = new Set(), owner = api.getState().auth.admin?.id;
  let total = null, pages = null;
  for (let page = 1; page <= 500; page += 1) {
    if (api.signal.aborted || api.getState().auth.admin?.id !== owner) return failure('Fee loading was cancelled.');
    const result = await baseQuery({ url, params: { page, limit: 100 } });
    if (result.error) return result;
    if (api.getState().auth.admin?.id !== owner) return failure('Fee loading was cancelled.');
    const dto = record(unwrapApiResponseData(result.data)), list = select(dto), p = record(dto.pagination);
    const nextTotal = count(p.total), nextPages = count(p.totalPages), limit = count(p.limit);
    if (!Array.isArray(list) || count(p.page) !== page || nextTotal == null || nextPages == null || !limit || limit > 100 || nextPages > 500 || Math.max(1, nextPages) !== Math.max(1, Math.ceil(nextTotal / limit)) || list.length > limit) return failure('The response is missing a complete fee collection or valid pagination.');
    if (total != null && (total !== nextTotal || pages !== nextPages)) return failure('Fee records changed while loading. Refresh and try again.');
    total = nextTotal; pages = nextPages;
    for (const entry of list) {
      const key = identity(entry);
      if (!key || seen.has(key)) return failure('The fee response contains missing or repeated records.');
      seen.add(key); rows.push(entry);
    }
    if (page >= pages) return rows.length === total ? { data: rows } : failure('The complete fee collection could not be loaded.');
    if (list.length !== limit) return failure('The fee response contains an incomplete page.');
  }
  return failure('The fee collection exceeds the supported page count.');
}
function historyRows(dto) {
  return Array.isArray(dto.events) ? dto.events : null;
}
function adaptHistory(row) {
  const changes = Array.isArray(row.changes) ? row.changes.map((entry) => {
    const change = record(entry);
    const before = typeof change.before === 'boolean' ? String(change.before) : feeNumber(change.before) ?? text(change.before) ?? '—';
    const after = typeof change.after === 'boolean' ? String(change.after) : feeNumber(change.after) ?? text(change.after) ?? '—';
    const pct = feeNumber(change.changePercent);
    return display(change.field) + ': ' + before + ' → ' + after + (pct == null ? '' : ' (' + pct + '%)');
  }).join('; ') : '—';
  return { id: text(row.id), date: date(row.timestamp, true), action: label(row.action), by: person(row.performedBy), changes: changes || '—' };
}
export function validFeeValue(rule, value) {
  const parsed = feeNumber(value), maximum = rule?.calculationType === 'PERCENTAGE' ? 100 : rule?.calculationType === 'FLAT' ? 10000000 : null;
  return parsed != null && parsed >= 0 && maximum != null && parsed <= maximum && /^\d+(?:\.\d{1,2})?$/.test(String(parsed));
}
export const editableFeeRule = (rule) => Boolean(rule?.id && rule.editable === true && ['ACTIVE', 'INACTIVE'].includes(rule.statusCode) && validFeeValue(rule, rule.numericValue) && (rule.calculationType === 'PERCENTAGE' || rule.calculationType === 'FLAT' && rule.currency === 'NGN'));
const canManage = (api) => Boolean(api.getState().auth.accessToken && api.getState().auth.admin?.id && ['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(api.getState().auth.admin?.role));
const ruleMatches = (fresh, original) => fresh?.id === original?.id && fresh?.calculationType === original?.calculationType && fresh?.currency === original?.currency && fresh?.numericValue === original?.numericValue && fresh?.statusCode === original?.statusCode;
async function readRule(baseQuery, id) {
  if (!text(id)) return failure('Select a valid fee rule.');
  const result = await baseQuery({ url: '/admin/fees/rules/' + encodeURIComponent(id) });
  if (result.error) return result;
  const dto = record(unwrapApiResponseData(result.data));
  return dto.id === id ? { data: adaptFeeRule(dto) } : failure('The response does not belong to the selected fee rule.');
}
async function updateRule({ rule, value, status }, api, baseQuery) {
  if (!canManage(api)) return { error: { status: 403, data: { message: 'Fee changes require Super Admin or Finance Admin access.' } } };
  if (!editableFeeRule(rule)) return failure('This fee rule is read-only or has an unavailable value.');
  const isStatus = status != null, parsed = feeNumber(value);
  if (isStatus ? !['ACTIVE', 'INACTIVE'].includes(status) : !validFeeValue(rule, parsed)) return failure('Enter a valid fee amount or rate.');
  const admin = api.getState().auth.admin;
  const sameSession = () => !api.signal.aborted && canManage(api) && api.getState().auth.admin?.id === admin.id && api.getState().auth.admin?.role === admin.role;
  const fresh = await readRule(baseQuery, rule.id);
  if (fresh.error) return fresh;
  if (!sameSession()) return failure('The session changed. Refresh before continuing.');
  if (!editableFeeRule(fresh.data) || !ruleMatches(fresh.data, rule)) return failure('This fee rule changed. Refresh its details before saving.');
  const field = rule.calculationType === 'FLAT' ? 'amount' : 'rate';
  const body = isStatus ? { status } : { [field]: parsed };
  const result = await baseQuery({ url: '/admin/fees/rules/' + encodeURIComponent(rule.id) + (isStatus ? '/status' : ''), method: 'PATCH', body });
  if (result.error) return result;
  const confirmed = await readRule(baseQuery, rule.id);
  if (confirmed.error) return confirmed;
  if (!sameSession() || confirmed.data.calculationType !== rule.calculationType || confirmed.data.currency !== rule.currency) return failure('The fee rule changed while saving. Refresh its details.');
  if (isStatus ? confirmed.data.statusCode !== status || status === 'INACTIVE' && confirmed.data.numericValue !== 0 || status === 'ACTIVE' && !(confirmed.data.numericValue > 0) : confirmed.data.numericValue !== parsed) return failure('The requested fee change could not be confirmed. Refresh its details.');
  return confirmed;
}
async function bulkUpdate({ updates }, api, baseQuery) {
  if (!canManage(api)) return { error: { status: 403, data: { message: 'Fee changes require Super Admin or Finance Admin access.' } } };
  if (!Array.isArray(updates) || !updates.length || new Set(updates.map((entry) => entry?.rule?.id)).size !== updates.length || updates.some((entry) => !editableFeeRule(entry?.rule) || !validFeeValue(entry.rule, entry.value))) return failure('Select valid, editable fee changes.');
  const admin = api.getState().auth.admin;
  const sameSession = () => !api.signal.aborted && canManage(api) && api.getState().auth.admin?.id === admin.id && api.getState().auth.admin?.role === admin.role;
  for (const entry of updates) {
    if (!sameSession()) return failure('The session changed. Refresh before continuing.');
    const fresh = await readRule(baseQuery, entry.rule.id);
    if (fresh.error) return fresh;
    if (!editableFeeRule(fresh.data) || !ruleMatches(fresh.data, entry.rule)) return failure('A selected fee rule changed. Refresh the rules before saving.');
  }
  if (!sameSession()) return failure('The session changed. Refresh before continuing.');
  const result = await baseQuery({ url: '/admin/fees/rules/bulk', method: 'PATCH', body: { updates: updates.map(({ rule, value }) => ({ id: rule.id, [rule.calculationType === 'FLAT' ? 'amount' : 'rate']: feeNumber(value) })) } });
  if (result.error) return result;
  const dto = record(unwrapApiResponseData(result.data)), requestedIds = new Set(updates.map((entry) => entry.rule.id));
  if (!sameSession() || !Array.isArray(dto.updated) || !Array.isArray(dto.failures)) return failure('The bulk update was submitted but its result could not be confirmed. Refresh and review the rules before retrying.');
  const reported = [...dto.updated, ...dto.failures];
  if (reported.length !== updates.length || reported.some((entry) => !requestedIds.has(entry?.id)) || new Set(reported.map((entry) => entry.id)).size !== reported.length) return failure('The bulk update response did not identify every requested result. Refresh and review the rules.');
  const saved = new Map(dto.updated.map((entry) => [entry.id, adaptFeeRule(entry)])), rejected = new Map(dto.failures.map((entry) => [entry.id, entry]));
  const verified = [], failures = [];
  for (const entry of updates) {
    if (!sameSession()) return failure('Bulk updates may have partly applied. Refresh and review their values.');
    const rejection = rejected.get(entry.rule.id);
    if (rejection) {
      failures.push({ id: entry.rule.id, message: text(rejection.reason) || text(rejection.error) || 'The backend rejected this fee change.', errorCode: text(rejection.errorCode) });
      continue;
    }
    const returned = saved.get(entry.rule.id), confirmed = await readRule(baseQuery, entry.rule.id);
    if (!confirmed.error && sameSession() && returned?.numericValue === feeNumber(entry.value) && returned.calculationType === entry.rule.calculationType && returned.currency === entry.rule.currency
      && confirmed.data.calculationType === entry.rule.calculationType && confirmed.data.currency === entry.rule.currency && confirmed.data.numericValue === feeNumber(entry.value)) verified.push(confirmed.data);
    else failures.push({ id: entry.rule.id, message: 'The requested value could not be confirmed.' });
  }
  return { data: { verified, failures, reportedFailureCount: dto.failures.length } };
}
function feeDocumentFilename(headers, format, fallback) {
  const safe = (value) => {
    if (!text(value)) return null;
    const name = value.split(/[\\/]/).pop().replace(/[<>:"|?*\x00-\x1f\x7f]/g, '').trim();
    return name.length <= 180 && !name.startsWith('.') && name.toLowerCase().endsWith('.' + format) ? name : null;
  };
  const disposition = headers?.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*\s*=\s*UTF-8'[^']*'([^;]+)/i)?.[1];
  const plain = disposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  let name = null;
  if (encoded) { try { name = safe(decodeURIComponent(encoded.trim())); } catch { /* Fall back to the regular filename. */ } }
  return name || safe(plain?.[1] || plain?.[2]) || safe(fallback + '.' + format) || 'fees.' + format;
}
async function download(baseQuery, api, url, format, filters = {}, fallback = 'fees') {
  if (!['csv', 'pdf'].includes(format)) return failure('Unsupported fee export format.');
  if (filters.status && !['ACTIVE', 'INACTIVE'].includes(filters.status)) return failure('Draft fee rules are not supported by the backend.');
  const admin = api.getState().auth.admin;
  const sameSession = () => !api.signal.aborted && api.getState().auth.accessToken && admin?.id && api.getState().auth.admin?.id === admin.id && api.getState().auth.admin?.role === admin.role;
  if (!sameSession()) return failure('Sign in before downloading fee documents.');
  const result = await baseQuery({ url, params: { ...filters, format }, headers: { Accept: format === 'pdf' ? 'application/pdf' : 'text/csv' }, responseHandler: async (response) => {
    if (response.ok) return response.blob();
    const body = await response.text();
    try { return JSON.parse(body); } catch { return { message: 'Unable to download the fee document.' }; }
  } });
  if (result.error) return result;
  if (!sameSession()) return failure('The session changed. Download the fee document again.');
  if (!(result.data instanceof Blob) || !result.data.size) return failure('The backend did not return a fee document.');
  const expectedType = format === 'pdf' ? 'application/pdf' : 'text/csv';
  if (result.data.type.split(';')[0].trim().toLowerCase() !== expectedType) return failure('The backend returned an unexpected fee document type.');
  const bytes = new Uint8Array(await result.data.arrayBuffer());
  if (format === 'pdf' && String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return failure('The backend did not return a valid PDF.');
  if (format === 'csv') {
    const csv = new TextDecoder().decode(bytes).trimStart();
    if (!csv || /^(?:[\[{]|<(?:!doctype|html))/i.test(csv) || result.data.type.includes('json') || result.data.type.includes('html')) return failure('The backend did not return a valid CSV.');
  }
  let binary = '';
  for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
  if (!sameSession()) return failure('The session changed. Download the fee document again.');
  return { data: { content: btoa(binary), format, filename: feeDocumentFilename(result.meta?.response?.headers, format, fallback) } };
}
async function exportFeeRules({ format, filters = {} }, api, baseQuery) {
  const params = Object.fromEntries(['search', 'status', 'jobType', 'cargoType', 'location', 'category'].map((key) => [key, text(filters[key])]).filter(([, value]) => value != null));
  if (!['csv', 'pdf'].includes(format)) return failure('Unsupported fee export format.');
  if (params.status && !['ACTIVE', 'INACTIVE'].includes(params.status)) return failure('Draft fee rules are not supported by the backend.');
  if (params.category && !feeCategories.some((category) => category.value === params.category)) return failure('Select a supported fee category.');
  const owner = api.getState().auth.admin?.id;
  if (!owner || api.signal.aborted) return failure('Sign in before downloading fee documents.');
  // The documented file endpoint caps exports at 100; never download a silently truncated catalog.
  const preview = await baseQuery({ url: '/admin/fees/rules', params: { ...params, page: 1, limit: 100 } });
  if (preview.error) return preview;
  if (api.signal.aborted || api.getState().auth.admin?.id !== owner) return failure('The session changed. Download the fee document again.');
  const dto = record(unwrapApiResponseData(preview.data)), total = count(record(dto.pagination).total);
  if (total == null || !Array.isArray(dto.rules)) return failure('The complete fee export scope could not be confirmed.');
  if (total > 100) return failure('The backend exports at most 100 fee rules. Narrow the filters before exporting.');
  if (dto.rules.length !== total) return failure('The complete fee export scope could not be confirmed.');
  return download(baseQuery, api, '/admin/fees/rules/export', format, params, 'fee-rules');
}
export function saveFeeDocument(document, name) {
  const bytes = Uint8Array.from(atob(document.content), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: document.format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8' }));
  const link = window.document.createElement('a'); link.href = url; link.download = document.filename || name + '.' + document.format; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const feeTags = ['AdminFeeRules', 'AdminFeeHistory', 'AdminFeeSummary', 'AdminFeeRevenue'];
const changedTags = [...feeTags, 'AdminPricingConfig', 'AdminTerminalRates', 'AdminEscrowOverview', 'AdminAuditLogs'];
export const feesApi = baseApi.enhanceEndpoints({ addTagTypes: changedTags }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminFeeRevenue: builder.query({ query: () => ({ url: '/admin/overview' }), transformResponse: adaptAdminFeeRevenue, providesTags: ['AdminFeeRevenue'] }),
    getAdminFeeSummary: builder.query({
      async queryFn({ period = 'month' } = {}, _api, _options, baseQuery) {
        if (!validPeriod(period)) return failure('Select a supported fee summary period.');
        const result = await baseQuery({ url: '/admin/fees/summary', params: { period } });
        return result.error ? result : { data: adaptFeeSummary(result.data) };
      }, providesTags: ['AdminFeeSummary'],
    }),
    getAdminFeeRules: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const result = await allPages(baseQuery, api, '/admin/fees/rules', (dto) => dto.rules, (row) => text(row?.id));
        return result.error ? result : { data: { rules: result.data.map(adaptFeeRule), total: result.data.length } };
      }, providesTags: ['AdminFeeRules'],
    }),
    getAdminFeeRule: builder.query({ queryFn: ({ id }, _api, _options, baseQuery) => readRule(baseQuery, id), providesTags: ['AdminFeeRules'] }),
    getAdminFeeRuleHistory: builder.query({
      async queryFn({ id }, api, _options, baseQuery) {
        const result = await allPages(baseQuery, api, '/admin/fees/rules/' + encodeURIComponent(id) + '/history', historyRows, (row) => text(row?.id));
        return result.error ? result : { data: result.data.map(adaptHistory) };
      }, providesTags: ['AdminFeeHistory'],
    }),
    updateAdminFeeRule: builder.mutation({ queryFn: (args, api, _options, baseQuery) => updateRule(args, api, baseQuery), invalidatesTags: changedTags }),
    setAdminFeeRuleStatus: builder.mutation({ queryFn: (args, api, _options, baseQuery) => updateRule(args, api, baseQuery), invalidatesTags: changedTags }),
    bulkUpdateAdminFeeRules: builder.mutation({ queryFn: (args, api, _options, baseQuery) => bulkUpdate(args, api, baseQuery), invalidatesTags: changedTags }),
    getAdminFeeRulesExport: builder.query({ queryFn: (args, api, _options, baseQuery) => exportFeeRules(args, api, baseQuery), keepUnusedDataFor: 0 }),
    getAdminFeeRuleExport: builder.query({ queryFn: ({ id, format }, api, _options, baseQuery) => text(id) ? download(baseQuery, api, '/admin/fees/rules/' + encodeURIComponent(id) + '/export', format, {}, 'fee-rule-' + id) : failure('Select a valid fee rule.'), keepUnusedDataFor: 0 }),
    getAdminFeeReport: builder.query({ queryFn: ({ format, period = 'month' }, api, _options, baseQuery) => validPeriod(period) ? download(baseQuery, api, '/admin/fees/report', format, { period }, 'fees-report') : failure('Select a supported fee report period.'), keepUnusedDataFor: 0 }),
  }),
});
export const { useGetAdminFeeRevenueQuery, useGetAdminFeeSummaryQuery, useGetAdminFeeRulesQuery, useGetAdminFeeRuleQuery, useGetAdminFeeRuleHistoryQuery, useUpdateAdminFeeRuleMutation, useSetAdminFeeRuleStatusMutation, useBulkUpdateAdminFeeRulesMutation, useLazyGetAdminFeeRulesExportQuery, useLazyGetAdminFeeRuleExportQuery, useLazyGetAdminFeeReportQuery } = feesApi;
