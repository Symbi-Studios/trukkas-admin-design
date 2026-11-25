'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '../../router.js';
import { PageHeader, Button, Select, TextField, Checkbox, Icon, Banner } from '../../ds.js';
import { useReportDraft, useReportEntities } from '../../store/features/reports/useReportDraft.js';
import { COLUMN_GROUPS, REPORT_TYPES, STATUS_OPTIONS } from '../../store/features/reports/reportsConfig.js';
import { reportRangeQuery } from '../../store/features/reports/reportDraft.js';
import { useGetAdminReportMetaQuery } from '../../store/features/reports/reportsApi.js';
import { useReportPreview } from '../../store/features/reports/useReportPreview.js';
import { useReportOperations, useReportSession } from '../../store/features/reports/useReportOperations.js';
import { ReportTemplateDialog } from '../ReportDialogs.jsx';
import { Segmented, fmtCount, shortRange } from './analyticsShared.jsx';
import styles from './ReportBuilder.module.css';

const PAGE_SIZE = 25;
const DATE_OPTIONS = [
  { value: 'Last 7 days', label: '7 days' },
  { value: 'Last 30 days', label: '30 days' },
  { value: 'This Month', label: 'This month' },
  { value: 'Custom Range', label: 'Custom' },
];
const FORMAT_LABEL = { xlsx: 'XLSX', csv: 'CSV', pdf: 'PDF', json: 'JSON' };
const LABELS = Object.fromEntries(COLUMN_GROUPS.flatMap((g) => g.columns.map((c) => [c.key, c.label])));
const SHARED_GROUPS = new Set(['General Information', 'Metadata']);
const SHARED_KEYS = new Set(COLUMN_GROUPS.filter((g) => SHARED_GROUPS.has(g.group)).flatMap((g) => g.columns.map((c) => c.key)));
const IDENTITY = ['entityName', 'entityType', 'entityCode'];

/** A type starts with who the row is about, everything specific to that type, and the record ID. */
function defaultColumns(supported) {
  return [
    ...IDENTITY.filter((key) => supported.includes(key)),
    ...supported.filter((key) => !SHARED_KEYS.has(key)),
    ...(supported.includes('recordId') ? ['recordId'] : []),
  ];
}

function Section({ title, aside, hint, children }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <h3>{title}</h3>
        {aside}
      </header>
      {hint && <p className={styles.hint}>{hint}</p>}
      {children}
    </section>
  );
}

/** "about 2.4 MB", "about 8 KB" or "under 1 KB" from the preview's MB estimate. */
function fileSize(mbText) {
  const mb = Number(String(mbText ?? '').replace(/,/g, ''));
  if (mbText == null || !Number.isFinite(mb)) return null;
  if (mb >= 1) return `about ${mb.toLocaleString('en-NG', { maximumFractionDigits: 1 })} MB`;
  const kb = Math.round(mb * 1000);
  return kb >= 1 ? `about ${kb} KB` : 'under 1 KB';
}

function cell(value) {
  return typeof value === 'string' && value.trim() ? value : typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-NG') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : '—';
}

export function ReportBuilder() {
  const session = useReportSession();
  return <ReportBuilderScreen key={session.key} />;
}

function ReportBuilderScreen() {
  const navigate = useNavigate();
  const { draft, updateReportDraft, setReportColumns } = useReportDraft();
  const operations = useReportOperations(draft);
  const { admin, owner, role, authenticated } = operations;
  const meta = useGetAdminReportMetaQuery({ owner, role }, { skip: !authenticated });
  const metadata = authenticated && !meta.error ? meta.data : null;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const { options: entityOptions } = useReportEntities(draft.filters.entityType);
  const type = REPORT_TYPES.find((t) => t.id === draft.reportType) || REPORT_TYPES[0];
  const superAdmin = role === 'SUPER_ADMIN';

  // Keep the selected columns to the ones this report type can fill.
  const supported = useMemo(() => metadata?.supportedColumns?.[draft.reportType] || null, [metadata, draft.reportType]);
  const checked = draft.columnGroups.flatMap((g) => g.columns.filter((c) => c.checked).map((c) => c.key));
  const previousType = useRef(draft.reportType);
  useEffect(() => {
    if (!supported) return;
    const typeChanged = previousType.current !== draft.reportType;
    previousType.current = draft.reportType;
    const valid = checked.filter((key) => supported.includes(key));
    if (typeChanged || !valid.length) setReportColumns(defaultColumns(supported));
    else if (valid.length !== checked.length) setReportColumns(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, draft.reportType]);
  const selected = supported ? checked.filter((key) => supported.includes(key)) : checked;

  const configurationKey = JSON.stringify([draft.reportType, draft.dateFrom, draft.dateTo, draft.filters, selected]);
  const lastKey = useRef(configurationKey);
  useEffect(() => { if (lastKey.current !== configurationKey) { lastKey.current = configurationKey; setPage(1); } }, [configurationKey]);
  useEffect(() => { setSaveOpen(false); setTemplateName(''); }, [owner]);

  const result = useReportPreview(draft, page, PAGE_SIZE);
  // While a new preview loads, keep the last one on screen (dimmed) instead of flashing placeholders.
  const lastPreview = useRef(null);
  if (result.preview.available) lastPreview.current = result.preview;
  const preview = result.preview.available ? result.preview : result.loading && lastPreview.current ? lastPreview.current : result.preview;
  const ready = result.preview.available && !result.loading;
  const columns = selected;
  const firstLoad = result.loading && !preview.available;
  const formats = (metadata?.formats || ['XLSX', 'CSV', 'PDF', 'JSON']).map((f) => f.toLowerCase()).filter((f) => FORMAT_LABEL[f]);
  const showsAmount = supported ? supported.includes('totalRevenue') : true;
  const showsStatus = supported ? supported.includes('verificationStatus') : true;
  const busy = operations.busy;
  const email = admin?.email;
  const canRun = authenticated && !busy && ready && result.preview.canExport && !result.configurationError && selected.length > 0;
  const action = { download: `Download ${FORMAT_LABEL[draft.format] || ''}`, email: 'Email report', schedule: 'Create schedule' }[draft.delivery];
  const filters = draft.filters;
  const setFilter = (patch) => updateReportDraft({ filters: { ...filters, ...patch } });
  const pageCount = preview.pageCount || 1;
  const from = preview.totalRecords ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = preview.totalRecords ? Math.min(page * PAGE_SIZE, preview.paginationTotal ?? preview.totalRecords) : 0;
  const groups = COLUMN_GROUPS.map((g) => ({
    ...g, columns: g.columns.filter((c) => (!supported || supported.includes(c.key)) && c.label.toLowerCase().includes(search.trim().toLowerCase())),
  })).filter((g) => g.columns.length);
  const toggle = (key) => setReportColumns(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  const banner = operations.error || (result.error && !result.loading ? result.error : null);

  return (
    <div className={styles.page}>
      <PageHeader crumbs={[{ label: 'Reports & Analytics', to: '/reports' }, 'New report']} title={`${type.title} report`}
        description={type.description}
        actions={<>
          <Button variant="outline" icon="bookmark" disabled={!authenticated || busy || Boolean(result.configurationError)} onClick={() => setSaveOpen(true)}>Save as template</Button>
          <Button icon={draft.delivery === 'download' ? 'download' : draft.delivery === 'email' ? 'mail' : 'calendar-clock'} disabled={!canRun}
            onClick={() => operations.exportReport(result.preview)}>{busy ? 'Working…' : action}</Button>
        </>} />

      {banner && <Banner tone="error" title={banner} />}

      <div className={styles.layout}>
        <aside className={styles.config} aria-label="Report settings">
          <Section title="Report">
            <div className={styles.types} role="radiogroup" aria-label="Report type">
              {REPORT_TYPES.map((t) => {
                const locked = t.superAdmin && !superAdmin;
                const on = t.id === draft.reportType;
                return (
                  <button key={t.id} type="button" role="radio" aria-checked={on} disabled={locked}
                    className={styles.type + (on ? ' ' + styles.typeOn : '')} title={locked ? 'Super Admin only' : t.description}
                    onClick={() => updateReportDraft({ reportType: t.id })}>
                    <Icon name={t.icon} size={14} aria-hidden="true" />
                    <span>{t.title}</span>
                  </button>
                );
              })}
            </div>
            <p className={styles.hint}>One row per {type.row}.</p>
          </Section>

          <Section title="Dates" hint={type.dated ? undefined : 'This report isn’t filtered by date.'}>
            <Segmented label="Date range" value={draft.dateRangePreset} options={DATE_OPTIONS} onChange={(value) => updateReportDraft({ dateRangePreset: value })} />
            {draft.dateRangePreset === 'Custom Range' ? (
              <div className={styles.row2}>
                <TextField label="From" type="date" value={draft.dateFrom} onChange={(e) => updateReportDraft({ dateFrom: e.target.value })} />
                <TextField label="To" type="date" value={draft.dateTo} onChange={(e) => updateReportDraft({ dateTo: e.target.value })} />
              </div>
            ) : <p className={styles.hint}>{reportRangeQuery(draft) ? shortRange(draft) : '—'}</p>}
          </Section>

          <Section title="Filters">
            <div className={styles.fields}>
              <Select label="Entity type" value={filters.entityType}
                options={[{ value: 'All Types', label: 'All types' }, 'Forwarder', 'Truck Company']}
                onChange={(e) => setFilter({ entityType: e.target.value, entity: 'All Entities' })} />
              <Select label="Entity" value={filters.entity}
                options={entityOptions.map((o) => (o.value === 'All Entities' ? { ...o, label: 'All entities' } : o))}
                onChange={(e) => setFilter({ entity: e.target.value })} />
              {showsStatus && (
                <Select label="Verification status" value={filters.status}
                  options={STATUS_OPTIONS.map((s) => (s === 'All Statuses' ? { value: s, label: 'Any status' } : s))}
                  onChange={(e) => setFilter({ status: e.target.value })} />
              )}
              <TextField label="Location" placeholder="Any location" value={filters.location === 'All Locations' ? '' : filters.location}
                onChange={(e) => setFilter({ location: e.target.value.trim() ? e.target.value : 'All Locations' })} />
              {showsAmount && (
                <div className={styles.row2}>
                  <TextField label="Revenue from (₦)" type="number" placeholder="0" value={filters.minAmount} onChange={(e) => setFilter({ minAmount: e.target.value })} />
                  <TextField label="to (₦)" type="number" placeholder="No limit" value={filters.maxAmount} onChange={(e) => setFilter({ maxAmount: e.target.value })} />
                </div>
              )}
            </div>
          </Section>

          <Section title="Columns" aside={<span className={styles.count}>{selected.length} of {supported?.length ?? '—'}</span>}>
            <div className={styles.columnTools}>
              <TextField icon="search" placeholder="Find a column" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button type="button" className={styles.link} disabled={!supported} onClick={() => setReportColumns(supported)}>All</button>
              <button type="button" className={styles.link} onClick={() => setReportColumns([])}>None</button>
            </div>
            {!supported && <p className={styles.hint}>{meta.error ? 'Columns couldn’t be loaded.' : 'Loading columns…'}</p>}
            {groups.map((g) => (
              <div key={g.group} className={styles.columnGroup}>
                <span className={styles.groupLabel}>{g.group}</span>
                {g.columns.map((c) => <Checkbox key={c.key} label={c.label} checked={selected.includes(c.key)} onChange={() => toggle(c.key)} />)}
              </div>
            ))}
            {supported && search && !groups.length && <p className={styles.hint}>No column matches “{search}”.</p>}
          </Section>

          <Section title="File">
            <Segmented label="Format" value={draft.format} options={formats.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))} onChange={(value) => updateReportDraft({ format: value })} />
            <div className={styles.checks}>
              <Checkbox label="Include a summary" checked={draft.fileSettings.includeSummary} onChange={(v) => updateReportDraft({ fileSettings: { ...draft.fileSettings, includeSummary: Boolean(v) } })} />
              <Checkbox label="Include charts" hint={draft.format === 'csv' ? 'Not available in CSV' : undefined} disabled={draft.format === 'csv'}
                checked={draft.fileSettings.includeCharts && draft.format !== 'csv'} onChange={(v) => updateReportDraft({ fileSettings: { ...draft.fileSettings, includeCharts: Boolean(v) } })} />
              <Checkbox label="Compress as ZIP" checked={draft.fileSettings.compressFile} onChange={(v) => updateReportDraft({ fileSettings: { ...draft.fileSettings, compressFile: Boolean(v) } })} />
            </div>
          </Section>

          <Section title="Delivery">
            <div className={styles.delivery} role="radiogroup" aria-label="Delivery">
              {[
                { value: 'download', label: 'Download now', hint: 'The file downloads in this browser.' },
                { value: 'email', label: 'Email me', hint: email ? `A download link goes to ${email}.` : 'Your admin profile has no email address.' },
                { value: 'schedule', label: 'Schedule', hint: 'Runs at 07:00 Lagos time and emails you a link.' },
              ].map((d) => (
                <button key={d.value} type="button" role="radio" aria-checked={draft.delivery === d.value}
                  className={styles.choice + (draft.delivery === d.value ? ' ' + styles.choiceOn : '')} onClick={() => updateReportDraft({ delivery: d.value })}>
                  <span className={styles.radio} aria-hidden="true" />
                  <span><strong>{d.label}</strong><span>{d.hint}</span></span>
                </button>
              ))}
            </div>
            {draft.delivery === 'schedule' && (
              <>
                <Segmented label="Frequency" value={draft.scheduleFrequency} options={['Daily', 'Weekly', 'Monthly'].map((f) => ({ value: f, label: f }))}
                  onChange={(value) => updateReportDraft({ scheduleFrequency: value })} />
                <p className={styles.hint}>
                  {{ Daily: 'Every morning, covering the day before.', Weekly: 'Every Monday, covering the last 7 days.', Monthly: 'On the 1st, covering the previous month.' }[draft.scheduleFrequency]}
                </p>
              </>
            )}
          </Section>
        </aside>

        <section className={styles.preview} aria-label="Preview">
          <header className={styles.previewHead}>
            <div>
              <h2>Preview</h2>
              <p>
                {firstLoad ? 'Loading…'
                  : preview.available ? <>
                    <strong>{fmtCount(preview.totalRecords)}</strong> {preview.totalRecords === 1 ? 'row' : 'rows'}
                    {preview.entityCount != null && <> · {fmtCount(preview.entityCount)} {preview.entityCount === 1 ? 'entity' : 'entities'}</>}
                    {fileSize(preview.estimatedFileSizeMb) && <> · {fileSize(preview.estimatedFileSizeMb)}</>}
                  </> : result.configurationError || '—'}
              </p>
            </div>
            {preview.available && !preview.canExport && <span className={styles.warn}>Too many rows to export. Narrow the dates or filters.</span>}
          </header>

          <div className={styles.tableWrap} style={{ opacity: result.loading && preview.available ? 0.55 : 1 }}>
            {firstLoad ? (
              <div className={styles.skeleton} aria-busy="true">{Array.from({ length: 8 }, (_, i) => <span key={i} />)}</div>
            ) : !columns.length ? (
              <p className={styles.empty}>Choose at least one column.</p>
            ) : preview.available && !preview.rows.length ? (
              <p className={styles.empty}>No rows match. Try a wider date range or fewer filters.</p>
            ) : preview.available ? (
              <table className={styles.table}>
                <thead><tr>{columns.map((key) => <th key={key}>{LABELS[key] || key}</th>)}</tr></thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row._rowKey}>{columns.map((key) => <td key={key} title={typeof row[key] === 'string' ? row[key] : undefined}>{cell(row[key])}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            ) : <p className={styles.empty}>{result.error || 'The preview isn’t available.'}</p>}
          </div>

          {preview.available && pageCount > 1 && (
            <footer className={styles.pager}>
              <span>{fmtCount(from)}–{fmtCount(to)} of {fmtCount(preview.paginationTotal ?? preview.totalRecords)}</span>
              <Button variant="outline" size="sm" disabled={page <= 1 || result.loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount || result.loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </footer>
          )}
        </section>
      </div>

      {saveOpen && <ReportTemplateDialog key={owner} name={templateName} onNameChange={setTemplateName} operations={operations} onClose={() => setSaveOpen(false)} />}
    </div>
  );
}
