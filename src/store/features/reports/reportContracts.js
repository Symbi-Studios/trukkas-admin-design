import { REPORT_TYPES, COLUMN_GROUPS } from './reportsConfig.js';
import { reportRangeQuery } from './reportDraft.js';

export const reportText = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
export const reportRecord = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const number = (v) => typeof v === 'number' || typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v.trim()) ? Number.isFinite(Number(v)) ? Number(v) : null : null;
export const reportInteger = (v) => Number.isSafeInteger(number(v)) && number(v) >= 0 ? number(v) : null;
export const reportEmails = (v) => [...new Set((Array.isArray(v) ? v : String(v || '').split(',')).map((s) => reportText(s)).filter(Boolean))];
export const validReportEmails = (v) => Array.isArray(v) && v.length > 0 && v.every((email) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email));
export function reportTimestamp(v) {
  if (!reportText(v) || Number.isNaN(new Date(v).getTime())) return '—';
  return new Date(v).toLocaleString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function periodLabel(v) {
  const p = reportRecord(v);
  if (![p.from, p.to].every((date) => reportText(date) && !Number.isNaN(new Date(date).getTime()))) return '—';
  const format = (date) => new Date(date).toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric' });
  return format(p.from) + ' – ' + format(p.to);
}
export function reportEntityScope(filters = {}) {
  const params = {}, type = filters.entityType, id = filters.entity;
  if (type === 'Exporter' && (!reportText(id) || id === 'All Entities')) return { error: 'Exporter-wide filtering is not documented. Select a specific exporter.' };
  const types = { Forwarder: 'FORWARDER', Exporter: 'FORWARDER', 'Truck Company': 'TRUCKING_COMPANY' };
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
    if (mode === 'template' && draft.delivery === 'schedule') return { error: 'Template configurations do not document schedule timing. Select Download now or Email me before saving a template.' };
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
  return { configuration: { reportType: draft.reportType, dateRangePreset: preset || 'custom', ...(preset ? {} : range), filters, columns, format: draft.format.toUpperCase(), delivery, fileSettings } };
}
export function adaptReportPreview(dto, requested, empty) {
  dto = reportRecord(dto);
  const p = reportRecord(dto.pagination), total = reportInteger(dto.totalRecords), paginationTotal = reportInteger(p.total), limit = reportInteger(p.limit), page = reportInteger(p.page);
  if (dto.reportType !== requested.configuration.reportType || !Array.isArray(dto.rows) || dto.rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r)) || page !== requested.page || limit !== requested.limit || total == null || paginationTotal == null || paginationTotal > total || (!dto.truncated && paginationTotal !== total) || reportInteger(p.totalPages) == null || Math.max(1, p.totalPages) !== Math.max(1, Math.ceil(paginationTotal / limit)) || dto.rows.length > limit || typeof dto.truncated !== 'boolean') throw new Error('The report preview is missing valid rows, pagination or truncation information.');
  const summary = reportRecord(dto.summary), chart = Array.isArray(dto.chart) ? dto.chart : [];
  const cards = empty.summary.map((card) => ({ ...card, trend: [] }));
  const set = (key, value) => { const card = cards.find((c) => c.key === key); if (card) card.value = value; };
  const formattedCount = (v) => reportInteger(v) == null ? '—' : reportInteger(v).toLocaleString('en-NG');
  // totalRecords is a report row count, not necessarily a verification count.
  if (dto.reportType === 'verification') {
    set('total', formattedCount(summary.totalVerifications));
    for (const [key, status] of [['verified', 'VERIFIED'], ['pending', 'PENDING'], ['rejected', 'REJECTED']]) {
      const item = chart.find((c) => c?.label === status);
      set(key, formattedCount(item?.value));
    }
    const compliance = number(summary.complianceRate);
    if (compliance != null && compliance >= 0 && compliance <= 100) set('compliance', compliance.toLocaleString('en-NG', { maximumFractionDigits: 1 }) + '%');
    const hours = number(summary.avgProcessingHours);
    if (hours != null && hours >= 0) set('avgTime', hours.toLocaleString('en-NG', { maximumFractionDigits: 2 }) + ' hrs');
  }
  const bytes = reportInteger(dto.estimatedFileSizeBytes);
  // The documented chart groups status. It does not supply the existing Top 10 entity plot.
  const entityChart = [];
  return { ...empty, available: true, rows: dto.rows.map((row, i) => ({ ...row, _rowKey: String((page - 1) * limit + i) })),
    totalRecords: total, paginationTotal, entityCount: reportInteger(dto.entityCount), reportId: reportText(dto.reportId), generatedOn: reportTimestamp(dto.generatedOn),
    generatedBy: reportText(reportRecord(dto.generatedBy).name), estimatedFileSizeMb: bytes == null ? null : (bytes / 1000000).toLocaleString('en-NG', { maximumFractionDigits: 3 }),
    comparisonLabel: periodLabel(dto.comparisonPeriod), summary: cards, entityChart, truncated: dto.truncated, pageCount: Math.max(1, p.totalPages), canExport: !dto.truncated && total <= 10000 };
}
export function adaptReportExport(dto, configuration) {
  dto = reportRecord(dto);
  if (!reportText(dto.id) || dto.reportType !== configuration.reportType || dto.format !== configuration.format || !reportText(dto.status)) throw new Error('The backend did not identify the generated export and its selected format.');
  return { id: dto.id, reportId: reportText(dto.reportId), reportType: dto.reportType, status: dto.status, format: dto.format,
    filename: reportText(dto.filename), contentType: reportText(dto.contentType), sizeBytes: reportInteger(dto.sizeBytes), rowCount: reportInteger(dto.rowCount),
    expiresAt: reportText(dto.expiresAt), deliveryStatus: reportText(dto.deliveryStatus), deliveryError: reportText(dto.deliveryError), error: reportText(dto.error), createdAt: reportText(dto.createdAt),
    deliveredTo: Array.isArray(dto.deliveredTo) ? dto.deliveredTo.filter((v) => reportText(v)) : null };
}
