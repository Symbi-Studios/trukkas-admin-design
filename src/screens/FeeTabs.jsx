'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from '../router.js';
import { Banner, BarChart, Badge, Button, DataTable, EmptyState, LabelValue, Modal, Pagination, SectionCard, Select, TextField } from '../ds.js';
import { DriverTableLoading } from './DriversLoading.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { feeDetailUrl, feeMoney, feePeriods } from '../store/features/fees/feesApi.js';
import { feeAuditScopes, feeLedgerCategories, feeRangeValid, useGetAdminFeeDeductionsQuery, useGetAdminFeeTransactionsQuery, useGetAdminFeeAuditQuery, useGetAdminFeeAnalyticsQuery } from '../store/features/fees/feeTabsApi.js';
import { useGetAdminAuditDetailQuery } from '../store/features/audit/auditApi.js';

const space = { display: 'grid', gap: 16, padding: '16px var(--tk-card-pad)' };
const grid = { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' };
const showCount = value => value == null ? '—' : value.toLocaleString('en-NG');
const link = (id, path, label) => id ? <Link to={path + encodeURIComponent(id)}>{label || id}</Link> : '—';
const job = row => link(row.jobId, '/jobs/detail?id=', row.job);
const transaction = row => link(row.transactionId, '/transactions/detail?id=', row.reference || row.transactionId);
function QueryError({ query }) {
  return <Banner tone="danger" action={<Button variant="outline" onClick={query.refetch}>Retry</Button>}>{getApiErrorMessage(query.error)}</Banner>;
}
function Period({ value }) {
  return <p className="tk-meta" style={{ margin: 0 }}>Period: {value?.from || '—'} → {value?.to || '—'} · {value?.timezone || '—'}</p>;
}
function Pages({ data, page, onPage, pageSize, onPageSize }) {
  return <Pagination page={page} pageSize={pageSize} total={data?.pagination.total} pageCount={data?.pagination.totalPages || 1}
    onPage={onPage} onPageSize={onPageSize} />;
}

export function FeeRecordsTab({ kind, rules }) {
  const owner = useSelector(state => state.auth.admin?.id), authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const deductions = kind === 'deductions';
  const [page, setPage] = useState(1), [limit, setLimit] = useState(25), [search, setSearch] = useState('');
  const [dateFrom, setFrom] = useState(''), [dateTo, setTo] = useState(''), [filter, setFilter] = useState(''), [ruleId, setRuleId] = useState('');
  const datesValid = feeRangeValid(dateFrom, dateTo), args = { owner, page, limit, search, dateFrom, dateTo, ...(deductions ? { status: filter } : { category: filter, feeRuleId: ruleId }) };
  const deductionQuery = useGetAdminFeeDeductionsQuery(args, { skip: !authenticated || !owner || !deductions || !datesValid, refetchOnMountOrArgChange: true });
  const transactionQuery = useGetAdminFeeTransactionsQuery(args, { skip: !authenticated || !owner || deductions || !datesValid, refetchOnMountOrArgChange: true });
  const query = deductions ? deductionQuery : transactionQuery, data = !authenticated || !datesValid || query.error ? null : query.currentData;
  const [selected, setSelected] = useState(null);
  const change = setter => event => { setter(event.target.value); setPage(1); setSelected(null); };
  const columns = deductions ? [
    { key: 'job', header: 'Job', render: job }, { key: 'user', header: 'Trucker' }, { key: 'type', header: 'Type' },
    { key: 'amount', header: 'Amount (₦)', render: row => feeMoney(row.amount) }, { key: 'status', header: 'Status', render: row => <Badge>{row.status}</Badge> },
    { key: 'createdAt', header: 'Recorded' }, { key: 'details', header: '', render: row => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>View</Button> },
  ] : [
    { key: 'reference', header: 'Transaction', render: transaction }, { key: 'feeName', header: 'Fee Rule', render: row => row.ruleId ? <Link to={feeDetailUrl({ id: row.ruleId })}>{row.feeName}</Link> : row.feeName },
    { key: 'category', header: 'Category' }, { key: 'amount', header: 'Collected (₦)', render: row => feeMoney(row.amount) },
    { key: 'payer', header: 'Payer' }, { key: 'job', header: 'Job', render: job },
    { key: 'status', header: 'Status', render: row => <Badge>{row.status}</Badge> }, { key: 'createdAt', header: 'Collected At' },
  ];
  return <div style={space}>
    <div style={grid}>
      <TextField label="Search" placeholder={deductions ? 'Job number or trucker' : 'Reference, job, payer or fee'} value={search} onChange={change(setSearch)} />
      <TextField label="From (Lagos day)" type="date" value={dateFrom} onChange={change(setFrom)} />
      <TextField label="To (Lagos day)" type="date" value={dateTo} onChange={change(setTo)} />
      <Select label={deductions ? 'Status' : 'Category'} value={filter} onChange={change(setFilter)}
        options={[{ value: '', label: deductions ? 'All Statuses' : 'All Categories' }, ...(deductions ? ['ASSESSED', 'APPLIED', 'WAIVED', 'REFUNDED'] : feeLedgerCategories).map(value => ({ value, label: value.replaceAll('_', ' ') }))]} />
      {!deductions && <Select label="Fee Rule" value={ruleId} onChange={change(setRuleId)} options={[{ value: '', label: 'All Rules' }, ...rules.map(rule => ({ value: rule.id, label: rule.name }))]} />}
    </div>
    {!datesValid && <Banner tone="warning">Select valid dates with the start on or before the end.</Banner>}
    {datesValid && query.error && <QueryError query={query} />}
    <Period value={data?.period} />
    {deductions ? <>
      <p className="tk-meta" style={{ margin: 0 }}>Late-delivery deductions: assessed while a job is in progress; applied from the trucker’s final payment on completion. Applied deductions split 80% to the forwarder and 20% to the platform. Waivers and refunds are not supported.</p>
      <div style={grid}><LabelValue label="Deductions" value={showCount(data?.totals.count)} />{['assessed', 'applied', 'waived', 'refunded'].map(key => <LabelValue key={key} label={key[0].toUpperCase() + key.slice(1) + ' (₦)'} value={feeMoney(data?.totals[key])} />)}</div>
    </> : <><p className="tk-meta" style={{ margin: 0 }}>One row per fee per transaction. Terminal handling is included as a service fee; demurrage shares are excluded.</p><LabelValue label="Collected across the filtered period" value={feeMoney(data?.totalAmount)} /></>}
    {query.isFetching && datesValid ? <DriverTableLoading columns={columns.length} label={deductions ? 'Loading deductions' : 'Loading fee transactions'} /> : data && !data.rows.length ? <EmptyState title={deductions ? 'No deductions found' : 'No fee transactions found'} /> : <DataTable rows={data?.rows || []} rowKey={row => row.id} columns={columns} />}
    <Pages data={data} page={page} pageSize={limit} onPage={next => { if (data) setPage(Math.max(1, Math.min(next, data.pagination.totalPages))); }} onPageSize={size => { if ([10, 25, 50, 100].includes(size)) { setLimit(size); setPage(1); } }} />
    {selected && <Modal open title="Deduction Details" onClose={() => setSelected(null)} footer={<Button variant="outline" onClick={() => setSelected(null)}>Close</Button>}>
      <div style={{ display: 'grid', gap: 12 }}><LabelValue label="Job" value={job(selected)} /><LabelValue label="Trucker" value={selected.user} /><LabelValue label="Reason" value={selected.reason} /><LabelValue label="Status" value={selected.status} /><LabelValue label="Amount" value={feeMoney(selected.amount)} /><LabelValue label="Forwarder Share" value={feeMoney(selected.forwarder)} /><LabelValue label="Platform Share" value={feeMoney(selected.platform)} /><LabelValue label="Final Payment" value={transaction(selected)} /><LabelValue label="Recorded" value={selected.createdAt} /></div>
    </Modal>}
  </div>;
}

export function FeeAnalyticsTab({ period, onPeriod }) {
  const owner = useSelector(state => state.auth.admin?.id), authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const query = useGetAdminFeeAnalyticsQuery({ owner, period }, { skip: !authenticated || !owner, refetchOnMountOrArgChange: true });
  const data = authenticated && !query.error ? query.currentData : null, [page, setPage] = useState(1);
  const chart = data?.categories.every(row => row.amount != null) ? data.categories : [], series = data?.series || [];
  const currentPage = Math.min(page, Math.max(1, Math.ceil(series.length / 20)));
  return <div style={space}>
    <Select label="Period" value={period} options={feePeriods} onChange={event => { onPeriod(event.target.value); setPage(1); }} />
    {query.error && <QueryError query={query} />}
    <Period value={data?.period} />
    <p className="tk-meta" style={{ margin: 0 }}>Collected platform, terminal-handling and processing fees. Demurrage and late-delivery shares appear in the summary as Other Fees and are excluded here. Days without fees are omitted.</p>
    {query.isFetching ? <DriverTableLoading columns={3} label="Loading fee analytics" /> : <>
      <LabelValue label="Total Collected" value={feeMoney(data?.totalCollected)} />
      <SectionCard title="Collections by Category">
        {chart.length ? <BarChart series={[{ name: 'Collected', points: chart.map(row => row.amount), color: 'var(--tk-viz-1)' }]} labels={chart.map(row => row.name)} format={value => feeMoney(value)} /> : <EmptyState title="No chart data available" />}
        <DataTable rows={data?.categories || []} rowKey={row => row.id} columns={[{ key: 'name', header: 'Category' }, { key: 'amount', header: 'Collected (₦)', render: row => feeMoney(row.amount) }, { key: 'count', header: 'Fee Entries', render: row => showCount(row.count) }]} />
      </SectionCard>
      <SectionCard title="Top Fee Rules">
        {data && !data.topRules.length ? <EmptyState title="No collected fees in this period" /> : <DataTable rows={data?.topRules || []} rowKey={row => row.id} columns={[{ key: 'name', header: 'Rule', render: row => <Link to={feeDetailUrl(row)}>{row.name}</Link> }, { key: 'category', header: 'Category' }, { key: 'amount', header: 'Collected (₦)', render: row => feeMoney(row.amount) }, { key: 'count', header: 'Fee Entries', render: row => showCount(row.count) }]} />}
      </SectionCard>
      <SectionCard title="Daily Collections">
        {data && !series.length ? <EmptyState title="No daily collections" /> : <DataTable rows={series.slice((currentPage - 1) * 20, currentPage * 20)} rowKey={row => row.id} columns={[{ key: 'date', header: 'Lagos Day' }, { key: 'category', header: 'Category' }, { key: 'amount', header: 'Collected (₦)', render: row => feeMoney(row.amount) }, { key: 'count', header: 'Fee Entries', render: row => showCount(row.count) }]} />}
        <Pagination page={currentPage} pageSize={20} total={data ? series.length : undefined} pageCount={Math.max(1, Math.ceil(series.length / 20))} onPage={next => setPage(Math.max(1, Math.min(next, Math.max(1, Math.ceil(series.length / 20)))))} />
      </SectionCard>
    </>}
  </div>;
}

function AuditDetail({ id, owner, role, onClose }) {
  const query = useGetAdminAuditDetailQuery({ id, owner, role }, { refetchOnMountOrArgChange: true }), data = query.error ? null : query.currentData;
  const changes = lines => lines == null ? '—' : lines.length ? lines.join('\n') : '—';
  return <Modal open title="Fee Audit Details" width={680} onClose={onClose} footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
    {query.isFetching ? <DriverTableLoading columns={2} label="Loading fee audit details" /> : query.error ? <QueryError query={query} /> : <div style={{ display: 'grid', gap: 12 }}>
      <LabelValue label="Action" value={data?.action || '—'} /><LabelValue label="Admin" value={data?.user || '—'} /><LabelValue label="Description" value={data?.description || '—'} /><LabelValue label="Result" value={data?.status || '—'} /><LabelValue label="Date" value={data ? data.date + ' ' + data.time : '—'} />
      <div><h4 className="tk-title">Before</h4><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{changes(data?.before)}</pre></div>
      <div><h4 className="tk-title">After</h4><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{changes(data?.after)}</pre></div>
    </div>}
  </Modal>;
}
export function FeeAuditTab() {
  const owner = useSelector(state => state.auth.admin?.id), role = useSelector(state => state.auth.admin?.role), authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const [scope, setScope] = useState('config'), [page, setPage] = useState(1), [from, setFrom] = useState(''), [to, setTo] = useState(''), [selected, setSelected] = useState(null);
  const allowed = authenticated && role === 'SUPER_ADMIN', datesValid = feeRangeValid(from, to);
  const query = useGetAdminFeeAuditQuery({ owner, role, scope, page, limit: 20, dateFrom: from, dateTo: to }, { skip: !allowed || !datesValid, refetchOnMountOrArgChange: true });
  const data = allowed && datesValid && !query.error ? query.currentData : null;
  if (!allowed) return <div style={space}><EmptyState icon="shield" title="Super Admin access required" description="Only Super Admins can view the fee audit log." /></div>;
  return <div style={space}>
    <div style={grid}><Select label="Change Source" value={scope} options={feeAuditScopes} onChange={event => { setScope(event.target.value); setPage(1); setSelected(null); }} /><TextField label="From (Lagos day)" type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(1); setSelected(null); }} /><TextField label="To (Lagos day)" type="date" value={to} onChange={event => { setTo(event.target.value); setPage(1); setSelected(null); }} /></div>
    <p className="tk-meta" style={{ margin: 0 }}>Platform configuration and Finance settings can include changes to non-fee settings. Terminal fee audit entries are recorded from 18 Oct 2026; earlier changes are available in each fee rule’s history.</p>
    {!datesValid && <Banner tone="warning">Select valid dates with the start on or before the end.</Banner>}
    {datesValid && query.error && <QueryError query={query} />}
    <div style={grid}><LabelValue label="Matching Changes" value={showCount(data?.pagination.total)} /><LabelValue label="Failed Actions" value={showCount(data?.failed)} /></div>
    {query.isFetching && datesValid ? <DriverTableLoading columns={6} label="Loading fee audit log" /> : data && !data.rows.length ? <EmptyState title="No matching changes" /> : <DataTable rows={data?.rows || []} rowKey={row => row.id} columns={[{ key: 'date', header: 'Date', render: row => row.date + ' ' + row.time }, { key: 'user', header: 'Admin' }, { key: 'action', header: 'Action' }, { key: 'reference', header: 'Record' }, { key: 'status', header: 'Result', render: row => <Badge tone={row.tone}>{row.status}</Badge> }, { key: 'detail', header: '', render: row => <Button variant="ghost" size="sm" onClick={() => setSelected(row.id)}>View</Button> }]} />}
    <Pages data={data} page={page} pageSize={20} onPage={next => { if (data) setPage(Math.max(1, Math.min(next, data.pagination.totalPages))); }} />
    {selected && <AuditDetail id={selected} owner={owner} role={role} onClose={() => setSelected(null)} />}
  </div>;
}
