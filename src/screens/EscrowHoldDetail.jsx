'use client';

import { useState } from 'react';
import { useNavigate, useParams } from '../router.js';
import {
  PageHeader, Button, Badge, Card, SectionCard, LabelValue, DropdownMenu, Icon, Timeline,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { releaseEscrowHold } from '../mock/api.js';
import { formatNaira } from '../mock/format.js';

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

export function EscrowHoldDetail() {
  const { holdId } = useParams();
  const navigate = useNavigate();
  const holds = useCollection('escrowHolds') || [];
  const releases = useCollection('escrowReleases') || [];
  const r = holds.find((x) => x.holdId === holdId);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!r) {
    return (
      <Card>
        <span className="tk-body">No escrow hold found with ID {holdId}.</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/wallets')}>Back to Escrow Wallet</Button>
        </div>
      </Card>
    );
  }

  const release = releases.find((rel) => rel.jobId === r.jobId);

  async function handleRelease() {
    setBusy(true);
    await releaseEscrowHold(r.holdId);
    setBusy(false);
  }

  const timeline = [
    { title: 'Escrow hold created', description: `Held for ${r.customer} · ${formatNaira(r.amount)}`, time: `${r.heldOn} ${r.heldTime}`, state: 'done', icon: 'lock' },
    { title: 'Awaiting delivery confirmation', description: `Scheduled release by ${r.releaseBy}`, state: r.status === 'Released' ? 'done' : r.status === 'Pending Release' ? 'current' : 'pending', icon: 'clock' },
    { title: 'Funds released', description: release ? `Released to ${release.releasedTo}` : 'Not yet released', time: release ? `${release.releasedOn} ${release.releasedTime}` : undefined, state: r.status === 'Released' ? 'done' : 'pending', icon: 'lock-open' },
  ];

  return (
    <>
      <PageHeader crumbs={['Business & Finance', 'Escrow & Wallets', 'Holds', r.holdId]} title={r.holdId}
        description="Detailed view of this escrow hold."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/wallets')}>Back</Button>
          {r.status !== 'Released' && (
            <Button icon="lock-open" disabled={busy} onClick={handleRelease}>{busy ? 'Releasing…' : 'Release Funds'}</Button>
          )}
          <span style={{ position: 'relative' }}>
            <Button variant="secondary" iconRight="ellipsis-vertical" onClick={() => setMenu((m) => !m)}>More Actions</Button>
            {menu && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setMenu(false)}>
                <DropdownMenu width={220} items={[
                  { label: 'Open a Dispute', icon: 'triangle-alert', tone: 'danger' },
                  { divider: true },
                  { label: 'Export Details', icon: 'file-text' },
                ]} />
              </span>
            )}
          </span>
        </>} />

      <Card style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ width: 56, height: 56, borderRadius: 'var(--tk-r-lg)', background: 'var(--tk-warning-soft)',
                         color: 'var(--tk-warning)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
            <Icon name="lock" size={26} />
          </span>
          <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="tk-title" style={{ fontSize: 22 }}>{r.customer}</h2>
              <Badge>{r.status}</Badge>
            </div>
            <span className="tk-meta">{r.route}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tk-meta">Held Amount</div>
            <div style={{ font: '700 24px/30px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{formatNaira(r.amount)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid var(--tk-line)', paddingTop: 16 }}>
          {[
            { label: 'Hold ID', value: r.holdId },
            { label: 'Job / Trip ID', value: r.jobId },
            { label: 'Held On', value: `${r.heldOn} ${r.heldTime}` },
            { label: 'Release By', value: r.releaseBy },
          ].map((f, i) => (
            <div key={f.label} style={{ flex: '1 1 150px', padding: '0 18px', borderLeft: i ? '1px solid var(--tk-line)' : 'none' }}>
              <div className="tk-meta" style={{ marginBottom: 4 }}>{f.label}</div>
              <div style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Hold Details">
          <LabelValue label="Customer" value={r.customer} />
          <LabelValue label="Route" value={r.route} />
          <LabelValue label="Job / Trip ID" value={r.jobId} />
          <LabelValue label="Amount" value={formatNaira(r.amount)} />
          <LabelValue label="Status" value={<Badge>{r.status}</Badge>} />
          <LabelValue label="Held On" value={`${r.heldOn} ${r.heldTime}`} />
          <LabelValue label="Scheduled Release" value={r.releaseBy} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Release Timeline">
            <Timeline items={timeline} />
          </SectionCard>
          {release && (
            <SectionCard title="Release Record" pad="none" style={{ padding: '4px var(--tk-card-pad) 8px' }}>
              <Fact icon="hash" iconTint="blue" label="Release ID" value={release.releaseId} />
              <Fact icon="user" iconTint="green" label="Released To" value={release.releasedTo} />
              <Fact icon="file-text" iconTint="purple" label="Settlement Reference" value={release.reference} />
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}
