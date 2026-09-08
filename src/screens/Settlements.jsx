'use client';

import { useMemo, useState } from 'react';
import { Link, useNavigate } from '../router.js';
import {
  PageHeader, Button, StatCard, SectionCard, Tabs, TableToolbar, SearchField, FilterSelect,
  DataTable, Pagination, Badge, DonutChart, LegendList, IconButton, DropdownMenu, Icon,
  AlertRow, EmptyState,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { retrySettlement, approveSettlement } from '../mock/api.js';
import { settlementSummary, payoutSummary, settlementStatusBreakdown, settlementAlerts } from '../mock/fixtures/settlements.js';
import { formatNaira } from '../mock/format.js';

const TABS = ['All Settlements', 'By Job', 'By Trip', 'Driver Settlements', 'Vendor Settlements', 'Customer Settlements'];
const PAGE_SIZE = 10;

function FilterButton({ label, value, options, active, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <FilterSelect label={value} active={active} onClick={() => setOpen((o) => !o)} />
      {open && (
        <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setOpen(false)}>
          <DropdownMenu width={200} items={options.map((o) => ({
            label: o, icon: o === value ? 'check' : undefined,
            onClick: () => { onChange(o); setOpen(false); },
          }))} />
        </span>
      )}
    </span>
  );
}

function RowMenu({ items, id, menuFor, setMenuFor }) {
  return (
    <span style={{ position: 'relative' }}>
      <IconButton icon="ellipsis-vertical" onClick={() => setMenuFor(menuFor === id ? null : id)} />
      {menuFor === id && (
        <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }} onMouseLeave={() => setMenuFor(null)}>
          <DropdownMenu width={190} items={items} />
        </span>
      )}
    </span>
  );
}

const STATUS_TONE = { Completed: 'success', Pending: 'warning', 'On Hold': 'info', Failed: 'danger' };
const TYPE_TONE = { 'Driver Payout': 'blue', 'Transporter Payment': 'purple', 'Vendor Payment': 'teal', 'Customer Refund': 'orange' };

export function Settlements() {
  const navigate = useNavigate();
  const all = useCollection('settlements') || [];

  const [tab, setTab] = useState('All Settlements');
  const [q, setQ] = useState('');
  const [settlementType, setSettlementType] = useState('All Types');
  const [status, setStatus] = useState('All Status');
  const [payerType, setPayerType] = useState('All Payers');
  const [payeeType, setPayeeType] = useState('All Payees');
  const [method, setMethod] = useState('All Methods');
  const [sort, setSort] = useState('Newest First');
  const [page, setPage] = useState(1);
  const [view, setView] = useState('list');
  const [menuFor, setMenuFor] = useState(null);

  const tabFiltered = useMemo(() => {
    if (tab === 'Driver Settlements') return all.filter((s) => s.type === 'Driver Payout');
    if (tab === 'Vendor Settlements') return all.filter((s) => s.type === 'Vendor Payment');
    if (tab === 'Customer Settlements') return all.filter((s) => s.type === 'Customer Refund' || s.payeeType === 'Customer');
    return all;
  }, [all, tab]);

  const filtered = useMemo(() => {
    let rows = tabFiltered.filter((s) => (
      (settlementType === 'All Types' || s.type === settlementType) &&
      (status === 'All Status' || s.status === status) &&
      (payerType === 'All Payers' || s.payerType === payerType) &&
      (payeeType === 'All Payees' || s.payeeType === payeeType) &&
      (method === 'All Methods' || s.method === method) &&
      (!q || [s.id, s.relatedTo, s.payer, s.payee].some((v) => v && v.toLowerCase().includes(q.toLowerCase())))
    ));
    rows = [...rows].sort((a, b) => sort === 'Newest First' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id));
    return rows;
  }, [tabFiltered, settlementType, status, payerType, payeeType, method, q, sort]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader crumbs={['Business & Finance', 'Settlements']} title="Settlements"
        description="Manage and track all settlement activities across jobs, trips and parties."
        actions={<>
          <FilterSelect label="May 24 – May 30, 2026" icon="calendar" />
          <Button variant="outline" icon="filter">Filters</Button>
          <Button variant="outline" icon="download">Export</Button>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="wallet" tint="navy" label="Total Settlements" value={formatNaira(settlementSummary.totalSettlements)} delta={settlementSummary.totalSettlementsDelta} caption="vs May 17 – May 23" />
        <StatCard icon="circle-check" tint="green" label="Completed Settlements" value={formatNaira(settlementSummary.completedSettlements)} delta={settlementSummary.completedSettlementsDelta} caption="vs May 17 – May 23" />
        <StatCard icon="hourglass" tint="amber" label="Pending Settlements" value={formatNaira(settlementSummary.pendingSettlements)} delta={settlementSummary.pendingSettlementsDelta} direction="down" caption="vs May 17 – May 23" />
        <StatCard icon="circle-pause" tint="purple" label="On Hold" value={formatNaira(settlementSummary.onHold)} delta={settlementSummary.onHoldDelta} direction="down" caption="vs May 17 – May 23" />
        <StatCard icon="circle-x" tint="red" label="Failed Settlements" value={formatNaira(settlementSummary.failedSettlements)} delta={settlementSummary.failedSettlementsDelta} direction="down" caption="vs May 17 – May 23" />
        <StatCard icon="timer" tint="blue" label="Avg. Settlement Time" value={settlementSummary.avgSettlementTime} delta={settlementSummary.avgSettlementTimeDelta} caption="vs May 17 – May 23" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="" pad="none" style={{ paddingTop: 4 }}>
          <Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); }} style={{ padding: '0 var(--tk-card-pad)' }} items={TABS} />

          <TableToolbar
            filters={<>
              <FilterButton label="Settlement Type" value={settlementType} options={['All Types', 'Driver Payout', 'Transporter Payment', 'Vendor Payment', 'Customer Refund']} active={settlementType !== 'All Types'} onChange={(v) => { setSettlementType(v); setPage(1); }} />
              <FilterButton label="Status" value={status} options={['All Status', 'Completed', 'Pending', 'On Hold', 'Failed']} active={status !== 'All Status'} onChange={(v) => { setStatus(v); setPage(1); }} />
              <FilterButton label="Payer Type" value={payerType} options={['All Payers', 'Importer', 'Customer', 'Internal']} active={payerType !== 'All Payers'} onChange={(v) => { setPayerType(v); setPage(1); }} />
              <FilterButton label="Payee Type" value={payeeType} options={['All Payees', 'Driver', 'Transporter', 'Vendor', 'Customer']} active={payeeType !== 'All Payees'} onChange={(v) => { setPayeeType(v); setPage(1); }} />
              <FilterButton label="Payment Method" value={method} options={['All Methods', 'Bank Transfer', 'Wallet']} active={method !== 'All Methods'} onChange={(v) => { setMethod(v); setPage(1); }} />
              <FilterSelect label="May 24 – May 30, 2026" icon="calendar" />
            </>} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 var(--tk-card-pad) 12px' }}>
            <SearchField placeholder="Search settlements..." style={{ flex: '1 1 240px' }}
              value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            <span style={{ display: 'flex', border: '1px solid var(--tk-line-strong)', borderRadius: 'var(--tk-r-md)', overflow: 'hidden' }}>
              <IconButton icon="list" tone={view === 'list' ? 'blue' : 'ghost'} style={{ borderRadius: 0 }} onClick={() => setView('list')} />
              <IconButton icon="grid-3x3" tone={view === 'grid' ? 'blue' : 'ghost'} style={{ borderRadius: 0 }} onClick={() => setView('grid')} />
            </span>
            <FilterButton label="Sort by" value={`Sort by: ${sort}`} options={['Newest First', 'Oldest First']} onChange={setSort} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="coins" title="No settlements found" description="Try adjusting your filters or search." />
          ) : (
            <>
              <DataTable rows={paged} rowKey={(r) => r.id}
                columns={[
                  { key: 'id', header: 'Settlement ID', render: (r) => (
                    <span style={{ display: 'grid', gap: 2 }}>
                      <Link to={`/settlements/${r.id}`} className="tk-mono">{r.id}</Link>
                    </span>) },
                  { key: 'relatedTo', header: 'Related To', render: (r) => (
                    <span style={{ display: 'grid', gap: 2 }}>
                      <span style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{r.route}</span>
                      <span className="tk-meta">{r.relatedTo}</span>
                    </span>) },
                  { key: 'payer', header: 'Payer', render: (r) => (
                    <span style={{ display: 'grid', gap: 2 }}>
                      <span>{r.payer}</span><span className="tk-meta">{r.payerType}</span>
                    </span>) },
                  { key: 'payee', header: 'Payee', render: (r) => (
                    <span style={{ display: 'grid', gap: 2 }}>
                      <span>{r.payee}</span><span className="tk-meta">{r.payeeType}</span>
                    </span>) },
                  { key: 'amount', header: 'Amount (₦)', align: 'right', render: (r) => <b>{r.amount.toLocaleString('en-NG')}</b> },
                  { key: 'type', header: 'Settlement Type', render: (r) => <Badge tone={TYPE_TONE[r.type] || 'neutral'}>{r.type}</Badge> },
                  { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
                  { key: 'settledOn', header: 'Settled On', render: (r) => r.settledOn ? (
                    <span style={{ display: 'grid', gap: 2 }}><span>{r.settledOn}</span><span className="tk-meta">{r.settledTime}</span></span>) : '—' },
                  { key: 'method', header: 'Method' },
                  { key: 'x', header: '', width: 44, render: (r) => (
                    <RowMenu id={r.id} menuFor={menuFor} setMenuFor={setMenuFor} items={[
                      { label: 'View Settlement', icon: 'eye', onClick: () => { setMenuFor(null); navigate(`/settlements/${r.id}`); } },
                      ...(r.status === 'Failed' ? [{ label: 'Retry Settlement', icon: 'rotate-ccw', onClick: () => { retrySettlement(r.id); setMenuFor(null); } }] : []),
                      ...(r.status === 'Pending' || r.status === 'On Hold' ? [{ label: 'Approve & Settle', icon: 'circle-check', onClick: () => { approveSettlement(r.id); setMenuFor(null); } }] : []),
                      { divider: true },
                      { label: 'Download Receipt', icon: 'file-text' },
                    ]} />) },
                ]} />
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length}
                pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} onPage={setPage} onPageSize={() => {}} />
            </>
          )}
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Payout Summary" footer={<a href="#">View Report →</a>}>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
              <DonutChart size={140} thickness={18} centerValue={`₦${(settlementSummary.totalSettlements / 1000000).toFixed(2)}M`} centerLabel="Total Settled"
                data={payoutSummary.map((d) => ({ label: d.label, value: d.pct, color: d.color }))} />
              <LegendList style={{ width: '100%' }}
                items={payoutSummary.map((d) => ({ label: d.label, value: d.pct, display: `${formatNaira(d.amount)} (${d.pct}%)`, color: d.color }))}
                showShare={false} />
            </div>
          </SectionCard>

          <SectionCard title="Settlement Status" action={<a href="#">View All</a>}>
            {settlementStatusBreakdown.map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--tk-line)' }}>
                <Icon name={s.icon} size={16} color={`var(--tk-${s.tone === 'info' ? 'blue' : s.tone})`} />
                <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{s.label}</span>
                <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{s.count.toLocaleString('en-NG')} settlements</span>
                <span className="tk-meta">{s.pct}</span>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Recent Settlements" action={<a href="#">View All</a>}>
            {all.slice(0, 3).map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--tk-line)' }}>
                <span style={{ width: 32, height: 32, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-blue-soft)',
                               color: 'var(--tk-blue)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                  <Icon name="coins" size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/settlements/${r.id}`} style={{ display: 'block', font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.id}</Link>
                  <span className="tk-meta">{r.relatedTo} · {r.payee}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{formatNaira(r.amount)}</div>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Settlement Alerts" action={<a href="#">View All</a>}>
            {settlementAlerts.map((a, i) => (
              <AlertRow key={i} icon={a.icon} tone={a.tone} title={a.title} description={a.description}
                action={<span className="tk-meta">{a.time}</span>} />
            ))}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
