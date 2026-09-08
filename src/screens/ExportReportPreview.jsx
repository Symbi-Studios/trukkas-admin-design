'use client';

import { useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  PageHeader, Button, Card, SectionCard, DataTable, Pagination, Icon, Switch, Radio, Tag,
  BarChart, Sparkline, Banner,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { updateReportDraft, saveReportTemplate } from '../mock/api.js';
import { REPORT_TYPES, EXPORT_FORMATS, verificationPerformanceRows, verificationSummaryCards } from '../mock/fixtures/reports.js';

const PAGE_SIZE = 10;

const REPORT_ID_PREFIX = {
  verification: 'VRF', operations: 'OPS', financial: 'FIN', compliance: 'CMP',
  fleet: 'FLT', entity: 'ENT', audit: 'AUD', custom: 'CST',
};

const STEP_LABELS = ['Report Type', 'Date Range', 'Filters', 'Columns', 'Preview & Export'];

function riskLevel(complianceRate) {
  const n = parseFloat(complianceRate);
  return n >= 90 ? 'Low' : n >= 80 ? 'Medium' : 'High';
}
function verificationStatus(r) {
  if (r.verified >= r.pending && r.verified >= r.rejected) return 'Verified';
  if (r.pending >= r.rejected) return 'Pending';
  return 'Rejected';
}
function verificationDate(rank) {
  const d = new Date(2024, 4, 20 - (rank % 14));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function cellValue(r, key) {
  switch (key) {
    case 'entityName': return r.entity;
    case 'entityType': return r.entityType;
    case 'entityCode': return `ENT-${String(r.rank).padStart(4, '0')}`;
    case 'verificationStatus': return verificationStatus(r);
    case 'riskLevel': return riskLevel(r.complianceRate);
    case 'verificationDate': return verificationDate(r.rank);
    case 'processingTime': return r.avgTime;
    case 'successRate': return r.successRate;
    case 'totalVerifications': return r.totalVerifications;
    case 'rejectionRate': return `${((r.rejected / r.totalVerifications) * 100).toFixed(1)}%`;
    case 'complianceScore': return r.complianceRate;
    case 'auditStatus': return r.rejected > 0 ? 'Flagged' : 'Reviewed';
    case 'lastAuditDate': return verificationDate(r.rank);
    case 'policyViolations': return r.rejected;
    case 'createdBy': return 'System';
    case 'lastModified': return 'Just now';
    case 'recordId': return `REC-${r.rank}`;
    case 'sourceSystem': return 'Trukkas Platform';
    case 'tags': return r.entityType;
    default: return '—';
  }
}

function buildCsv(columns, rows) {
  const header = columns.map((c) => c.label);
  const body = rows.map((r) => columns.map((c) => cellValue(r, c.key)));
  return [header, ...body].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function ExportReportPreview() {
  const navigate = useNavigate();
  const draft = (useCollection('reportDraft') || [])[0];
  const [view, setView] = useState('table');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);

  function flash(text) { setBanner(text); setTimeout(() => setBanner(null), 5000); }

  const reportType = REPORT_TYPES.find((r) => r.id === draft?.reportType) || REPORT_TYPES[0];

  const filteredRows = useMemo(() => {
    if (!draft) return [];
    return verificationPerformanceRows.filter((r) => (
      (draft.filters.entityType === 'All Types' || r.entityType === draft.filters.entityType) &&
      (draft.filters.entity === 'All Entities' || r.entity === draft.filters.entity) &&
      (draft.filters.status === 'All Statuses' || verificationStatus(r) === draft.filters.status)
    ));
  }, [draft]);

  const selectedColumns = useMemo(() => {
    if (!draft) return [];
    return draft.columnGroups.flatMap((g) => g.columns.filter((c) => c.checked));
  }, [draft]);

  const totalRecords = useMemo(() => filteredRows.reduce((s, r) => s + r.totalVerifications, 0), [filteredRows]);
  const paged = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!draft) return null;

  const reportId = `${REPORT_ID_PREFIX[draft.reportType] || 'RPT'}-${draft.dateTo.replace(/[^0-9]/g, '').slice(0, 4)}-${
    String(new Date(draft.dateTo).getMonth() + 1).padStart(2, '0')}${String(new Date(draft.dateTo).getDate()).padStart(2, '0')}-1030`;
  const generatedOn = `${draft.dateTo} at 10:30 AM`;

  const estFileSizeMb = Math.max(0.3, (selectedColumns.length * filteredRows.length * 0.012)).toFixed(1);

  function goToStep() { navigate('/reports/export'); }

  async function handleSaveTemplate() {
    setBusy(true);
    await saveReportTemplate(`${reportType.title} — ${draft.dateFrom} to ${draft.dateTo}`);
    setBusy(false);
    flash('Template saved.');
  }

  function handleExport() {
    const fmt = draft.format;
    const base = `${reportType.title.toLowerCase().replace(/\s+/g, '-')}-report`;
    if (fmt === 'json') {
      downloadBlob(JSON.stringify(paged.length ? filteredRows : [], null, 2), `${base}.json`, 'application/json;charset=utf-8;');
    } else {
      downloadBlob(buildCsv(selectedColumns, filteredRows), `${base}.csv`, 'text/csv;charset=utf-8;');
    }
    if (draft.delivery === 'email') flash(`Export ready — a download link has been emailed to you (${fmt.toUpperCase()}).`);
    else if (draft.delivery === 'schedule') flash(`Export scheduled to run ${draft.scheduleFrequency.toLowerCase()}. A first copy has been downloaded now.`);
    else flash(`Report exported as ${EXPORT_FORMATS.find((f) => f.id === fmt)?.label || fmt.toUpperCase()}.`);
  }

  return (
    <>
      <PageHeader crumbs={['Reports & Analytics', 'Export Report', 'Preview & Export']} title="Preview & Export Report"
        description="Review your report before exporting. You can go back to edit any selection."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={goToStep}>Back to Edit</Button>
          <Button variant="outline" icon="bookmark" disabled={busy} onClick={handleSaveTemplate}>{busy ? 'Saving…' : 'Save Template'}</Button>
        </>} />

      {banner && <Banner tone="success" title={banner} />}

      <Card style={{ display: 'flex', alignItems: 'center', padding: '14px 20px' }}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const done = n < 5;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: n < 5 ? 1 : '0 0 auto' }}>
              <button type="button" onClick={() => done && goToStep()}
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent',
                         cursor: done ? 'pointer' : 'default' }}>
                <span style={{ width: 26, height: 26, borderRadius: 999, display: 'grid', placeItems: 'center', flex: '0 0 auto',
                               background: done ? 'var(--tk-success)' : 'var(--tk-blue)', color: '#fff',
                               font: '700 12px/1 var(--tk-font-sans)' }}>
                  {done ? <Icon name="check" size={13} color="#fff" /> : n}
                </span>
                <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)', whiteSpace: 'nowrap' }}>{label}</span>
              </button>
              {n < 5 && <span style={{ flex: 1, height: 2, background: 'var(--tk-success)', margin: '0 12px' }} />}
            </div>
          );
        })}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--tk-grid-gap)' }}>
          <Card style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ width: 44, height: 44, borderRadius: 'var(--tk-r-lg)', background: 'var(--tk-purple-soft)',
                             color: 'var(--tk-purple)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                <Icon name={reportType.icon} size={20} />
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ font: '700 18px/24px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{reportType.title} Report</div>
                <div className="tk-meta">{reportType.description}</div>
              </div>
              <span style={{ display: 'flex', border: '1px solid var(--tk-line-strong)', borderRadius: 'var(--tk-r-md)', overflow: 'hidden' }}>
                <Button variant={view === 'table' ? 'secondary' : 'ghost'} icon="table" style={{ borderRadius: 0, border: 0 }} onClick={() => setView('table')}>Table View</Button>
                <Button variant={view === 'chart' ? 'secondary' : 'ghost'} icon="chart-column" style={{ borderRadius: 0, border: 0 }} onClick={() => setView('chart')}>Chart View</Button>
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, paddingTop: 14, borderTop: '1px solid var(--tk-line)' }}>
              {[
                { icon: 'calendar', label: 'Date Range', value: `${draft.dateFrom} - ${draft.dateTo}` },
                { icon: 'clock', label: 'Generated On', value: generatedOn },
                { icon: 'user', label: 'Generated By', value: 'Trukkas Admin' },
                { icon: 'database', label: 'Records', value: totalRecords.toLocaleString('en-NG') },
                { icon: 'hash', label: 'Report ID', value: reportId },
              ].map((f) => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name={f.icon} size={15} color="var(--tk-ink-300)" />
                  <span style={{ display: 'grid', gap: 1 }}>
                    <span className="tk-meta">{f.label}</span>
                    <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{f.value}</span>
                  </span>
                </div>
              ))}
            </div>

            {view === 'table' ? (
              filteredRows.length === 0 ? (
                <div className="tk-meta" style={{ padding: 24, textAlign: 'center' }}>No records match the selected filters.</div>
              ) : (
                <>
                  <DataTable rows={paged} rowKey={(r) => r.rank}
                    columns={selectedColumns.map((c) => ({
                      key: c.key, header: c.label, align: /rate|%|amount|revenue|payout/i.test(c.label) ? 'right' : 'left',
                      render: (r) => cellValue(r, c.key),
                    }))} />
                  <Pagination page={page} pageSize={PAGE_SIZE} total={filteredRows.length}
                    pageCount={Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))} onPage={setPage} onPageSize={() => {}} />
                </>
              )
            ) : (
              <div style={{ paddingTop: 4 }}>
                <div className="tk-meta" style={{ marginBottom: 8 }}>Total Verifications by Entity (Top 10)</div>
                <BarChart height={240} labels={filteredRows.slice(0, 10).map((r) => r.entity.split(' ')[0])}
                  series={[{ name: 'Total Verifications', color: 'var(--tk-viz-1)', points: filteredRows.slice(0, 10).map((r) => r.totalVerifications) }]} />
              </div>
            )}
          </Card>

          <SectionCard title="Report Summary">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
              {verificationSummaryCards.map((c) => (
                <div key={c.key} style={{ border: '1px solid var(--tk-line)', borderRadius: 'var(--tk-r-lg)', padding: 14, display: 'grid', gap: 4 }}>
                  <span className="tk-meta">{c.label}</span>
                  <span style={{ font: '700 20px/26px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{c.value}</span>
                  <span style={{ font: '600 11px/16px var(--tk-font-sans)', color: c.direction === 'up' ? 'var(--tk-success)' : 'var(--tk-danger)' }}>
                    {c.direction === 'up' ? '▲' : '▼'} {c.delta} vs May 7 – May 13
                  </span>
                  <Sparkline points={[8, 12, 10, 14, 13, 16, 15, 18, 17, 20].map((v) => (typeof c.value === 'string' ? v : v * (c.value / 10)))} color={c.color} height={28} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--tk-grid-gap)', alignContent: 'start', position: 'sticky', top: 16 }}>
          <SectionCard title="Export Options">
            <p className="tk-meta" style={{ margin: '-8px 0 12px' }}>Choose your preferred export settings.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {EXPORT_FORMATS.map((f) => {
                const selected = draft.format === f.id;
                return (
                  <button key={f.id} type="button" onClick={() => updateReportDraft({ format: f.id })}
                    style={{ textAlign: 'left', display: 'grid', gap: 6, padding: 12, cursor: 'pointer',
                             borderRadius: 'var(--tk-r-lg)', border: '1px solid ' + (selected ? 'var(--tk-blue)' : 'var(--tk-line-strong)'),
                             background: selected ? 'var(--tk-surface-cool)' : '#fff' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Icon name={f.icon} size={17} color={selected ? 'var(--tk-blue)' : 'var(--tk-ink-400)'} />
                      {selected && <Icon name="circle-check" size={15} color="var(--tk-blue)" />}
                    </span>
                    <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{f.label}</span>
                    {f.recommended
                      ? <Tag tone="success">Recommended</Tag>
                      : <span className="tk-meta" style={{ lineHeight: '14px' }}>{f.description}</span>}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gap: 10, marginBottom: 16, paddingTop: 14, borderTop: '1px solid var(--tk-line)' }}>
              <span className="tk-meta" style={{ fontWeight: 600, color: 'var(--tk-ink-700)' }}>Delivery Method</span>
              <Radio label="Download now" hint="Generate and download immediately" checked={draft.delivery === 'download'} onChange={() => updateReportDraft({ delivery: 'download' })} />
              <Radio label="Email me" hint="Send download link to your email" checked={draft.delivery === 'email'} onChange={() => updateReportDraft({ delivery: 'email' })} />
              <Radio label="Schedule export" hint="Automate this report (Daily, Weekly, Monthly)" checked={draft.delivery === 'schedule'} onChange={() => updateReportDraft({ delivery: 'schedule' })} />
            </div>

            <div style={{ display: 'grid', gap: 12, paddingTop: 14, borderTop: '1px solid var(--tk-line)' }}>
              <span className="tk-meta" style={{ fontWeight: 600, color: 'var(--tk-ink-700)' }}>File Settings</span>
              <Switch label="Include Charts" hint="Include charts and visualizations in report" checked={draft.fileSettings.includeCharts}
                onChange={(v) => updateReportDraft({ fileSettings: { ...draft.fileSettings, includeCharts: v } })} />
              <Switch label="Include Summary" hint="Include report summary and insights" checked={draft.fileSettings.includeSummary}
                onChange={(v) => updateReportDraft({ fileSettings: { ...draft.fileSettings, includeSummary: v } })} />
              <Switch label="Compress File" hint="Reduce file size with compression" checked={draft.fileSettings.compressFile}
                onChange={(v) => updateReportDraft({ fileSettings: { ...draft.fileSettings, compressFile: v } })} />
            </div>

            <div style={{ display: 'flex', gap: 10, padding: 12, marginTop: 16, borderRadius: 'var(--tk-r-lg)', background: 'var(--tk-surface-sunk)' }}>
              <Icon name="hard-drive" size={16} color="var(--tk-ink-400)" style={{ flex: '0 0 auto' }} />
              <div>
                <div style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>Estimated file size: ~{estFileSizeMb} MB</div>
                <div className="tk-meta">{EXPORT_FORMATS.find((f) => f.id === draft.format)?.label} format with all selected options</div>
              </div>
            </div>
          </SectionCard>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="outline" fullWidth onClick={() => navigate('/reports/export')}>Cancel</Button>
            <Button fullWidth icon="download" onClick={handleExport}>Export Report</Button>
          </div>
        </div>
      </div>
    </>
  );
}
