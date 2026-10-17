'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import { PageHeader, Button, StatCard, Card, SectionCard, Select, LineChart, DataTable, Pagination, Skeleton } from '../ds.js';
import { useGetAdminKnowledgeAnalyticsQuery, knowledgeCount, knowledgeDetailUrl } from '../store/features/knowledgeBase/knowledgeBaseApi.js';
import { KNOWLEDGE_ANALYTICS_PERIODS, KNOWLEDGE_ANALYTICS_INTERVALS, knowledgeAnalyticsDate } from '../store/features/knowledgeBase/knowledgeAnalyticsContracts.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import './Support.css';

const PAGE_SIZE = 8;
const percent = value => value == null ? '—' : value.toLocaleString('en-NG', { maximumFractionDigits: 2 }) + '%';
const chartCount = value => value.toLocaleString('en-NG', { maximumFractionDigits: 0 });

export function KnowledgeAnalytics() {
  const owner = useSelector(state => state.auth.admin?.id), role = useSelector(state => state.auth.admin?.role);
  const authenticated = useSelector(state => Boolean(state.auth.accessToken && state.auth.admin?.id));
  return <KnowledgeAnalyticsScreen key={[owner, role, authenticated].join(':')} owner={owner} role={role} authenticated={authenticated} />;
}

function KnowledgeAnalyticsScreen({ owner, role, authenticated }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('thisMonth'), [interval, setInterval] = useState('day'), [page, setPage] = useState(1);
  const query = useGetAdminKnowledgeAnalyticsQuery({ owner, role, period, interval }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const data = authenticated && !query.error ? query.currentData : null;
  const loading = authenticated && query.isFetching;
  const totals = data?.totals, buckets = data?.buckets, articles = data?.topArticles;
  const metric = value => loading ? <Skeleton as="span" width={60} height={23} /> : value;
  const caption = data?.period.label || '—';
  const total = buckets?.length ?? null, pageCount = total == null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = pageCount == null ? 1 : Math.min(page, pageCount);
  const labels = buckets?.map((bucket, index) => index % Math.max(1, Math.ceil(buckets.length / 6)) === 0 || index === buckets.length - 1 ? bucket.label : '') || [];
  const viewsKnown = buckets?.length > 0 && buckets.every(bucket => bucket.views != null);
  const votesKnown = buckets?.length > 0 && buckets.every(bucket => bucket.helpful != null && bucket.notHelpful != null);
  const emptyChart = <DriverLoadingNotice>{buckets?.length === 0 ? 'No analytics recorded for this period.' : '—'}</DriverLoadingNotice>;

  return <div className="support-page">
    <PageHeader crumbs={['Support System', 'Knowledge Base', 'Analytics']} title="Knowledge Base Analytics"
      description="Article views and reader feedback over time."
      actions={<Button variant="outline" icon="arrow-left" onClick={() => navigate('/knowledge-base')}>Back to Articles</Button>} />
    <Card style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
      <Select label="Period" value={period} options={KNOWLEDGE_ANALYTICS_PERIODS} onChange={event => { setPeriod(event.target.value); setPage(1); }} style={{ minWidth: 170 }} />
      <Select label="Group By" value={interval} options={KNOWLEDGE_ANALYTICS_INTERVALS} onChange={event => { setInterval(event.target.value); setPage(1); }} style={{ minWidth: 150 }} />
      <span className="tk-meta">{loading ? <Skeleton width={210} height={14} /> : caption}</span>
    </Card>
    {query.error && <DriverLoadingNotice>{getApiErrorMessage(query.error, 'Unable to load knowledge base analytics.')} <Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button></DriverLoadingNotice>}
    <div className="support-stats">
      <StatCard icon="eye" label="Views" value={metric(knowledgeCount(totals?.views))} />
      <StatCard icon="users" label="Unique Readers" value={metric(knowledgeCount(totals?.uniqueReaders))} />
      <StatCard icon="thumbs-up" tint="green" label="Helpful Votes" value={metric(knowledgeCount(totals?.helpful))} />
      <StatCard icon="thumbs-down" tint="red" label="Not Helpful Votes" value={metric(knowledgeCount(totals?.notHelpful))} />
      <StatCard icon="star" label="Helpful Ratings" value={metric(percent(totals?.helpfulPercentage))} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'var(--tk-grid-gap)' }}>
      <SectionCard title="Views Over Time">{loading ? <Skeleton height={220} /> : viewsKnown ? <LineChart height={220} labels={labels} format={chartCount} series={[{ name: 'Views', color: 'var(--tk-blue)', points: buckets.map(bucket => bucket.views) }]} /> : emptyChart}</SectionCard>
      <SectionCard title="Reader Feedback">
        <div style={{ display: 'flex', gap: 18, marginBottom: 12 }}><span className="tk-meta" style={{ color: 'var(--tk-success)' }}>● Helpful</span><span className="tk-meta" style={{ color: 'var(--tk-danger)' }}>● Not Helpful</span></div>
        {loading ? <Skeleton height={220} /> : votesKnown ? <LineChart height={220} labels={labels} format={chartCount} series={[
          { name: 'Helpful', color: 'var(--tk-success)', points: buckets.map(bucket => bucket.helpful) },
          { name: 'Not Helpful', color: 'var(--tk-danger)', points: buckets.map(bucket => bucket.notHelpful) },
        ]} /> : emptyChart}
      </SectionCard>
    </div>
    <SectionCard title="Activity Breakdown" pad="none">
      {loading ? <DriverTableLoading columns={5} label="Loading knowledge base activity" /> : buckets == null ? <DriverLoadingNotice>—</DriverLoadingNotice> : <DataTable rows={buckets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)} rowKey={row => row.id} columns={[
        { key: 'date', header: 'Bucket Start (Lagos)', render: row => knowledgeAnalyticsDate(row.date) },
        { key: 'views', header: 'Views', render: row => knowledgeCount(row.views) },
        { key: 'helpful', header: 'Helpful', render: row => knowledgeCount(row.helpful) },
        { key: 'notHelpful', header: 'Not Helpful', render: row => knowledgeCount(row.notHelpful) },
        { key: 'helpfulPercentage', header: 'Helpful Ratings', render: row => percent(row.helpfulPercentage) },
      ]} />}
      <Pagination page={currentPage} pageCount={loading ? null : pageCount} total={loading ? null : total} pageSize={PAGE_SIZE} onPage={value => { if (pageCount != null) setPage(Math.max(1, Math.min(value, pageCount))); }} />
    </SectionCard>
    <SectionCard title="Top Articles" pad="none">
      {loading ? <DriverTableLoading columns={2} label="Loading top articles" /> : articles == null ? <DriverLoadingNotice>—</DriverLoadingNotice> : <DataTable rows={articles} rowKey={row => row.id} onRowClick={row => navigate(knowledgeDetailUrl(row.id))} columns={[
        { key: 'title', header: 'Article', render: row => row.title }, { key: 'views', header: 'Views', render: row => knowledgeCount(row.views) },
      ]} />}
    </SectionCard>
  </div>;
}
