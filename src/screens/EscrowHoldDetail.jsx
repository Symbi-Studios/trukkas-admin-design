'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'next/navigation';
import { useNavigate, useParams } from '../router.js';
import {
  PageHeader, Button, Badge, Card, SectionCard, LabelValue, DropdownMenu, Icon, Timeline, Skeleton,
} from '../ds.js';
import {
  useGetAdminEscrowHoldQuery, useGetAdminEscrowReleasesQuery,
  escrowMoney as formatNaira,
} from '../store/features/wallets/walletsApi.js';

import { escrowCanRelease, escrowMoneyRoles } from '../store/features/wallets/walletActionsApi.js';
import { WalletActionDialog } from './WalletActionDialog.jsx';

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
  const params = useParams(), search = useSearchParams();
  const holdId = search.get('id') || params.holdId || '';
  const owner = useSelector(state => state.auth.admin?.id), role = useSelector(state => state.auth.admin?.role);
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  return <EscrowDetailScreen key={holdId+':'+String(owner)+':'+String(role)+':'+authenticated} />;
}
function EscrowDetailScreen() {
  const role = useSelector(state => state.auth.admin?.role);
  const [action, setAction] = useState(null);
  const params = useParams(), search = useSearchParams();
  const holdId = search.get('id') || params.holdId || '';
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const busy = false;
  const owner = useSelector((state) => state.auth.admin?.id);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const selectedQuery = useGetAdminEscrowHoldQuery({ holdId, owner, role }, { skip: !authenticated || !holdId });
  const hold = authenticated && !selectedQuery.error ? selectedQuery.currentData : null;
  const r = hold || { holdId: holdId || '—', jobId: '—', customer: '—', route: '—', amount: null, heldOn: '—', heldTime: '—', releaseBy: '—', status: '—' };
  const releasesQuery = useGetAdminEscrowReleasesQuery({ escrowId: holdId, owner, role }, { skip: !hold });
  const releases = hold && !releasesQuery.error ? releasesQuery.currentData || [] : [];
  const release = releases.filter((row) => row.statusCode === 'COMPLETED').sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))[0];
  const released = ['RELEASED', 'COMPLETED'].includes(r.statusCode);
  const loading = selectedQuery.isLoading || (selectedQuery.isFetching && !hold);
  const value = (content) => loading ? <Skeleton as="span" width={100} height={16} /> : content;
  const heldOn = r.heldOn === '—' && r.heldTime === '—' ? '—' : `${r.heldOn} ${r.heldTime}`;
  const timeline = [
    { title: 'Escrow hold created', description: hold ? `Held for ${r.customer} · ${formatNaira(r.amount)}` : '—', time: heldOn, state: hold ? 'done' : 'pending', icon: 'lock' },
    { title: 'Awaiting delivery confirmation', description: r.releaseBy === '—' ? '—' : `Scheduled release by ${r.releaseBy}`, state: released ? 'done' : r.statusCode === 'PENDING_RELEASE' ? 'current' : 'pending', icon: 'clock' },
    { title: 'Funds released', description: release ? `Released to ${release.releasedTo}` : '—', time: release && release.releasedOn !== '—' && release.releasedTime !== '—' ? `${release.releasedOn} ${release.releasedTime}` : '—', state: released ? 'done' : 'pending', icon: 'lock-open' },
  ];

  if (!hold && !loading && selectedQuery.error?.status === 404) {
    return (
      <Card>
        <span className="tk-body">No escrow hold found with ID {holdId}.</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/wallets')}>Back to Escrow Wallet</Button>
        </div>
      </Card>
    );
  }

  function exportDetails() {
    if (!hold) return;
    const fields = [['Hold ID', r.holdId], ['Job / Trip ID', r.jobId], ['Customer', r.customer], ['Route', r.route], ['Amount', formatNaira(r.amount)], ['Status', r.status], ['Held On', heldOn], ['Scheduled Release', r.releaseBy]];
    const csv = [['Field', 'Value'], ...fields].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'escrow-hold.csv'; anchor.click(); URL.revokeObjectURL(url); setMenu(false);
  }

  return (
    <>
      <PageHeader crumbs={['Business & Finance', 'Escrow & Wallets', 'Holds', r.holdId]} title={r.holdId}
        description="Detailed view of this escrow hold."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/wallets')}>Back</Button>
          {!released && (
            <Button icon="lock-open" disabled={!escrowMoneyRoles.includes(role) || !escrowCanRelease(hold) || selectedQuery.isFetching} onClick={() => setAction({ kind:'release',record:hold })}>{busy ? 'Releasing…' : 'Release Funds'}</Button>
          )}
          <span style={{ position: 'relative' }}>
            <Button variant="secondary" iconRight="ellipsis-vertical" onClick={() => setMenu((m) => !m)}>More Actions</Button>
            {menu && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setMenu(false)}>
                <DropdownMenu width={220} items={[
                  { label: 'Open a Dispute', icon: 'triangle-alert', tone: 'danger', disabled: !hold?.canOpenDispute || selectedQuery.isFetching || !hold?.jobApiId, onClick: () => { setMenu(false); setAction({ kind:'open',record:hold }); } },
                  { divider: true },
                  { label: 'Export Details', icon: 'file-text', onClick: exportDetails },
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
              <h2 className="tk-title" style={{ fontSize: 22 }}>{value(r.customer)}</h2>
              <Badge>{r.status}</Badge>
            </div>
            <span className="tk-meta">{value(r.route)}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tk-meta">Held Amount</div>
            <div style={{ font: '700 24px/30px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{value(formatNaira(r.amount))}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid var(--tk-line)', paddingTop: 16 }}>
          {[
            { label: 'Hold ID', value: r.holdId },
            { label: 'Job / Trip ID', value: r.jobId },
            { label: 'Held On', value: heldOn },
            { label: 'Release By', value: r.releaseBy },
          ].map((f, i) => (
            <div key={f.label} style={{ flex: '1 1 150px', padding: '0 18px', borderLeft: i ? '1px solid var(--tk-line)' : 'none' }}>
              <div className="tk-meta" style={{ marginBottom: 4 }}>{f.label}</div>
              <div style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{value(f.value)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Hold Details">
          <LabelValue label="Customer" value={value(r.customer)} />
          <LabelValue label="Route" value={value(r.route)} />
          <LabelValue label="Job / Trip ID" value={value(r.jobId)} />
          <LabelValue label="Amount" value={value(formatNaira(r.amount))} />
          <LabelValue label="Status" value={<Badge>{r.status}</Badge>} />
          <LabelValue label="Held On" value={value(heldOn)} />
          <LabelValue label="Scheduled Release" value={value(r.releaseBy)} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Release Timeline">
            <Timeline items={timeline.map((item) => ({ ...item, description: value(item.description), time: value(item.time) }))} />
          </SectionCard>
          {release && (
            <SectionCard title="Release Record" pad="none" style={{ padding: '4px var(--tk-card-pad) 8px' }}>
              <Fact icon="hash" iconTint="blue" label="Release ID" value={release.releaseId} />
              <Fact icon="user" iconTint="green" label="Released To" value={release.releasedTo} />
              <Fact icon="file-text" iconTint="purple" label="Settlement Reference" value={release.settlementReference} />
            </SectionCard>
          )}
        </div>
      </div>
      {action && <WalletActionDialog key={holdId+':'+action.kind} kind={action.kind} record={action.record} owner={owner} role={role} onClose={() => setAction(null)} />}
    </>
  );
}
