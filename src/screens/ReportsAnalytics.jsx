'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import {
  PageHeader, Button, StatCard, SectionCard, Card, Select, FilterSelect,
  DataTable, DonutChart, LegendList, LineChart, BarChart, Sparkline, RankBarList, Tabs,
  Icon, Modal, TextField, Banner, Skeleton,
} from '../ds.js';
import { useReportDraft, useReportEntities } from '../store/features/reports/useReportDraft.js';
import { REPORT_TYPES } from '../store/features/reports/reportsConfig.js';
import { currentReportRange, reportComparisonRange, reportDateLabel, reportRangeQuery } from '../store/features/reports/reportDraft.js';
import { useGetAdminReportJobStatsQuery, REPORT_CAPABILITIES, emptyReportOverview, reportCount, reportMoney as formatNaira, reportPercent, reportChange } from '../store/features/reports/reportsApi.js';

const COMPARE_OPTIONS = ['Previous 7 days', 'Previous Period', 'Previous Month', 'Previous Year'];
const GROUP_BY_OPTIONS = ['Daily', 'Weekly', 'Monthly'];
const OVERVIEW_METRICS = ['Jobs', 'Trips', 'Revenue'];
const SORT_OPTIONS = ['By Revenue', 'By Jobs', 'By Growth'];

export function ReportsAnalytics() {
  const navigate = useNavigate();
  const { updateReportDraft } = useReportDraft();
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const [range] = useState(currentReportRange);

  const [entityTypeFilter, setEntityTypeFilter] = useState('All Types');
  const [entityFilter, setEntityFilter] = useState('All Entities');
  const [compareTo, setCompareTo] = useState(COMPARE_OPTIONS[0]);
  const [groupBy, setGroupBy] = useState('Daily');
  const [showFilters, setShowFilters] = useState(false);
  const [overviewMetric, setOverviewMetric] = useState('Jobs');
  const [sortEntities, setSortEntities] = useState('By Revenue');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ reportType: 'operations', frequency: 'Weekly', recipients: '' });
  const busy = false;
  const { options: entityOptions } = useReportEntities(entityTypeFilter);
  const filtersActive = entityTypeFilter !== 'All Types' || entityFilter !== 'All Entities';
  const comparison = reportComparisonRange(range, compareTo);
  const args = reportRangeQuery(range);
  const compareArgs = reportRangeQuery(comparison);
  const jobs = useGetAdminReportJobStatsQuery(args, { skip: !authenticated || filtersActive || !args });
  const previous = useGetAdminReportJobStatsQuery(compareArgs, { skip: !authenticated || filtersActive || !compareArgs });
  const overview = authenticated && !filtersActive && !jobs.isError && jobs.currentData ? jobs.currentData : emptyReportOverview();
  const { dashboardSummary, operationsOverview, jobsByStatus, jobsByType, geographicalDistribution,
    topPerformingEntities: filteredEntities, financialSummary, userEngagement, complianceOverview, alertsExceptions, trendData } = overview;
  const comparisonAvailable = authenticated && !filtersActive && !previous.isError && previous.currentData;
  const totalChange = comparisonAvailable ? reportChange(dashboardSummary.totalJobs, previous.currentData.dashboardSummary.totalJobs) : null;
  const completedChange = comparisonAvailable ? reportChange(dashboardSummary.completedJobs, previous.currentData.dashboardSummary.completedJobs) : null;
  const comparisonCaption = 'vs ' + reportDateLabel(comparison);
  const loading = !filtersActive && jobs.isFetching;
  const value = (content) => loading ? <Skeleton as="span" width={90} height={23} /> : content;
  const banner = authenticated && jobs.isError && !filtersActive ? (jobs.error?.status === 403 ? 'You do not have permission to view reports.' : 'Unable to load report data. Please try again.') : null;
  const statusChartData = jobsByStatus.every((status) => status.count != null)
    && jobsByStatus.reduce((total, status) => total + status.count, 0) === dashboardSummary.totalJobs
    ? jobsByStatus.map((status) => ({ label: status.label, value: status.count, color: status.color })) : [];

  function clearAll() {
    setEntityTypeFilter('All Types'); setEntityFilter('All Entities');
    setCompareTo(COMPARE_OPTIONS[0]); setGroupBy('Daily'); setShowFilters(false);
  }

  function goExport(reportType) {
    updateReportDraft({ reportType, ...range, filters: { entityType: entityTypeFilter, entity: entityFilter, status: 'All Statuses', location: 'All Locations', minAmount: '', maxAmount: '' } });
    navigate('/reports/export');
  }


  return (
    <>
      <PageHeader crumbs={['Intelligence', 'Reports & Analytics']} title="Reports & Analytics"
        description="Holistic insights across operations, performance, finance, compliance and users."
        actions={<>
          <Button variant="outline" icon="calendar-clock" onClick={() => setScheduleOpen(true)}>Schedule Reports</Button>
          <Button variant="outline" icon="download" onClick={() => navigate('/reports/export')}>Export Report</Button>
          <Button icon="plus" onClick={() => goExport('custom')}>Custom Report</Button>
        </>} />

      {banner && <Banner tone="error" title={banner} />}

      <Card style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <FilterSelect label={reportDateLabel(range)} icon="calendar" />
        <Select label="Compare to" value={compareTo} options={COMPARE_OPTIONS} onChange={(e) => setCompareTo(e.target.value)} style={{ minWidth: 160 }} />
        <Select label="Group By" value={groupBy} options={GROUP_BY_OPTIONS} onChange={(e) => setGroupBy(e.target.value)} style={{ minWidth: 130 }} />
        <Select label="Entity Type" value={entityTypeFilter} options={['All Types', 'Forwarder', 'Exporter', 'Truck Company']} onChange={(e) => { setEntityTypeFilter(e.target.value); setEntityFilter('All Entities'); }} style={{ minWidth: 150 }} />
        <Select label="Entity" value={entityFilter} options={entityOptions} onChange={(e) => setEntityFilter(e.target.value)} style={{ minWidth: 190 }} />
        <Button variant="outline" icon="filter" onClick={() => setShowFilters((s) => !s)}>Filters</Button>
        <div style={{ flex: 1 }} />
        {(filtersActive || showFilters) && (
          <a href="#" onClick={(e) => { e.preventDefault(); clearAll(); }}
            style={{ font: '600 13px/1 var(--tk-font-sans)', color: 'var(--tk-orange)', paddingBottom: 10 }}>Clear All</a>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="calendar-days" tint="navy" label="Total Jobs" value={value(reportCount(dashboardSummary.totalJobs))} delta={reportPercent(totalChange)} direction={totalChange == null ? null : totalChange < 0 ? 'down' : 'up'} caption={comparisonCaption} sparkline={<Sparkline points={dashboardSummary.totalJobsTrend} color="var(--tk-viz-1)" />} />
        <StatCard icon="circle-check" tint="green" label="Completed Jobs" value={value(reportCount(dashboardSummary.completedJobs))} delta={reportPercent(completedChange)} direction={completedChange == null ? null : completedChange < 0 ? 'down' : 'up'} caption={comparisonCaption} sparkline={<Sparkline points={dashboardSummary.completedJobsTrend} color="var(--tk-viz-2)" />} />
        <StatCard icon="banknote" tint="purple" label="Total Revenue" value={formatNaira(dashboardSummary.totalRevenue)} delta={dashboardSummary.totalRevenueDelta} direction={null} caption={comparisonCaption} sparkline={<Sparkline points={dashboardSummary.totalRevenueTrend} color="var(--tk-viz-5)" />} />
        <StatCard icon="wallet" tint="amber" label="Total Payouts" value={formatNaira(dashboardSummary.totalPayouts)} delta={dashboardSummary.totalPayoutsDelta} direction={null} caption={comparisonCaption} sparkline={<Sparkline points={dashboardSummary.totalPayoutsTrend} color="var(--tk-viz-3)" />} />
        <StatCard icon="users" tint="teal" label="Active Users" value={reportCount(dashboardSummary.activeUsers)} delta={dashboardSummary.activeUsersDelta} direction={null} caption={comparisonCaption} sparkline={<Sparkline points={dashboardSummary.activeUsersTrend} color="var(--tk-viz-6)" />} />
        <StatCard icon="shield-check" tint="blue" label="Compliance Rate" value={reportPercent(dashboardSummary.complianceRate)} delta={dashboardSummary.complianceRateDelta} direction={null} caption={comparisonCaption} sparkline={<Sparkline points={dashboardSummary.complianceRateTrend} color="var(--tk-viz-2)" />} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.1fr 0.9fr', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Operations Overview" action={
          <Select value={overviewMetric} options={OVERVIEW_METRICS} onChange={(e) => setOverviewMetric(e.target.value)} style={{ minWidth: 110 }} />
        }>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
            {operationsOverview.series.map((s) => (
              <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, font: '400 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color }} />{s.name}
              </span>
            ))}
          </div>
          <LineChart height={220} labels={operationsOverview.labels}
            series={operationsOverview.series} format={() => '—'} />
        </SectionCard>

        <SectionCard title="Revenue & Payouts Trend">
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '400 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--tk-viz-1)' }} />Revenue (₦)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '400 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--tk-viz-2)' }} />Payouts (₦)
            </span>
          </div>
          <BarChart height={190} labels={trendData.labels} format={() => '—'}
            series={[
              { name: 'Revenue', color: 'var(--tk-viz-1)', points: trendData.revenue },
              { name: 'Payouts', color: 'var(--tk-viz-2)', points: trendData.payouts },
            ]} />
          <Tabs value={groupBy} onChange={setGroupBy} items={GROUP_BY_OPTIONS} style={{ marginTop: 10, gap: 16 }} />
        </SectionCard>

        <SectionCard title="Jobs by Status" footer={<Button variant="outline" fullWidth onClick={() => navigate('/jobs')}>View Full Report</Button>}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
            <DonutChart size={150} thickness={20} centerValue={loading ? '—' : reportCount(dashboardSummary.totalJobs)} centerLabel="Total"
              data={statusChartData} />
            <LegendList style={{ width: '100%' }}
              items={jobsByStatus.map((s) => ({ label: s.label, value: s.count, display: `${reportCount(s.count)} (${s.pct})`, color: s.color }))}
              showShare={false} />
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Top Performing Entities" action={
          <Select value={sortEntities} options={SORT_OPTIONS} onChange={(e) => setSortEntities(e.target.value)} style={{ minWidth: 130 }} />
        } footer={<Button variant="outline" fullWidth onClick={() => navigate('/forwarders')}>View All Entities</Button>}>
          <DataTable rows={filteredEntities} rowKey={(r) => r.rank}
            columns={[
              { key: 'rank', header: 'Rank', width: 50 },
              { key: 'entity', header: 'Entity', render: (r) => (
                <span style={{ display: 'grid', gap: 2 }}>
                  <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.entity}</span>
                  <span className="tk-meta">{r.entityType}</span>
                </span>) },
              { key: 'jobs', header: 'Jobs', align: 'right' },
              { key: 'revenue', header: 'Revenue (₦)', align: 'right', render: (r) => reportCount(r.revenue) },
              { key: 'growth', header: 'Growth', align: 'right', render: (r) => (
                <span style={{ color: 'var(--tk-success)', font: '600 13px/18px var(--tk-font-sans)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="arrow-up" size={12} />{r.growth}
                </span>) },
            ]} />
        </SectionCard>

        <SectionCard title="Jobs by Type" footer={<Button variant="outline" fullWidth onClick={() => navigate('/jobs')}>View Full Report</Button>}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
            <DonutChart size={150} thickness={20} centerValue={loading ? '—' : reportCount(dashboardSummary.totalJobs)} centerLabel="Total"
              data={jobsByType.filter((s) => s.count != null).map((s) => ({ label: s.label, value: s.count, color: s.color }))} />
            <LegendList style={{ width: '100%' }}
              items={jobsByType.map((s) => ({ label: s.label, value: s.count, display: `${reportCount(s.count)} (${s.pct})`, color: s.color }))}
              showShare={false} />
          </div>
        </SectionCard>

        <SectionCard title="Geographical Distribution" footer={<Button variant="outline" fullWidth onClick={() => navigate('/jobs')}>View Full Report</Button>}>
          <RankBarList numbered={false}
            items={geographicalDistribution.map((g) => ({ label: g.label, value: g.count, display: `${reportCount(g.count)} (${g.pct})` }))} />
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard icon="banknote" title="Financial Summary" footer={<Button variant="outline" fullWidth onClick={() => goExport('financial')}>View Financial Report</Button>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div className="tk-meta">Total Revenue</div>
              <div style={{ font: '700 18px/24px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{formatNaira(financialSummary.totalRevenue)}</div>
              <div style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-success)' }}>{financialSummary.totalRevenueDelta}</div>
            </div>
            <div>
              <div className="tk-meta">Total Payouts</div>
              <div style={{ font: '700 18px/24px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{formatNaira(financialSummary.totalPayouts)}</div>
              <div style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-success)' }}>{financialSummary.totalPayoutsDelta}</div>
            </div>
            <div>
              <div className="tk-meta">Outstanding Payments</div>
              <div style={{ font: '700 18px/24px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{formatNaira(financialSummary.outstandingPayments)}</div>
              <div style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-danger)' }}>{financialSummary.outstandingPaymentsDelta}</div>
            </div>
            <div>
              <div className="tk-meta">Escrow Balance</div>
              <div style={{ font: '700 18px/24px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{formatNaira(financialSummary.escrowBalance)}</div>
              <div style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-success)' }}>{financialSummary.escrowBalanceDelta}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon="users" title="User Engagement" footer={<Button variant="outline" fullWidth onClick={() => goExport('audit')}>View User Report</Button>}>
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              { label: 'Active Users', value: reportCount(userEngagement.activeUsers), delta: userEngagement.activeUsersDelta },
              { label: 'New Users', value: reportCount(userEngagement.newUsers), delta: userEngagement.newUsersDelta },
              { label: 'User Sessions', value: reportCount(userEngagement.userSessions), delta: userEngagement.userSessionsDelta },
            ].map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span className="tk-meta">{s.label}</span>
                <span>
                  <b style={{ font: '700 15px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)', marginRight: 8 }}>{s.value}</b>
                  <span style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-success)' }}>{s.delta}</span>
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard icon="shield-check" title="Compliance Overview" footer={<Button variant="outline" fullWidth onClick={() => goExport('compliance')}>View Compliance Report</Button>}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span className="tk-meta">Total Verifications</span>
              <b style={{ font: '700 15px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{complianceOverview.totalVerifications}</b>
            </div>
            {[
              { label: 'Verified', value: complianceOverview.verified, pct: complianceOverview.verifiedPct, color: 'var(--tk-success)' },
              { label: 'Pending', value: complianceOverview.pending, pct: complianceOverview.pendingPct, color: 'var(--tk-warning)' },
              { label: 'Rejected', value: complianceOverview.rejected, pct: complianceOverview.rejectedPct, color: 'var(--tk-danger)' },
            ].map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span className="tk-meta">{s.label}</span>
                <span><b style={{ font: '600 13px/18px var(--tk-font-sans)', color: s.color, marginRight: 6 }}>{s.value}</b><span className="tk-meta">({s.pct})</span></span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard icon="triangle-alert" title="Alerts & Exceptions" footer={<Button variant="outline" fullWidth onClick={() => goExport('audit')}>View All Alerts</Button>}>
          <div style={{ display: 'grid', gap: 10 }}>
            {alertsExceptions.map((a) => (
              <div key={a.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{a.label}</span>
                <span style={{ minWidth: 26, textAlign: 'center', padding: '2px 8px', borderRadius: 'var(--tk-r-xs)',
                               background: 'var(--tk-danger-soft)', color: 'var(--tk-danger)',
                               font: '700 12px/18px var(--tk-font-sans)' }}>{a.count}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule Reports"
        description="Automatically generate and deliver a report on a recurring basis."
        footer={<>
          <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
          <Button disabled={!REPORT_CAPABILITIES.schedule || busy || !scheduleForm.recipients.trim()}>{busy ? 'Scheduling…' : 'Schedule'}</Button>
        </>}>
        <div style={{ display: 'grid', gap: 14 }}>
          <Select label="Report Type" value={scheduleForm.reportType}
            options={REPORT_TYPES.map((r) => ({ value: r.id, label: r.title }))}
            onChange={(e) => setScheduleForm((f) => ({ ...f, reportType: e.target.value }))} />
          <Select label="Frequency" value={scheduleForm.frequency} options={['Daily', 'Weekly', 'Monthly']}
            onChange={(e) => setScheduleForm((f) => ({ ...f, frequency: e.target.value }))} />
          <TextField label="Recipients (email)" required placeholder="finance@trukkas.com, ops@trukkas.com"
            value={scheduleForm.recipients} onChange={(e) => setScheduleForm((f) => ({ ...f, recipients: e.target.value }))} />
        </div>
      </Modal>
    </>
  );
}
