'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavigate } from '../../router.js';
import { PageHeader, Button, Tabs, FilterSelect, Modal, Select, TextField, Banner } from '../../ds.js';
import { useReportDraft } from '../../store/features/reports/useReportDraft.js';
import { REPORT_TYPES } from '../../store/features/reports/reportsConfig.js';
import { reportComparisonRange, reportDateLabel, reportRangeQuery } from '../../store/features/reports/reportDraft.js';
import { REPORT_CAPABILITIES, useGetAdminReportOverviewQuery } from '../../store/features/reports/reportsApi.js';
import { useReportOperations } from '../../store/features/reports/useReportOperations.js';
import { ReportDateDialog } from '../ReportDialogs.jsx';
import { PERIODS, Segmented, autoGroupBy, rangeForPeriod, shortRange } from './analyticsShared.jsx';
import { OverviewTab } from './OverviewTab.jsx';
import { JobsTab } from './JobsTab.jsx';
import { MarketplaceTab } from './MarketplaceTab.jsx';
import { MoneyTab } from './MoneyTab.jsx';
import { PeopleTab } from './PeopleTab.jsx';
import { ComplianceTab } from './ComplianceTab.jsx';
import styles from './Analytics.module.css';

const TABS = [
  { value: 'overview', label: 'Overview', Component: OverviewTab },
  { value: 'jobs', label: 'Jobs & routes', Component: JobsTab },
  { value: 'marketplace', label: 'Marketplace', Component: MarketplaceTab },
  { value: 'money', label: 'Money', Component: MoneyTab },
  { value: 'people', label: 'Users & companies', Component: PeopleTab },
  { value: 'compliance', label: 'Compliance', Component: ComplianceTab },
];

export function AnalyticsHub() {
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const tab = TABS.some((t) => t.value === searchParams.get('tab')) ? searchParams.get('tab') : 'overview';
  const { draft, updateReportDraft } = useReportDraft();
  const operations = useReportOperations(draft);
  const { owner, role, authenticated } = operations;

  const [period, setPeriod] = useState('30d');
  const [range, setRange] = useState(() => rangeForPeriod('30d'));
  const [dateOpen, setDateOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ reportType: 'operations', frequency: 'Weekly', recipients: '' });
  useEffect(() => { setScheduleOpen(false); setDateOpen(false); }, [owner]);

  const comparison = reportComparisonRange(range, 'Previous Period');
  const iso = reportRangeQuery(range);
  const compareIso = comparison ? reportRangeQuery(comparison) : null;
  const groupBy = autoGroupBy(range);

  const ctx = useMemo(() => {
    const reportArgs = iso && compareIso ? {
      ...iso, compareFrom: compareIso.dateFrom, compareTo: compareIso.dateTo, metric: 'jobs', sortBy: 'revenue', owner, role,
    } : null;
    return {
      range, comparison, groupBy, iso, reportArgs, owner, role, authenticated, navigate,
      skip: !authenticated || !iso,
      compareCaption: 'vs ' + shortRange(comparison),
      goTab: (value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === 'overview') params.delete('tab'); else params.set('tab', value);
        navigate('/reports' + (params.toString() ? '?' + params : ''), { replace: true });
      },
    };
  }, [range, comparison, groupBy, iso, compareIso, owner, role, authenticated, navigate, searchParams]);

  // Shared by every tab; RTK Query dedupes identical requests.
  const report = useGetAdminReportOverviewQuery(ctx.reportArgs, { skip: ctx.skip || !ctx.reportArgs });

  function choosePeriod(key) {
    if (key === 'custom') { setDateOpen(true); return; }
    setPeriod(key); setRange(rangeForPeriod(key));
  }

  function goExport(reportType) {
    updateReportDraft({ reportType, ...range, filters: { entityType: 'All Types', entity: 'All Entities', status: 'All Statuses', location: 'All Locations', minAmount: '', maxAmount: '' } });
    navigate('/reports/export');
  }

  async function scheduleReport() {
    if (await operations.scheduleDashboard(scheduleForm, {})) setScheduleOpen(false);
  }

  const Active = TABS.find((t) => t.value === tab).Component;

  return (
    <div className={styles.hub}>
      <PageHeader crumbs={['Intelligence', 'Reports & Analytics']} title="Reports & Analytics"
        description="Trends, leaders and laggards across jobs, money, users and compliance."
        actions={<>
          <Button variant="outline" icon="calendar-clock" onClick={() => setScheduleOpen(true)}>Schedule</Button>
          <Button variant="outline" icon="download" onClick={() => goExport(draft.reportType)}>Export</Button>
          <Button icon="plus" onClick={() => goExport('custom')}>New report</Button>
        </>} />

      {operations.error && !scheduleOpen && <Banner tone="error" title={operations.error} />}

      <div className={styles.toolbar}>
        <Segmented label="Date range" value={period} onChange={choosePeriod}
          options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
        {period === 'custom' && <FilterSelect label={reportDateLabel(range)} icon="calendar" onClick={() => setDateOpen(true)} />}
        <span className={styles.toolbarCaption}>
          <strong>{shortRange(range)}</strong> compared with {shortRange(comparison)}
        </span>
      </div>

      <Tabs items={TABS.map(({ value, label }) => ({ value, label }))} value={tab} onChange={ctx.goTab} />

      <Active ctx={ctx} report={report} />

      <Modal open={scheduleOpen} onClose={() => { if (!operations.busy) setScheduleOpen(false); }} title="Schedule a report"
        description="Generate a report on a schedule and email it to the people you list."
        footer={<>
          <Button variant="outline" disabled={operations.busy} onClick={() => setScheduleOpen(false)}>Cancel</Button>
          <Button disabled={!REPORT_CAPABILITIES.schedule || operations.busy || !authenticated || !scheduleForm.recipients.trim()} onClick={scheduleReport}>{operations.busy ? 'Scheduling…' : 'Schedule'}</Button>
        </>}>
        <div style={{ display: 'grid', gap: 14 }}>
          {operations.error && <Banner tone="error" title={operations.error} />}
          <Select label="Report type" value={scheduleForm.reportType}
            options={REPORT_TYPES.map((r) => ({ value: r.id, label: r.title }))}
            onChange={(e) => setScheduleForm((f) => ({ ...f, reportType: e.target.value }))} />
          <Select label="Frequency" value={scheduleForm.frequency} options={['Daily', 'Weekly', 'Monthly']}
            onChange={(e) => setScheduleForm((f) => ({ ...f, frequency: e.target.value }))} />
          <TextField label="Recipients (email)" required placeholder="finance@trukkas.com, ops@trukkas.com"
            value={scheduleForm.recipients} onChange={(e) => setScheduleForm((f) => ({ ...f, recipients: e.target.value }))} />
        </div>
      </Modal>
      {dateOpen && <ReportDateDialog range={range} onChange={(next) => { setRange(next); setPeriod('custom'); }} onClose={() => setDateOpen(false)} />}
    </div>
  );
}
