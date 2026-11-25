'use client';

import { useEffect, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  PageHeader, Button, StatCard, StatsPanel, SectionCard, Card, Select, FilterSelect,
  DataTable, DonutChart, LegendList, LineChart, BarChart, RankBarList, EmptyState,
  Icon, Modal, TextField, Banner, Skeleton,
} from '../ds.js';
import { useReportDraft, useReportEntities } from '../store/features/reports/useReportDraft.js';
import { REPORT_TYPES } from '../store/features/reports/reportsConfig.js';
import { currentReportRange, reportComparisonRange, reportDateLabel, reportRangeQuery } from '../store/features/reports/reportDraft.js';
import { useGetAdminReportOverviewQuery, REPORT_CAPABILITIES, emptyReportOverview, reportCount, reportMoney as formatNaira, reportPercent } from '../store/features/reports/reportsApi.js';

import { ReportDateDialog } from './ReportDialogs.jsx';
import { useReportOperations, useReportSession } from '../store/features/reports/useReportOperations.js';
import { reportEntityScope } from '../store/features/reports/reportContracts.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import styles from './ReportsAnalytics.module.css';

// Values match reportComparisonRange; labels say what each one compares against.
const COMPARE_OPTIONS = [
  { value: 'Previous Period', label: 'Previous period' },
  { value: 'Previous Month', label: 'Same dates last month' },
  { value: 'Previous Year', label: 'Same dates last year' },
];
// Auto lets the API pick: daily up to 31 days, weekly up to 92, monthly beyond.
const GROUP_BY_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];
const BUCKET_NOUN = { day: 'day', week: 'week', month: 'month' };
const OVERVIEW_METRICS = [
  { value: 'jobs', label: 'Jobs' },
  { value: 'trips', label: 'Trips' },
  { value: 'revenue', label: 'Revenue' },
];
const SORT_OPTIONS = [
  { value: 'revenue', label: 'By job value' },
  { value: 'jobs', label: 'By jobs' },
  { value: 'growth', label: 'By growth' },
];
const ENTITY_TYPES = ['All Types', 'Forwarder', 'Truck Company'];

/** "Nov 11 – 17", "Oct 28 – Nov 3", or with years when the range crosses one. */
function shortRange(range) {
  if (!reportRangeQuery(range)) return '—';
  const from = new Date(range.dateFrom + 'T00:00:00Z'), to = new Date(range.dateTo + 'T00:00:00Z');
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  const thisYear = sameYear && from.getUTCFullYear() === new Date().getUTCFullYear();
  const fmt = (date, options) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(date);
  const year = thisYear ? {} : { year: 'numeric' };
  if (range.dateFrom === range.dateTo) return fmt(from, { month: 'short', day: 'numeric', ...year });
  const start = fmt(from, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  const end = from.getUTCMonth() === to.getUTCMonth() && sameYear ? fmt(to, { day: 'numeric', ...year }) : fmt(to, { month: 'short', day: 'numeric', ...year });
  return start + ' – ' + end;
}

/** Charts print every label; keep about eight so long ranges stay readable. */
function sparseLabels(labels) {
  const every = Math.max(1, Math.ceil(labels.length / 8));
  return labels.map((label, index) => (index % every === 0 || index === labels.length - 1 ? label : ''));
}

function signedPercent(delta) {
  if (typeof delta !== 'number' || !Number.isFinite(delta)) return null;
  return (delta > 0 ? '+' : delta < 0 ? '−' : '') + reportPercent(Math.abs(delta));
}

/** Label with its backend definition on hover (dotted underline marks it). */
function Defined({ text, definition }) {
  return definition ? <span className={styles.defined} title={definition}>{text}</span> : text;
}

export function ReportsAnalytics() {
  const session = useReportSession();
  return <ReportsAnalyticsScreen key={session.key} />;
}

function ReportsAnalyticsScreen() {
  const navigate = useNavigate();
  const { draft, updateReportDraft } = useReportDraft();
  const operations = useReportOperations(draft);
  const authenticated = operations.authenticated;
  const [range, setRange] = useState(currentReportRange);
  const [dateOpen, setDateOpen] = useState(false);

  const [entityTypeFilter, setEntityTypeFilter] = useState('All Types');
  const [entityFilter, setEntityFilter] = useState('All Entities');
  const [compareTo, setCompareTo] = useState(COMPARE_OPTIONS[0].value);
  const [groupBy, setGroupBy] = useState('auto');
  const [overviewMetric, setOverviewMetric] = useState('jobs');
  const [sortEntities, setSortEntities] = useState('revenue');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ reportType: 'operations', frequency: 'Weekly', recipients: '' });
  const busy = operations.busy;
  useEffect(() => { setScheduleOpen(false); setDateOpen(false); setEntityFilter('All Entities'); setScheduleForm({ reportType: 'operations', frequency: 'Weekly', recipients: '' }); }, [operations.owner]);
  const { options: entityOptions } = useReportEntities(entityTypeFilter);
  const filtersActive = entityTypeFilter !== 'All Types' || entityFilter !== 'All Entities' || compareTo !== COMPARE_OPTIONS[0].value || groupBy !== 'auto';
  const scoped = entityTypeFilter !== 'All Types' || entityFilter !== 'All Entities';
  const comparison = reportComparisonRange(range, compareTo);
  const args = reportRangeQuery(range);
  const compareArgs = comparison ? reportRangeQuery(comparison) : null;
  const scope = reportEntityScope({ entityType: entityTypeFilter, entity: entityFilter });
  const overviewArgs = args && compareArgs ? {
    ...args, compareFrom: compareArgs.dateFrom, compareTo: compareArgs.dateTo, ...scope.params,
    ...(groupBy === 'auto' ? {} : { groupBy }), metric: overviewMetric, sortBy: sortEntities, owner: operations.owner, role: operations.role,
  } : null;
  const reports = useGetAdminReportOverviewQuery(overviewArgs, { skip: !authenticated || Boolean(scope.error) || !overviewArgs, refetchOnMountOrArgChange: true });
  const overview = authenticated && !scope.error && !reports.error && reports.currentData ? reports.currentData : emptyReportOverview();
  const { dashboardSummary: summary, definitions, notes, operationsOverview, jobsByStatus, jobsByType, geographicalDistribution,
    topPerformingEntities, financialSummary, userEngagement, complianceOverview, alertsExceptions, trendData } = overview;
  const loading = reports.isFetching && !scope.error;
  const failed = Boolean(scope.error || reports.error);
  const comparisonCaption = 'vs ' + shortRange(comparison);
  const value = (content) => loading ? <Skeleton as="span" width={90} height={23} /> : content;
  const banner = scope.error || operations.error || (authenticated && reports.error ? getApiErrorMessage(reports.error) : null);
  const amount = (v) => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-NG', { maximumFractionDigits: 2 }) : '—';
  const bucket = BUCKET_NOUN[overview.groupBy || groupBy];
  const metricLabel = OVERVIEW_METRICS.find((m) => m.value === overviewMetric)?.label || 'Jobs';
  const totalJobs = summary.totalJobs;
  // Donuts only draw when every slice is known and the slices add up to the total.
  const donut = (rows) => rows.length && totalJobs > 0 && rows.every((row) => row.count != null) && rows.reduce((sum, row) => sum + row.count, 0) === totalJobs
    ? rows.map((row) => ({ label: row.label, value: row.count, color: row.color })) : [];
  const statusRows = jobsByStatus;
  const entitiesTarget = ['Truck Company'].includes(entityTypeFilter) ? { to: '/companies', label: 'View truck companies' } : { to: '/forwarders', label: 'View forwarders' };
  const trendSeries = [
    { name: 'Revenue', color: 'var(--tk-viz-1)', points: trendData.revenue },
    { name: 'Payouts', color: 'var(--tk-viz-2)', points: trendData.payouts },
  ];
  const trendEmpty = !trendSeries.some((series) => series.points.some((point) => Number.isFinite(point) && point !== 0));

  function delta(key) {
    const change = overview.deltaValues?.[key];
    if (change == null) return {};
    return { delta: reportPercent(Math.abs(change)), direction: change < 0 ? 'down' : 'up' };
  }

  async function scheduleReport() {
    if (scope.error) return;
    if (await operations.scheduleDashboard(scheduleForm, scope.params)) setScheduleOpen(false);
  }

  function clearAll() {
    setEntityTypeFilter('All Types'); setEntityFilter('All Entities');
    setCompareTo(COMPARE_OPTIONS[0].value); setGroupBy('auto');
  }

  function goExport(reportType) {
    updateReportDraft({ reportType, ...range, filters: { entityType: entityTypeFilter, entity: entityFilter, status: 'All Statuses', location: 'All Locations', minAmount: '', maxAmount: '' } });
    navigate('/reports/export');
  }

  const link = (label, to) => <button type="button" className={styles.linkButton} onClick={() => navigate(to)}>{label}</button>;
  const empty = (title, description, icon = 'chart-column') => (
    loading ? <Skeleton height={120} /> : failed ? <EmptyState icon={icon} title="Couldn’t load this section" description="Check the message above and try again." /> : <EmptyState icon={icon} title={title} description={description} />
  );

  return (
    <>
      <PageHeader crumbs={['Intelligence', 'Reports & Analytics']} title="Reports & Analytics"
        description="How jobs, money, users and compliance are moving on Trukkas."
        actions={<>
          <Button variant="outline" icon="calendar-clock" onClick={() => setScheduleOpen(true)}>Schedule reports</Button>
          <Button variant="outline" icon="download" onClick={() => goExport(draft.reportType)}>Export report</Button>
          <Button icon="plus" onClick={() => goExport('custom')}>Custom report</Button>
        </>} />

      {banner && <Banner tone="error" title={banner} />}

      <Card className={styles.filters}>
        <FilterSelect label={reportDateLabel(range)} icon="calendar" onClick={() => setDateOpen(true)} />
        <Select label="Compare to" value={compareTo} options={COMPARE_OPTIONS} onChange={(e) => setCompareTo(e.target.value)} style={{ minWidth: 180 }} />
        <Select label="Group by" value={groupBy} options={GROUP_BY_OPTIONS} onChange={(e) => setGroupBy(e.target.value)} style={{ minWidth: 120 }} />
        <Select label="Entity type" value={entityTypeFilter} options={ENTITY_TYPES.map((type) => ({ value: type, label: type === 'All Types' ? 'All types' : type }))}
          onChange={(e) => { setEntityTypeFilter(e.target.value); setEntityFilter('All Entities'); }} style={{ minWidth: 150 }} />
        <Select label="Entity" value={entityFilter} options={entityOptions.map((option) => option.value === 'All Entities' ? { ...option, label: 'All entities' } : option)}
          onChange={(e) => setEntityFilter(e.target.value)} style={{ minWidth: 190 }} />
        <span className={styles.filtersSpacer} />
        {filtersActive && <button type="button" className={styles.linkButton} onClick={clearAll}>Clear filters</button>}
        {scoped && (
          <p className={styles.scopeNote}>
            <Icon name="info" size={13} aria-hidden="true" />
            Entity filters apply to job figures, top entities and escrow balance. Revenue, users, compliance and most alerts stay platform-wide.
          </p>
        )}
      </Card>

      <StatsPanel title="Summary">
        <StatCard label={<Defined text="Jobs created" definition={definitions.totalJobs} />} value={value(reportCount(summary.totalJobs))} {...delta('totalJobs')} caption={comparisonCaption} />
        <StatCard label={<Defined text="Jobs completed" definition={definitions.completedJobs} />} value={value(reportCount(summary.completedJobs))} {...delta('completedJobs')} caption={comparisonCaption} />
        <StatCard label={<Defined text="Platform revenue" definition={definitions.totalRevenue} />} value={value(formatNaira(summary.totalRevenue))} {...delta('totalRevenue')} caption={comparisonCaption} />
        <StatCard label={<Defined text="Payouts" definition={definitions.totalPayouts} />} value={value(formatNaira(summary.totalPayouts))} {...delta('totalPayouts')} caption={comparisonCaption} />
        <StatCard label={<Defined text="Active users" definition={definitions.activeUsers} />} value={value(reportCount(summary.activeUsers))} {...delta('activeUsers')} caption={comparisonCaption} />
        <StatCard label={<Defined text="Approval rate" definition={definitions.complianceRate || 'Verified ÷ decided verifications (verified + rejected), all time.'} />}
          value={value(reportPercent(summary.complianceRate))} direction={null} caption="Of decided verifications, all time" />
      </StatsPanel>

      <div className={styles.chartGrid}>
        <SectionCard title="Operations" tooltip={notes.operations || undefined}
          description={metricLabel + ' per ' + (bucket || 'period') + ', counted on the date each job was created, accepted, completed or cancelled'} action={
          <Select value={overviewMetric} options={OVERVIEW_METRICS} onChange={(e) => setOverviewMetric(e.target.value)} style={{ minWidth: 110 }} />
        }>
          <div className={styles.legend}>
            {operationsOverview.series.map((s) => (
              <span key={s.name}><span className={styles.legendDot} style={{ background: s.color }} />{s.name}</span>
            ))}
          </div>
          {loading ? <Skeleton height={220} /> : (
            <LineChart height={220} labels={sparseLabels(operationsOverview.labels)} series={operationsOverview.series}
              format={overviewMetric === 'revenue' ? amount : reportCount} />
          )}
        </SectionCard>

        <SectionCard title="Revenue and payouts" description={'Platform revenue and payouts per ' + (bucket || 'period')}>
          <div className={styles.legend}>
            {trendSeries.map((s) => (
              <span key={s.name}><span className={styles.legendDot} style={{ background: s.color }} />{s.name} (₦)</span>
            ))}
          </div>
          {loading ? <Skeleton height={190} /> : trendEmpty
            ? <LineChart height={190} labels={sparseLabels(trendData.labels)} series={trendSeries} emptyLabel="No revenue or payouts in this period" />
            : <BarChart height={190} labels={sparseLabels(trendData.labels)} format={amount} series={trendSeries} />}
        </SectionCard>

        <SectionCard title="Jobs by status" description="Jobs created in this period, by where they are now" action={link('View jobs', '/jobs')}>
          {!loading && !failed && totalJobs === 0 ? empty('No jobs created in this period', 'Try a wider date range.', 'package') : (
            <div className={styles.donut}>
              <DonutChart size={150} thickness={20} centerValue={loading ? '—' : reportCount(totalJobs)} centerLabel="Jobs" data={donut(statusRows)} />
              <LegendList style={{ width: '100%' }} showShare={false}
                items={statusRows.map((s) => ({ label: s.label, value: s.count, display: s.count == null ? '—' : `${reportCount(s.count)} (${s.pct})`, color: s.color }))} />
            </div>
          )}
        </SectionCard>
      </div>

      <div className={styles.reportGrid}>
        <SectionCard title="Top entities"
          description={(entityTypeFilter === 'Truck Company' ? 'Truck companies' : 'Forwarders') + ' with jobs accepted in this period. Job value is the agreed price, not platform revenue.'}
          action={<>
            <Select value={sortEntities} options={SORT_OPTIONS} onChange={(e) => setSortEntities(e.target.value)} style={{ minWidth: 130 }} />
            {link(entitiesTarget.label, entitiesTarget.to)}
          </>}>
          {loading || failed || topPerformingEntities.length === 0
            ? empty('No entity activity in this period', 'Entities appear here once a job of theirs is accepted within the selected dates.', 'building-2')
            : (
              <DataTable rows={topPerformingEntities} rowKey={(r) => r._key}
                columns={[
                  { key: 'rank', header: '#', width: 40 },
                  { key: 'entity', header: 'Entity', render: (r) => (
                    <span style={{ display: 'grid', gap: 2 }}>
                      <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.entity}</span>
                      <span className="tk-meta">{r.entityType}</span>
                    </span>) },
                  { key: 'jobs', header: 'Jobs', align: 'right' },
                  { key: 'revenue', header: 'Job value (₦)', align: 'right', render: (r) => amount(r.revenue) },
                  { key: 'growth', header: 'Growth', align: 'right', render: (r) => (
                    <span className={styles.growth} data-tone={r.growth == null || r.growth === 0 ? 'flat' : r.growth > 0 ? 'up' : 'down'}>
                      {signedPercent(r.growth) ?? '—'}
                    </span>) },
                ]} />
            )}
        </SectionCard>

        <SectionCard className={styles.legendCard} title="Jobs by type" description="Jobs created in this period, by movement and cargo">
          {loading || failed || jobsByType.length === 0 ? empty('No jobs created in this period', 'Try a wider date range.', 'package') : (
            <div className={styles.donut}>
              <DonutChart size={150} thickness={20} centerValue={reportCount(totalJobs)} centerLabel="Jobs" data={donut(jobsByType)} />
              <LegendList style={{ width: '100%' }} showShare={false}
                items={jobsByType.map((s) => ({ label: s.label, value: s.count, display: s.count == null ? '—' : `${reportCount(s.count)} (${s.pct})`, color: s.color }))} />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Destinations" description="Jobs created in this period, by destination state">
          {loading || failed || geographicalDistribution.length === 0 ? empty('No jobs created in this period', 'Try a wider date range.', 'map-pin') : (
            <RankBarList numbered={false}
              items={geographicalDistribution.map((g) => ({ label: g.label, value: g.count ?? 0, display: g.count == null ? '—' : `${reportCount(g.count)} (${g.pct})` }))} />
          )}
        </SectionCard>
      </div>

      <div className={styles.summaryGrid}>
        <SectionCard title="Money" description="Revenue, job value and payouts for this period; balances right now" action={link('Open finance', '/finance-overview')}>
          <dl className={styles.figures}>
            {[
              { key: 'totalRevenue', label: 'Platform revenue' },
              { key: 'grossJobValue', label: 'Gross job value' },
              { key: 'totalPayouts', label: 'Payouts' },
              { key: 'outstandingPayments', label: 'Outstanding payments', now: true },
              { key: 'escrowBalance', label: 'Escrow balance', now: true },
            ].map((item) => {
              const change = signedPercent(financialSummary[item.key + 'Delta']);
              return (
                <div key={item.key} className={styles.figure}>
                  <dt>{item.label}</dt>
                  <dd>
                    <span className={styles.figureValue}>{loading ? <Skeleton as="span" width={80} height={18} /> : formatNaira(financialSummary[item.key])}</span>
                    {item.now ? <span className={styles.figureMeta}>Right now</span>
                      : change && <span className={styles.figureMeta}>{change} {comparisonCaption}</span>}
                  </dd>
                  {financialSummary[item.key + 'Definition'] && <dd className={styles.figureNote}>{financialSummary[item.key + 'Definition']}</dd>}
                </div>
              );
            })}
          </dl>
        </SectionCard>

        <SectionCard title="Users" description="Platform-wide for this period" action={link('Open users', '/users-overview')}>
          <dl className={styles.figures}>
            {[
              { key: 'activeUsers', label: 'Active users' },
              { key: 'newUsers', label: 'New users' },
              // Sessions aren't tracked yet; the row appears once the API returns a value.
              ...(userEngagement.userSessions != null ? [{ key: 'userSessions', label: 'Sessions' }] : []),
            ].map((item) => {
              const change = signedPercent(userEngagement[item.key + 'Delta']);
              return (
                <div key={item.key} className={styles.figure}>
                  <dt>{item.label}</dt>
                  <dd>
                    <span className={styles.figureValue}>{loading ? <Skeleton as="span" width={40} height={18} /> : reportCount(userEngagement[item.key])}</span>
                    {change && <span className={styles.figureMeta}>{change} {comparisonCaption}</span>}
                  </dd>
                  {userEngagement[item.key + 'Definition'] && <dd className={styles.figureNote}>{userEngagement[item.key + 'Definition']}</dd>}
                </div>
              );
            })}
          </dl>
        </SectionCard>

        <SectionCard title="Verifications" description={notes.compliance ? notes.compliance + '. Not filtered by date.' : 'Current state, not filtered by date.'} action={link('Open queue', '/verification')}>
          <ul className={styles.rows}>
            <li><span>Total</span><strong>{complianceOverview.totalVerifications}</strong></li>
            {[
              { label: 'Verified', value: complianceOverview.verified, pct: complianceOverview.verifiedPct, color: 'var(--tk-success)' },
              { label: 'Pending', value: complianceOverview.pending, pct: complianceOverview.pendingPct, color: 'var(--tk-warning)' },
              { label: 'Rejected', value: complianceOverview.rejected, pct: complianceOverview.rejectedPct, color: 'var(--tk-danger)' },
            ].map((s) => (
              <li key={s.label}>
                <span><span className={styles.legendDot} style={{ background: s.color }} />{s.label}</span>
                <span><strong>{s.value}</strong> <span className="tk-meta">{s.pct}</span></span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Needs attention" description="Right now, not filtered by date">
          <ul className={styles.rows}>
            {alertsExceptions.map((a) => (
              <li key={a.key}>
                <button type="button" className={styles.alertRow} onClick={() => navigate(a.to)}>
                  <span className={styles.alertText}>
                    <span>{a.label}</span>
                    {a.definition && <span className="tk-meta">{a.definition}</span>}
                  </span>
                  <strong data-tone={a.count > 0 ? 'alert' : undefined}>{a.count == null ? '—' : reportCount(a.count)}</strong>
                  <Icon name="chevron-right" size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <Modal open={scheduleOpen} onClose={() => { if (!busy) setScheduleOpen(false); }} title="Schedule reports"
        description="Generate a report on a schedule and email it to the people you list."
        footer={<>
          <Button variant="outline" disabled={busy} onClick={() => setScheduleOpen(false)}>Cancel</Button>
          <Button disabled={!REPORT_CAPABILITIES.schedule || busy || !authenticated || Boolean(scope.error) || !scheduleForm.recipients.trim()} onClick={scheduleReport}>{busy ? 'Scheduling…' : 'Schedule'}</Button>
        </>}>
        <div style={{ display: 'grid', gap: 14 }}>
          {(scope.error || operations.error) && <Banner tone="error" title={scope.error || operations.error} />}
          <Select label="Report type" value={scheduleForm.reportType}
            options={REPORT_TYPES.map((r) => ({ value: r.id, label: r.title }))}
            onChange={(e) => setScheduleForm((f) => ({ ...f, reportType: e.target.value }))} />
          <Select label="Frequency" value={scheduleForm.frequency} options={['Daily', 'Weekly', 'Monthly']}
            onChange={(e) => setScheduleForm((f) => ({ ...f, frequency: e.target.value }))} />
          <TextField label="Recipients (email)" required placeholder="finance@trukkas.com, ops@trukkas.com"
            value={scheduleForm.recipients} onChange={(e) => setScheduleForm((f) => ({ ...f, recipients: e.target.value }))} />
        </div>
      </Modal>
      {dateOpen && <ReportDateDialog range={range} onChange={setRange} onClose={() => setDateOpen(false)} />}
    </>
  );
}
