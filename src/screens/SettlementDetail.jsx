'use client';

import { useState } from 'react';
import { useNavigate, useParams } from '../router.js';
import {
  PageHeader, Button, Badge, Card, SectionCard, LabelValue, DropdownMenu, Icon, Timeline,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { retrySettlement, approveSettlement } from '../mock/api.js';
import { formatNaira } from '../mock/format.js';

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
  const navigate = useNavigate();
  const rows = useCollection('settlements') || [];
  const r = rows.find((x) => x.id === settlementId);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!r) {
    return (
      <Card>
        <span className="tk-body">No settlement found with ID {settlementId}.</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/settlements')}>Back to Settlements</Button>
        </div>
      </Card>
    );
  }

  async function handlePrimary() {
    setBusy(true);
    if (r.status === 'Failed') await retrySettlement(r.id);
    else await approveSettlement(r.id);
    setBusy(false);
  }

  const timeline = [
    { title: 'Job delivered & confirmed', description: r.relatedTo, state: 'done', icon: 'check' },
    { title: 'Settlement initiated', description: `${r.payer} → ${r.payee}`, state: 'done', icon: 'coins' },
    { title: r.status === 'Failed' ? 'Settlement failed' : r.status === 'On Hold' ? 'Settlement on hold' : r.status === 'Pending' ? 'Awaiting approval' : 'Settlement completed',
      description: r.status === 'Completed' ? `Paid via ${r.method}` : 'Pending admin action',
      time: r.settledOn ? `${r.settledOn} ${r.settledTime}` : undefined,
      state: r.status === 'Completed' ? 'done' : r.status === 'Failed' ? 'danger' : 'current', icon: r.status === 'Failed' ? 'x' : 'lock-open' },
  ];

  return (
    <>
      <PageHeader crumbs={['Business & Finance', 'Settlements', r.id]} title={r.id}
        description="Detailed view of this settlement."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/settlements')}>Back</Button>
          {(r.status === 'Failed' || r.status === 'Pending' || r.status === 'On Hold') && (
            <Button icon={r.status === 'Failed' ? 'rotate-ccw' : 'circle-check'} disabled={busy} onClick={handlePrimary}>
              {busy ? 'Processing…' : r.status === 'Failed' ? 'Retry Settlement' : 'Approve & Settle'}
            </Button>
          )}
          <span style={{ position: 'relative' }}>
            <Button variant="secondary" iconRight="ellipsis-vertical" onClick={() => setMenu((m) => !m)}>More Actions</Button>
            {menu && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setMenu(false)}>
                <DropdownMenu width={220} items={[
                  { label: 'Download Receipt', icon: 'file-text' },
                  { label: 'View Related Job', icon: 'package' },
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
              <h2 className="tk-title" style={{ fontSize: 22 }}>{r.payer} → {r.payee}</h2>
              <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
            </div>
            <span className="tk-meta">{r.route} · {r.relatedTo}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tk-meta">Amount</div>
            <div style={{ font: '700 24px/30px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{formatNaira(r.amount)}</div>
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
              <div style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Settlement Details">
          <LabelValue label="Route" value={r.route} />
          <LabelValue label="Payer" value={r.payer} />
          <LabelValue label="Payer Type" value={r.payerType} />
          <LabelValue label="Payee" value={r.payee} />
          <LabelValue label="Payee Type" value={r.payeeType} />
          <LabelValue label="Amount" value={formatNaira(r.amount)} />
          <LabelValue label="Method" value={r.method} />
          <LabelValue label="Status" value={<Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>} />
          <LabelValue label="Settled On" value={r.settledOn ? `${r.settledOn} ${r.settledTime}` : '—'} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Settlement Timeline">
            <Timeline items={timeline} />
          </SectionCard>
          <SectionCard title="Parties" pad="none" style={{ padding: '4px var(--tk-card-pad) 8px' }}>
            <Fact icon="arrow-up-right" iconTint="blue" label="Payer" value={`${r.payer} (${r.payerType})`} />
            <Fact icon="arrow-down-left" iconTint="green" label="Payee" value={`${r.payee} (${r.payeeType})`} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
