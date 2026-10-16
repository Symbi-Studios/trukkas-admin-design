import { REPORT_TYPES, COLUMN_GROUPS } from './reportsConfig.js';
import { reportRangeQuery } from './reportDraft.js';
import { metricCount, metricNumber, metricRate, metricComparison, metricSparkline, metricDate } from './reportMetrics.js';

export const reportText = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
export const reportRecord = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const number = (v) => typeof v === 'number' || typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v.trim()) ? Number.isFinite(Number(v)) ? Number(v) : null : null;
export const reportInteger = (v) => Number.isSafeInteger(number(v)) && number(v) >= 0 ? number(v) : null;
export const reportEmails = (v) => [...new Set((Array.isArray(v) ? v : String(v || '').split(',')).map((s) => reportText(s)).filter(Boolean))];
export const validReportEmails = (v) => Array.isArray(v) && v.length > 0 && v.every((email) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email));
export function reportTimestamp(v) {
  if (metricDate(v) == null) return '—';
  return new Date(v).toLocaleString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function periodLabel(v) {
  const p = reportRecord(v);
  if (metricDate(p.from) == null || metricDate(p.to) == null || metricDate(p.from) > metricDate(p.to)) return '—';
  const format = (date) => new Date(date).toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric' });
  return format(p.from) + ' – ' + format(p.to);
}
export function reportEntityScope(filters = {}) {
  const params = {}, type = filters.entityType, id = filters.entity;
  const types = { Forwarder: 'FORWARDER', Exporter: 'EXPORTER', 'Truck Company': 'TRUCKING_COMPANY' };
  if (type && type !== 'All Types') {
    if (!types[type]) return { error: 'This entity type is not supported by the report API.' };
    params.entityType = types[type];
  }
  if (reportText(id) && id !== 'All Entities') params.entityId = id;
  return { params };
}
export function reportConfiguration(draft, admin, mode = 'preview') {
  const range = reportRangeQuery(draft);
  if (!range) return { error: 'Select a valid date range.' };
  if (!REPORT_TYPES.some((r) => r.id === draft.reportType)) return { error: 'Select a supported report type.' };
  if (draft.reportType === 'audit' && admin?.role !== 'SUPER_ADMIN') return { error: 'Audit reports require Super Admin access.' };
  const scope = reportEntityScope(draft.filters); if (scope.error) return scope;
  const allowed = new Set(COLUMN_GROUPS.flatMap((g) => g.columns.map((c) => c.key)));
  const columns = draft.columnGroups.flatMap((g) => g.columns.filter((c) => c.checked).map((c) => c.key));
  if (!columns.length || columns.some((key) => !allowed.has(key))) return { error: 'Select valid report columns.' };
  if (!['xlsx', 'csv', 'pdf', 'json'].includes(draft.format)) return { error: 'Select a supported report format.' };
  const filters = { ...scope.params }, source = draft.filters;
  if (source.status !== 'All Statuses') {
    if (!['Verified', 'Pending', 'Rejected'].includes(source.status)) return { error: 'Select a supported verification status.' };
    filters.status = source.status.toUpperCase();
  }
  if (source.location !== 'All Locations') { if (!reportText(source.location)) return { error: 'Select a valid location.' }; filters.location = source.location; }
  for (const key of ['minAmount', 'maxAmount']) if (source[key] !== '' && source[key] != null) {
    const value = number(source[key]); if (value == null || value < 0) return { error: 'Amounts must be non-negative NGN values.' }; filters[key] = value;
  }
  if (filters.minAmount != null && filters.maxAmount != null && filters.minAmount > filters.maxAmount) return { error: 'Minimum amount must not exceed maximum amount.' };
  const delivery = { method: 'DOWNLOAD' };
  if (mode !== 'preview' && draft.delivery !== 'download') {
    const email = reportText(admin?.email), recipients = email ? [email] : [];
    if (!validReportEmails(recipients)) return { error: 'Your admin email is unavailable. Select Download now or update your profile.' };
    delivery.method = 'EMAIL'; delivery.recipients = recipients;
  }
  if (!['download', 'email', 'schedule'].includes(draft.delivery)) return { error: 'Select a supported delivery method.' };
  const fileSettings = {};
  for (const key of ['includeCharts', 'includeSummary', 'compressFile']) {
    if (typeof draft.fileSettings?.[key] !== 'boolean') return { error: 'Select valid file settings.' };
    fileSettings[key] = draft.fileSettings[key];
  }
  const preset = mode === 'template' ? { 'Last 7 days': 'last_7_days', 'Last 30 days': 'last_30_days', 'This Month': 'this_month' }[draft.dateRangePreset] : null;
  const configuration = { reportType: draft.reportType, dateRangePreset: preset || 'custom', ...(preset ? {} : range), filters, columns, format: draft.format.toUpperCase(), delivery, fileSettings };
  if (mode === 'template' && draft.delivery === 'schedule') {
    const frequency = reportText(draft.scheduleFrequency)?.toUpperCase();
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) return { error: 'Select a supported schedule frequency.' };
    configuration.schedule = { frequency, timezone: 'Africa/Lagos', recipients: [...delivery.recipients] };
  }
  return { configuration };
}
export function adaptReportMeta(value) {
  const dto = reportRecord(value);
  const strings = list => Array.isArray(list) && list.every(v => reportText(v)) ? list : null;
  const reportTypes = strings(dto.reportTypes), columns = strings(dto.columns), formats = strings(dto.formats);
  if (!reportTypes || !columns || !formats || !Array.isArray(dto.columnDefinitions)) throw new Error('The report metadata is missing supported report types, columns or formats.');
  const supportedColumns = reportRecord(dto.supportedColumns), definitions = {};
  for (const type of reportTypes) if (!strings(supportedColumns[type]) || supportedColumns[type].some(key => !columns.includes(key))) throw new Error('The report metadata has invalid supported columns.');
  for (const item of dto.columnDefinitions) {
    if (!reportText(item?.key) || !columns.includes(item.key) || !['string', 'number', 'integer', 'datetime', 'boolean'].includes(item.type) || typeof item.nullable !== 'boolean' || item.unit != null && !reportText(item.unit) || definitions[item.key]) throw new Error('The report metadata contains an invalid column definition.');
    definitions[item.key] = { type: item.type, unit: reportText(item.unit), nullable: item.nullable };
  }
  if (columns.some(key => !definitions[key])) throw new Error('The report metadata omits a column definition.');
  return { reportTypes, columns, formats, supportedColumns, definitions, maxRows: reportInteger(dto.maxRows), retentionDays: reportInteger(dto.retentionDays) };
}
function reportCell(value, definition) {
  if (value == null) return null;
  if (!definition) return typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) ? value : reportText(value);
  const { type, unit } = definition;
  if (type === 'datetime') return metricDate(value) == null ? null : reportTimestamp(value);
  if (type === 'string') return reportText(value);
  if (type === 'boolean') return typeof value === 'boolean' ? value : null;
  const parsed = type === 'integer' ? metricCount(value) : unit === 'percent 0-100' ? metricRate(value) : metricNumber(value);
  if (parsed == null || unit === 'hours' && parsed < 0) return null;
  const formatted = parsed.toLocaleString('en-NG', { maximumFractionDigits: type === 'integer' ? 0 : 2 });
  return unit === 'NGN naira' ? '₦' + formatted : unit === 'percent 0-100' ? formatted + '%' : unit === 'hours' ? formatted + ' hrs' : formatted;
}
export function adaptReportPreview(dto, requested, empty) {
  dto = reportRecord(dto);
  const p = reportRecord(dto.pagination), total = reportInteger(dto.totalRecords), paginationTotal = reportInteger(p.total), limit = reportInteger(p.limit), page = reportInteger(p.page);
  if (dto.reportType !== requested.configuration.reportType || !Array.isArray(dto.rows) || dto.rows.some(r => !r || typeof r !== 'object' || Array.isArray(r)) || page !== requested.page || limit !== requested.limit || !limit || total == null || paginationTotal == null || paginationTotal > total || (!dto.truncated && paginationTotal !== total) || reportInteger(p.totalPages) == null || Math.max(1, p.totalPages) !== Math.max(1, Math.ceil(paginationTotal / limit)) || dto.rows.length !== Math.max(0, Math.min(limit, paginationTotal - (page - 1) * limit)) || typeof dto.truncated !== 'boolean') throw new Error('The report preview is missing valid rows, pagination or truncation information.');
  const summary = reportRecord(dto.summary), metrics = reportRecord(dto.metrics);
  const cards = empty.summary.map(card => ({ ...card, trend: [] }));
  const keys = { total: 'totalVerifications', verified: 'verified', pending: 'pending', rejected: 'rejected', compliance: 'compliancePercent', avgTime: 'avgProcessingHours' };
  // Verification metrics have their own totals. Row counts from other report types must not populate these cards.
  if (dto.reportType === 'verification') for (const card of cards) {
    const key = keys[card.key], source = reportRecord(metrics[key]);
    const parse = card.key === 'compliance' ? metricRate : card.key === 'avgTime' ? value => metricNumber(value) >= 0 ? metricNumber(value) : null : metricCount;
    const current = parse(Object.hasOwn(source, 'value') ? source.value : summary[key]);
    card.value = current == null ? '—' : current.toLocaleString('en-NG', { maximumFractionDigits: card.key === 'avgTime' ? 2 : card.key === 'compliance' ? 1 : 0 }) + (card.key === 'compliance' ? '%' : card.key === 'avgTime' ? ' hrs' : '');
    const comparison = metricComparison(source);
    card.delta = comparison.text; card.direction = comparison.direction; card.trend = metricSparkline(source.sparkline, parse);
  }
  const chart = reportRecord(dto.entityChart), seen = new Set();
  const validChart = chart.metric === 'totalVerifications' && reportText(chart.ranking) && reportText(chart.scope) && Array.isArray(chart.points) && chart.points.length <= 10 && chart.points.every(point => {
    if (!reportText(point?.entityId) || !reportText(point?.entityName) || metricCount(point?.totalVerifications) == null || seen.has(point.entityId)) return false;
    seen.add(point.entityId); return true;
  });
  const entityChart = validChart ? chart.points.map(point => ({ entityId: point.entityId, entityName: point.entityName, totalVerifications: metricCount(point.totalVerifications) })) : [];
  const definitions = requested.metadata?.definitions || {}, supported = requested.metadata?.supportedColumns?.[dto.reportType];
  const rows = dto.rows.map((row, i) => Object.fromEntries([['_rowKey', String((page - 1) * limit + i)], ...requested.configuration.columns.map(key => [key, supported && !supported.includes(key) ? null : reportCell(row[key], definitions[key])])]));
  const bytes = reportInteger(dto.estimatedFileSizeBytes), maxRows = requested.metadata?.maxRows;
  return { ...empty, available: true, rows, totalRecords: total, paginationTotal, entityCount: reportInteger(dto.entityCount), reportId: reportText(dto.reportId), generatedOn: reportTimestamp(dto.generatedOn),
    generatedBy: reportText(reportRecord(dto.generatedBy).name), estimatedFileSizeMb: bytes == null ? null : (bytes / 1000000).toLocaleString('en-NG', { maximumFractionDigits: 3 }),
    comparisonLabel: periodLabel(dto.comparisonPeriod), summary: cards, entityChart, truncated: dto.truncated, pageCount: Math.max(1, p.totalPages), canExport: !dto.truncated && total <= (maxRows == null ? 10000 : Math.min(10000, maxRows)) };
}
export function confirmReportTemplate(value, requested) {
  const dto = reportRecord(value), owner = reportRecord(dto.owner);
  const canonical = item => Array.isArray(item) ? item.map(canonical) : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
  if (!reportText(dto.id) || dto.name !== requested.name.trim() || owner.id !== requested.owner || metricDate(dto.createdAt) == null || JSON.stringify(canonical(dto.configuration)) !== JSON.stringify(canonical(requested.configuration))) throw new Error('The template was submitted, but its saved configuration could not be confirmed. Refresh before retrying.');
  return { id: dto.id, name: dto.name, configuration: dto.configuration, owner: { id: owner.id }, createdAt: dto.createdAt };
}
export function adaptReportExport(dto, configuration) {
  dto = reportRecord(dto);
  if (!reportText(dto.id) || dto.reportType !== configuration.reportType || dto.format !== configuration.format || !reportText(dto.status)) throw new Error('The backend did not identify the generated export and its selected format.');
  return { id: dto.id, reportId: reportText(dto.reportId), reportType: dto.reportType, status: dto.status, format: dto.format,
    filename: reportText(dto.filename), contentType: reportText(dto.contentType), sizeBytes: reportInteger(dto.sizeBytes), rowCount: reportInteger(dto.rowCount),
    expiresAt: reportText(dto.expiresAt), deliveryStatus: reportText(dto.deliveryStatus), deliveryError: reportText(dto.deliveryError), error: reportText(dto.error), createdAt: reportText(dto.createdAt),
    deliveredTo: Array.isArray(dto.deliveredTo) ? dto.deliveredTo.filter((v) => reportText(v)) : null };
}
