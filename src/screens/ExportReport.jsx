'use client';

import { useMemo, useRef, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  PageHeader, Button, Card, SectionCard, ChoiceCard, Select, TextField, Checkbox, Radio,
  Icon, Modal, Banner,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { updateReportDraft, toggleReportColumn, setReportColumnGroup, setAllReportColumns, saveReportTemplate } from '../mock/api.js';
import {
  REPORT_TYPES, ENTITY_TYPE_OPTIONS, STATUS_OPTIONS, LOCATION_OPTIONS, verificationPerformanceRows,
} from '../mock/fixtures/reports.js';

const STEPS = [
  { n: 1, label: 'Report Type', hint: 'Select the type of report to export' },
  { n: 2, label: 'Filters', hint: 'Apply date range and other filters' },
  { n: 3, label: 'Columns', hint: 'Choose data fields to include' },
  { n: 4, label: 'Format & Delivery', hint: 'Select export format and delivery option' },
  { n: 5, label: 'Review & Export', hint: 'Review your selections and export' },
];

const DATE_PRESETS = ['Custom Range', 'Last 7 days', 'Last 30 days', 'This Month'];

function totalColumns(columnGroups) {
  return columnGroups.reduce((n, g) => n + g.columns.length, 0);
}
function selectedColumns(columnGroups) {
  return columnGroups.reduce((n, g) => n + g.columns.filter((c) => c.checked).length, 0);
}

export function ExportReport() {
  const navigate = useNavigate();
  const draft = (useCollection('reportDraft') || [])[0];
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const sectionRefs = useRef({});

  function flash(text) { setBanner(text); setTimeout(() => setBanner(null), 3500); }

  const entityOptions = useMemo(
    () => ['All Entities', ...Array.from(new Set(verificationPerformanceRows.map((r) => r.entity)))],
    [],
  );

  if (!draft) return null;

  const reportType = REPORT_TYPES.find((r) => r.id === draft.reportType) || REPORT_TYPES[0];
  const selCount = selectedColumns(draft.columnGroups);
  const colTotal = totalColumns(draft.columnGroups);
  const extraFilterCount = (draft.filters.minAmount ? 1 : 0) + (draft.filters.maxAmount ? 1 : 0);

  function scrollTo(n) {
    sectionRefs.current[n]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    setBusy(true);
    await saveReportTemplate(templateName.trim());
    setBusy(false);
    setSaveOpen(false);
    setTemplateName('');
    flash(`Template "${templateName.trim()}" saved.`);
  }

  return (
    <>
      <PageHeader crumbs={['Reports & Analytics', 'Export Report']} title="Export Report"
        description="Configure your report preferences and export data in your preferred format."
        actions={<Button variant="outline" icon="bookmark" onClick={() => setSaveOpen(true)}>Save Template</Button>} />

      {banner && <Banner tone="success" title={banner} />}

      <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <Card style={{ display: 'grid', gap: 4, position: 'sticky', top: 16 }}>
          {STEPS.map((s) => {
            const active = s.n <= 4;
            return (
              <button key={s.n} type="button" onClick={() => active && scrollTo(s.n)}
                style={{ display: 'flex', gap: 10, padding: '10px 8px', border: 0, background: 'transparent',
                         textAlign: 'left', cursor: active ? 'pointer' : 'default', borderRadius: 'var(--tk-r-md)' }}>
                <span style={{ width: 24, height: 24, borderRadius: 999, flex: '0 0 auto', display: 'grid', placeItems: 'center',
                               background: s.n === 1 ? 'var(--tk-blue)' : 'var(--tk-surface-sunk)',
                               color: s.n === 1 ? '#fff' : 'var(--tk-ink-400)',
                               font: '600 12px/1 var(--tk-font-sans)' }}>{s.n}</span>
                <span style={{ display: 'grid', gap: 1 }}>
                  <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{s.label}</span>
                  <span className="tk-meta" style={{ lineHeight: '14px' }}>{s.hint}</span>
                </span>
              </button>
            );
          })}
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--tk-grid-gap)' }}>
            <SectionCard title="1. Select Report Type">
              <div ref={(el) => (sectionRefs.current[1] = el)} />
              <p className="tk-meta" style={{ margin: '-8px 0 12px' }}>Choose the type of report you want to export.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                {REPORT_TYPES.map((r) => (
                  <ChoiceCard key={r.id} selected={draft.reportType === r.id} icon={r.icon} title={r.title}
                    description={r.description} onSelect={() => updateReportDraft({ reportType: r.id })} />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="2. Date Range">
              <div ref={(el) => (sectionRefs.current[2] = el)} />
              <p className="tk-meta" style={{ margin: '-8px 0 12px' }}>Select the time period for your report.</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <Select label="" value={draft.dateRangePreset} options={DATE_PRESETS} style={{ minWidth: 170 }}
                  onChange={(e) => updateReportDraft({ dateRangePreset: e.target.value })} />
                <TextField type="date" value={draft.dateFrom} onChange={(e) => updateReportDraft({ dateFrom: e.target.value })} style={{ minWidth: 160 }} />
                <Icon name="arrow-right" size={16} color="var(--tk-ink-300)" style={{ marginBottom: 12 }} />
                <TextField type="date" value={draft.dateTo} onChange={(e) => updateReportDraft({ dateTo: e.target.value })} style={{ minWidth: 160 }} />
              </div>
            </SectionCard>

            <SectionCard title="3. Quick Filters (Optional)">
              <p className="tk-meta" style={{ margin: '-8px 0 12px' }}>Apply additional filters to narrow down your report data.</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <Select label="Entity Type" value={draft.filters.entityType} options={ENTITY_TYPE_OPTIONS} style={{ minWidth: 150 }}
                  onChange={(e) => updateReportDraft({ filters: { ...draft.filters, entityType: e.target.value } })} />
                <Select label="Entity" value={draft.filters.entity} options={entityOptions} style={{ minWidth: 190 }}
                  onChange={(e) => updateReportDraft({ filters: { ...draft.filters, entity: e.target.value } })} />
                <Select label="Status" value={draft.filters.status} options={STATUS_OPTIONS} style={{ minWidth: 150 }}
                  onChange={(e) => updateReportDraft({ filters: { ...draft.filters, status: e.target.value } })} />
                <Select label="Location" value={draft.filters.location} options={LOCATION_OPTIONS} style={{ minWidth: 160 }}
                  onChange={(e) => updateReportDraft({ filters: { ...draft.filters, location: e.target.value } })} />
                <Button variant="outline" icon="plus" onClick={() => updateReportDraft({ showMoreFilters: !draft.showMoreFilters })}>
                  {draft.showMoreFilters ? 'Fewer Filters' : 'More Filters'}
                </Button>
              </div>
              {draft.showMoreFilters && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--tk-line)' }}>
                  <TextField label="Min Amount (₦)" type="number" placeholder="0" style={{ minWidth: 160 }}
                    value={draft.filters.minAmount} onChange={(e) => updateReportDraft({ filters: { ...draft.filters, minAmount: e.target.value } })} />
                  <TextField label="Max Amount (₦)" type="number" placeholder="No limit" style={{ minWidth: 160 }}
                    value={draft.filters.maxAmount} onChange={(e) => updateReportDraft({ filters: { ...draft.filters, maxAmount: e.target.value } })} />
                </div>
              )}
            </SectionCard>

            <ColumnPicker draft={draft} sectionRefs={sectionRefs} />

            <SectionCard title="5. Export Format & Delivery">
              <div ref={(el) => (sectionRefs.current[4] = el)} />
              <p className="tk-meta" style={{ margin: '-8px 0 12px' }}>Choose your preferred export format and delivery method.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <span className="tk-meta" style={{ fontWeight: 600, color: 'var(--tk-ink-700)' }}>Export Format</span>
                  {[
                    { id: 'xlsx', label: 'Excel (.xlsx)', hint: 'Recommended' },
                    { id: 'csv', label: 'CSV (.csv)' },
                    { id: 'pdf', label: 'PDF (.pdf)' },
                    { id: 'json', label: 'JSON (.json)' },
                  ].map((f) => (
                    <Radio key={f.id} label={f.label} hint={f.hint} checked={draft.format === f.id}
                      onChange={() => updateReportDraft({ format: f.id })} />
                  ))}
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <span className="tk-meta" style={{ fontWeight: 600, color: 'var(--tk-ink-700)' }}>Delivery Method</span>
                  <Radio label="Download now" hint="Generate and download immediately" checked={draft.delivery === 'download'}
                    onChange={() => updateReportDraft({ delivery: 'download' })} />
                  <Radio label="Email me" hint="Send download link to your email" checked={draft.delivery === 'email'}
                    onChange={() => updateReportDraft({ delivery: 'email' })} />
                  <Radio label="Schedule export" hint="Automate this report (Daily, Weekly, Monthly)" checked={draft.delivery === 'schedule'}
                    onChange={() => updateReportDraft({ delivery: 'schedule' })} />
                  {draft.delivery === 'schedule' && (
                    <Select label="Frequency" value={draft.scheduleFrequency} options={['Daily', 'Weekly', 'Monthly']}
                      onChange={(e) => updateReportDraft({ scheduleFrequency: e.target.value })} style={{ marginLeft: 28, maxWidth: 200 }} />
                  )}
                </div>
              </div>
            </SectionCard>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="outline" onClick={() => navigate('/reports')}>Cancel</Button>
              <Button iconRight="arrow-right" onClick={() => navigate('/reports/export/preview')}>
                Preview & Export Report
              </Button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--tk-grid-gap)', alignContent: 'start', position: 'sticky', top: 16 }}>
            <SectionCard title="Your Report Summary">
              <p className="tk-meta" style={{ margin: '-8px 0 12px' }}>Review your selections before exporting.</p>
              <SummaryRow icon={reportType.icon} tint={reportType.tint} label="Report Type" value={`${reportType.title} Report`} />
              <SummaryRow icon="calendar" tint="blue" label="Date Range" value={`${draft.dateFrom} – ${draft.dateTo}`} />
              <SummaryRow icon="filter" tint="green" label="Filters"
                value={`${draft.filters.entityType}, ${draft.filters.entity}, ${draft.filters.status}${extraFilterCount ? `, +${extraFilterCount} more filters` : ''}`} />
              <SummaryRow icon="list-checks" tint="amber" label="Columns" value={`${selCount} columns selected`} />
              <SummaryRow icon="file" tint="blue" label="Format" value={{ xlsx: 'Excel (.xlsx)', csv: 'CSV (.csv)', pdf: 'PDF (.pdf)', json: 'JSON (.json)' }[draft.format]} />
              <SummaryRow icon="send" tint="green" label="Delivery" value={{ download: 'Download now', email: 'Email me', schedule: `Schedule (${draft.scheduleFrequency})` }[draft.delivery]} />
            </SectionCard>
            <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 'var(--tk-r-lg)', background: 'var(--tk-blue-soft)' }}>
              <Icon name="database" size={18} color="var(--tk-blue)" style={{ flex: '0 0 auto' }} />
              <div>
                <div style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-blue-ink)' }}>Estimated Data</div>
                <div className="tk-meta">This report will include approximately {verificationPerformanceRows.reduce((s, r) => s + r.totalVerifications, 0).toLocaleString('en-NG')} records across {verificationPerformanceRows.length} entities.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Save Report Template"
        description="Save your current selections so you can reuse them later."
        footer={<>
          <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
          <Button disabled={busy || !templateName.trim()} onClick={handleSaveTemplate}>{busy ? 'Saving…' : 'Save Template'}</Button>
        </>}>
        <TextField label="Template Name" required placeholder="e.g. Weekly Verification Snapshot"
          value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
      </Modal>
    </>
  );
}

function SummaryRow({ icon, tint, label, value }) {
  const TINT = {
    blue: ['var(--tk-blue-soft)', 'var(--tk-blue)'], green: ['var(--tk-success-soft)', 'var(--tk-success)'],
    amber: ['var(--tk-warning-soft)', 'var(--tk-warning)'], purple: ['var(--tk-purple-soft)', 'var(--tk-purple)'],
    orange: ['var(--tk-orange-soft)', 'var(--tk-orange-ink)'], red: ['var(--tk-danger-soft)', 'var(--tk-danger)'],
  };
  const [bg, fg] = TINT[tint] || TINT.blue;
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: '1px solid var(--tk-line)' }}>
      <span style={{ width: 30, height: 30, borderRadius: 'var(--tk-r-sm)', background: bg, color: fg,
                     display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
        <Icon name={icon} size={15} />
      </span>
      <div style={{ display: 'grid', gap: 1, minWidth: 0 }}>
        <span className="tk-meta">{label}</span>
        <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)', overflowWrap: 'break-word' }}>{value}</span>
      </div>
    </div>
  );
}

function ColumnPicker({ draft, sectionRefs }) {
  const [search, setSearch] = useState('');
  const scrollerRef = useRef(null);
  const selCount = selectedColumns(draft.columnGroups);
  const colTotal = totalColumns(draft.columnGroups);
  const allSelected = selCount === colTotal;

  const groups = draft.columnGroups.map((g) => ({
    ...g, columns: g.columns.filter((c) => c.label.toLowerCase().includes(search.toLowerCase())),
  })).filter((g) => g.columns.length > 0);

  return (
    <SectionCard title="4. Select Columns" action={<span className="tk-meta">{selCount} of {colTotal} columns selected</span>}>
      <div ref={(el) => (sectionRefs.current[3] = el)} />
      <p className="tk-meta" style={{ margin: '-8px 0 12px' }}>Choose the data fields you want to include in your report.</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <TextField icon="search" placeholder="Search columns..." style={{ flex: '1 1 240px' }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <Checkbox checked={allSelected} indeterminate={!allSelected && selCount > 0} label="Select All"
          onChange={(v) => setAllReportColumns(v)} />
        <a href="#" onClick={(e) => { e.preventDefault(); setAllReportColumns(false); }}
          style={{ font: '600 13px/1 var(--tk-font-sans)', color: 'var(--tk-orange)' }}>Clear All</a>
        <Button variant="outline" size="sm" onClick={() => scrollerRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}>
          <Icon name="chevron-right" size={15} />
        </Button>
      </div>
      <div ref={scrollerRef} className="tk-scroll" style={{ display: 'flex', gap: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {groups.map((g) => {
          const gSel = g.columns.filter((c) => c.checked).length;
          const gAll = gSel === g.columns.length && g.columns.length > 0;
          return (
            <div key={g.group} style={{ minWidth: 190, flex: '0 0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{g.group}</span>
                <a href="#" onClick={(e) => { e.preventDefault(); setReportColumnGroup(g.group, !gAll); }}
                  style={{ font: '600 11px/1 var(--tk-font-sans)', color: 'var(--tk-blue)' }}>Select All</a>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {g.columns.map((c) => (
                  <Checkbox key={c.key} checked={c.checked} label={c.label}
                    onChange={() => toggleReportColumn(g.group, c.key)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
