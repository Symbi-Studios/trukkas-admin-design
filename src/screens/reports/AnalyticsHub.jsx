'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavigate } from '../../router.js';
import { PageHeader, Button, Tabs, FilterSelect } from '../../ds.js';
import { useReportDraft } from '../../store/features/reports/useReportDraft.js';
import { draftFromConfiguration, reportComparisonRange, reportDateLabel, reportRangeQuery } from '../../store/features/reports/reportDraft.js';
import { useGetAdminReportOverviewQuery } from '../../store/features/reports/reportsApi.js';
import { useReportSession } from '../../store/features/reports/useReportOperations.js';
import { ReportDateDialog } from '../ReportDialogs.jsx';
import { PERIODS, Segmented, autoGroupBy, rangeForPeriod, shortRange } from './analyticsShared.jsx';
import { OverviewTab } from './OverviewTab.jsx';
import { JobsTab } from './JobsTab.jsx';
import { MarketplaceTab } from './MarketplaceTab.jsx';
import { MoneyTab } from './MoneyTab.jsx';
import { PeopleTab } from './PeopleTab.jsx';
import { ComplianceTab } from './ComplianceTab.jsx';
import { ReportsTab } from './ReportsTab.jsx';
import styles from './Analytics.module.css';

const TABS = [
  { value: 'overview', label: 'Overview', Component: OverviewTab },
  { value: 'jobs', label: 'Jobs & routes', Component: JobsTab },
  { value: 'marketplace', label: 'Marketplace', Component: MarketplaceTab },
  { value: 'money', label: 'Money', Component: MoneyTab },
  { value: 'people', label: 'Users & companies', Component: PeopleTab },
  { value: 'compliance', label: 'Compliance', Component: ComplianceTab },
  { value: 'reports', label: 'Reports', Component: ReportsTab, library: true },
];

export function AnalyticsHub() {
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const tab = TABS.some((t) => t.value === searchParams.get('tab')) ? searchParams.get('tab') : 'overview';
  const { loadReportDraft } = useReportDraft();
  const { owner, role, authenticated } = useReportSession();

  const [period, setPeriod] = useState('30d');
  const [range, setRange] = useState(() => rangeForPeriod('30d'));
  const [dateOpen, setDateOpen] = useState(false);
  useEffect(() => { setDateOpen(false); }, [owner]);

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

  const active = TABS.find((t) => t.value === tab);
  // Shared by the analytics tabs; RTK Query dedupes identical requests.
  const report = useGetAdminReportOverviewQuery(ctx.reportArgs, { skip: ctx.skip || !ctx.reportArgs || active.library });

  function choosePeriod(key) {
    if (key === 'custom') { setDateOpen(true); return; }
    setPeriod(key); setRange(rangeForPeriod(key));
  }

  function newReport() {
    loadReportDraft(draftFromConfiguration({ reportType: 'custom' }).draft);
    navigate('/reports/export');
  }

  const Active = active.Component;

  return (
    <div className={styles.hub}>
      <PageHeader crumbs={['Intelligence', 'Reports & Analytics']} title="Reports & Analytics"
        description="Trends, leaders and laggards across jobs, money, users and compliance."
        actions={<Button icon="plus" onClick={newReport}>New report</Button>} />

      {!active.library && <div className={styles.toolbar}>
        <Segmented label="Date range" value={period} onChange={choosePeriod}
          options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
        {period === 'custom' && <FilterSelect label={reportDateLabel(range)} icon="calendar" onClick={() => setDateOpen(true)} />}
        <span className={styles.toolbarCaption}>
          <strong>{shortRange(range)}</strong> compared with {shortRange(comparison)}
        </span>
      </div>}

      <Tabs items={TABS.map(({ value, label }) => ({ value, label }))} value={tab} onChange={ctx.goTab} />

      <Active ctx={ctx} report={report} />

      {dateOpen && <ReportDateDialog range={range} onChange={(next) => { setRange(next); setPeriod('custom'); }} onClose={() => setDateOpen(false)} />}
    </div>
  );
}
