'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavigate, useParams } from '../router.js';
import {
  PageHeader, Button, Badge, Card, SectionCard, LabelValue, DropdownMenu, Icon, Timeline, Skeleton,
} from '../ds.js';
import {
  useGetAdminSettlementQuery, canApproveSettlement, canRetrySettlement,
  settlementMoney as formatNaira,
} from '../store/features/settlements/settlementsApi.js';

import { useSettlementOperations } from '../store/features/settlements/useSettlementOperations.js';

const STATUS_TONE = { Completed: 'success', Pending: 'warning', 'On Hold': 'info', Failed: 'danger' };

function Fact({ icon, iconTint = 'blue', label, value }) {
  const TINT = {
    blue: ['var(--tk-blue-soft)', 'var(--tk-blue)'],
    green: ['var(--tk-success-soft)', 'var(--tk-success)'],
    amber: ['var(--tk-warning-soft)', 'var(--tk-warning)'],
    purple: ['var(--tk-purple-soft)', 'var(--tk-purple)'],
  };
  const [bg, fg] = TINT[iconTint] || TINT.blue;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <span style={{ width: 34, height: 34, borderRadius: 'var(--tk-r-sm)', background: bg, color: fg,
                     display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
        <Icon name={icon} size={17} />
      </span>
      <span style={{ flex: 1, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>{label}</span>
      <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function SettlementDetail() {
  const { settlementId } = useParams();
  const search = useSearchParams();
  const id = search.get('id') || settlementId || '';
  const navigate = useNavigate();
  const operations = useSettlementOperations();
  const query = useGetAdminSettlementQuery({ id, owner: operations.owner }, { skip: !operations.authenticated || !id });
  const row = operations.authenticated && !query.error ? query.currentData : null;
  const loading = query.isLoading || (query.isFetching && !row);
  const r = row || { id:'—', payer:'—', payee:'—', payerType:'—', payeeType:'—', route:'—', relatedTo:'—', amount:null, type:'—', method:'—', status:'—', settledOn:'—', settledTime:'—' };
  const [menu, setMenu] = useState(false);
  const value = (content) => loading ? <Skeleton as="span" width={100} height={16} /> : content;
  const settledOn = r.settledOn === '—' ? '—' : r.settledOn + ' ' + r.settledTime;

  if (!loading && query.error?.status === 404) {
    return (
      <Card>
        <span className="tk-body">No settlement found with ID {id || '—'}.</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/settlements')}>Back to Settlements</Button>
        </div>
      </Card>
    );
  }

  const timeline = r.timeline || [
    { title:'Job delivered & confirmed', description:'—', time:'—', state:'pending', icon:'check' },
    { title:'Settlement initiated', description:'—', time:'—', state:'pending', icon:'coins' },
    { title:'—', description:'—', time:'—', state:'pending', icon:'lock-open' },
  ];

  return (
    <>
      <PageHeader crumbs={['Business & Finance', 'Settlements', r.id]} title={r.id}
        description="Detailed view of this settlement."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/settlements')}>Back</Button>
          {(r.status === 'Failed' || r.status === 'Pending' || r.status === 'On Hold') && (
            <Button icon={r.status === 'Failed' ? 'rotate-ccw' : 'circle-check'} disabled={operations.busy || query.isFetching || !operations.canManage || !(r.status === 'Failed' ? canRetrySettlement(r) : canApproveSettlement(r))} onClick={() => void operations.settle(r, r.status === 'Failed' ? 'retry' : 'approve')}>
              {r.status === 'Failed' ? 'Retry Settlement' : 'Approve & Settle'}
            </Button>
          )}
          <span style={{ position: 'relative' }}>
            <Button variant="secondary" iconRight="ellipsis-vertical" onClick={() => setMenu((m) => !m)}>More Actions</Button>
            {menu && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setMenu(false)}>
                <DropdownMenu width={220} items={[
                  { label: 'Download Receipt', icon: 'file-text', onClick: () => { if (row) void operations.download(row); setMenu(false); } },
                  { label: 'View Related Job', icon: 'package', onClick: () => { if (row?.jobUrl) navigate(row.jobUrl); setMenu(false); } },
                ]} />
              </span>
            )}
          </span>
        </>} />

      <Card style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ width: 56, height: 56, borderRadius: 'var(--tk-r-lg)', background: 'var(--tk-blue-soft)',
                         color: 'var(--tk-blue)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
            <Icon name="coins" size={26} />
          </span>
          <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="tk-title" style={{ fontSize: 22 }}>{value(`${r.payer} → ${r.payee}`)}</h2>
              <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{r.status}</Badge>
            </div>
            <span className="tk-meta">{value(`${r.route} · ${r.relatedTo}`)}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tk-meta">Amount</div>
            <div style={{ font: '700 24px/30px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{value(formatNaira(r.amount))}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid var(--tk-line)', paddingTop: 16 }}>
          {[
            { label: 'Settlement ID', value: r.id },
            { label: 'Related To', value: r.relatedTo },
            { label: 'Settlement Type', value: r.type },
            { label: 'Method', value: r.method },
          ].map((f, i) => (
            <div key={f.label} style={{ flex: '1 1 150px', padding: '0 18px', borderLeft: i ? '1px solid var(--tk-line)' : 'none' }}>
              <div className="tk-meta" style={{ marginBottom: 4 }}>{f.label}</div>
              <div style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{value(f.value)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Settlement Details">
          <LabelValue label="Route" value={value(r.route)} />
          <LabelValue label="Payer" value={value(r.payer)} />
          <LabelValue label="Payer Type" value={value(r.payerType)} />
          <LabelValue label="Payee" value={value(r.payee)} />
          <LabelValue label="Payee Type" value={value(r.payeeType)} />
          <LabelValue label="Amount" value={value(formatNaira(r.amount))} />
          <LabelValue label="Method" value={value(r.method)} />
          <LabelValue label="Status" value={<Badge tone={STATUS_TONE[r.status] || 'neutral'}>{r.status}</Badge>} />
          <LabelValue label="Settled On" value={value(settledOn)} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Settlement Timeline">
            <Timeline items={timeline.map((item) => ({ ...item, title: value(item.title), description: value(item.description), time: value(item.time) }))} />
          </SectionCard>
          <SectionCard title="Parties" pad="none" style={{ padding: '4px var(--tk-card-pad) 8px' }}>
            <Fact icon="arrow-up-right" iconTint="blue" label="Payer" value={value(`${r.payer} (${r.payerType})`)} />
            <Fact icon="arrow-down-left" iconTint="green" label="Payee" value={value(`${r.payee} (${r.payeeType})`)} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
