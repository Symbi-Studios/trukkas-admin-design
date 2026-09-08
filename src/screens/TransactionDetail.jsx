'use client';

import { useState } from 'react';
import { useNavigate, useParams, Link } from '../router.js';
import {
  PageHeader, Button, Badge, Card, SectionCard, LabelValue, CopyableId, DropdownMenu, Icon,
  Timeline, AttachmentCard, Modal, TextField, Textarea, Banner,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { retryTransaction, reverseTransaction, createRefund, reportTransactionIssue } from '../mock/api.js';
import { formatNaira } from '../mock/format.js';

const STATUS_TONE = { Completed: 'success', Pending: 'warning', Failed: 'danger', Reversed: 'orange' };
const TYPE_TONE = {
  'Payment In': 'success', 'Payment Out': 'orange', Payout: 'purple', 'Escrow Release': 'info',
  'Escrow Hold': 'neutral', 'Wallet Funding': 'teal', Fee: 'orange', Refund: 'warning', Reversal: 'danger',
};
const TYPE_ICON = {
  'Payment In': 'arrow-down-left', 'Payment Out': 'arrow-up-right', Payout: 'banknote',
  'Escrow Release': 'lock-open', 'Escrow Hold': 'lock', 'Wallet Funding': 'wallet',
  Fee: 'percent', Refund: 'corner-up-left', Reversal: 'undo-2',
};

function StatusStepper({ steps }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 2px 0' }}>
      {steps.map((s, i) => {
        const dotBg = s.state === 'pending' ? '#fff'
          : s.state === 'danger' ? 'var(--tk-danger-solid)'
          : s.state === 'warning' ? 'var(--tk-warning)'
          : 'var(--tk-success)';
        return (
          <div key={i} style={{ flex: 1, minWidth: 0, textAlign: 'center', position: 'relative' }}>
            {i > 0 && (
              <span style={{ position: 'absolute', top: 11, right: '50%', width: '100%', height: 2,
                             background: steps[i - 1].state === 'pending' ? 'var(--tk-line-strong)' : 'var(--tk-success)', zIndex: 0 }} />
            )}
            <span style={{ position: 'relative', zIndex: 1, width: 24, height: 24, borderRadius: 999,
                           display: 'inline-grid', placeItems: 'center', background: dotBg,
                           border: s.state === 'pending' ? '2px solid var(--tk-line-strong)' : 'none' }}>
              {s.state !== 'pending' && <Icon name={s.icon || 'check'} size={12} color="#fff" />}
            </span>
            <div style={{ marginTop: 8, font: '600 11px/14px var(--tk-font-sans)',
                          color: s.state === 'pending' ? 'var(--tk-ink-400)' : 'var(--tk-ink-900)',
                          padding: '0 4px', overflowWrap: 'break-word' }}>{s.title}</div>
            {s.time && <div className="tk-meta" style={{ fontSize: 10 }}>{s.time}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Fact({ role, tint = 'blue', name, id, email, phone }) {
  const TINT = {
    blue: ['var(--tk-blue-soft)', 'var(--tk-blue)'],
    green: ['var(--tk-success-soft)', 'var(--tk-success)'],
    purple: ['var(--tk-purple-soft)', 'var(--tk-purple)'],
  };
  const [bg, fg] = TINT[tint] || TINT.blue;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid var(--tk-line)' }}>
      <span style={{ width: 36, height: 36, borderRadius: 'var(--tk-r-sm)', background: bg, color: fg,
                     display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
        <Icon name="user" size={17} />
      </span>
      <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span className="tk-meta">{role}</span>
        <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{name}</span>
        <span className="tk-meta">{id}{email && email !== '—' ? ` · ${email}` : ''}{phone && phone !== '—' ? ` · ${phone}` : ''}</span>
      </div>
    </div>
  );
}

export function TransactionDetail() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const rows = useCollection('transactionRows') || [];
  const r = rows.find((x) => x.id === transactionId);

  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [issueNote, setIssueNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [showAllDocs, setShowAllDocs] = useState(false);

  if (!r) {
    return (
      <Card>
        <span className="tk-body">No transaction found with reference {transactionId}.</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/transactions')}>Back to Transactions</Button>
        </div>
      </Card>
    );
  }

  function flash(text) {
    setBanner(text);
    setTimeout(() => setBanner(null), 3500);
  }

  async function handleRetry() {
    setBusy(true);
    await retryTransaction(r.id);
    setBusy(false);
    flash('Transaction retried and marked as completed.');
  }

  async function handleReverse() {
    setBusy(true);
    await reverseTransaction(r.id);
    setBusy(false);
    flash('Transaction reversed. A reversal entry has been created.');
  }

  async function handleRefundSubmit() {
    const value = Number(refundAmount);
    if (!value || value <= 0) return;
    setBusy(true);
    await createRefund(r.id, value);
    setBusy(false);
    setModal(null);
    setRefundAmount('');
    flash(`Refund of ${formatNaira(value)} created for ${r.id}.`);
  }

  async function handleIssueSubmit() {
    if (!issueNote.trim()) return;
    setBusy(true);
    await reportTransactionIssue(r.id, issueNote.trim());
    setBusy(false);
    setModal(null);
    setIssueNote('');
    flash('Issue reported. Our finance team will review this transaction.');
  }

  const docs = showAllDocs ? r.documents : r.documents.slice(0, 2);

  return (
    <>
      <PageHeader crumbs={['Transactions', r.id]} title="Transaction Details"
        description="View full details, status and history of this transaction."
        actions={<>
          <Button variant="outline" icon="printer" onClick={() => window.print()}>Print</Button>
          <Button variant="outline" icon="share-2" onClick={() => {
            navigator.clipboard?.writeText(typeof window !== 'undefined' ? window.location.href : r.id);
            flash('Link copied to clipboard.');
          }}>Share</Button>
          {r.status === 'Failed' && (
            <Button icon="rotate-ccw" disabled={busy} onClick={handleRetry}>{busy ? 'Retrying…' : 'Retry Transaction'}</Button>
          )}
          {r.status === 'Completed' && (
            <Button variant="danger" icon="undo-2" disabled={busy} onClick={handleReverse}>{busy ? 'Reversing…' : 'Reverse'}</Button>
          )}
          <span style={{ position: 'relative' }}>
            <Button variant="secondary" iconRight="ellipsis-vertical" onClick={() => setMenu((m) => !m)}>More</Button>
            {menu && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setMenu(false)}>
                <DropdownMenu width={220} items={[
                  { label: 'Copy Transaction ID', icon: 'copy', onClick: () => { navigator.clipboard?.writeText(r.id); setMenu(false); flash('Transaction ID copied.'); } },
                  { label: 'Download Statement', icon: 'file-text', onClick: () => { setMenu(false); flash('Preparing statement…'); } },
                ]} />
              </span>
            )}
          </span>
        </>} />

      {banner && <Banner tone="success" title={banner} />}

      <Card style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(220px, 320px)', gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ width: 52, height: 52, borderRadius: 'var(--tk-r-lg)',
                             background: `var(--tk-${TYPE_TONE[r.type] === 'info' ? 'blue' : TYPE_TONE[r.type]}-soft)`,
                             color: `var(--tk-${TYPE_TONE[r.type] === 'info' ? 'blue' : TYPE_TONE[r.type]})`,
                             display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                <Icon name={TYPE_ICON[r.type] || 'receipt'} size={24} />
              </span>
              <div style={{ display: 'grid', gap: 6 }}>
                <Badge tone={TYPE_TONE[r.type]}>{r.type}</Badge>
                <div style={{ font: '700 30px/36px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>
                  {r.pos ? '+' : '-'}{formatNaira(r.amount)}
                </div>
              </div>
            </div>
            <div>
              <div style={{ font: '600 15px/22px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.description}</div>
              {r.note && <div className="tk-meta" style={{ marginTop: 3 }}>{r.note}</div>}
            </div>
          </div>
          <div>
            <LabelValue label="Transaction ID" value={<CopyableId id={r.id} onCopy={(id) => flash(`${id} copied.`)} />} />
            <LabelValue label="Date & Time" value={`${r.date}, ${r.time}`} />
            <LabelValue label="Status" value={<Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>} />
            <LabelValue label="Reference" value={<span className="tk-mono">{r.relatedTo}</span>} />
            <LabelValue label="Related To" value={
              r.jobInfo
                ? <Link to={`/jobs/${r.jobInfo.jobId}`} style={{ color: 'var(--tk-blue)', font: '600 14px/20px var(--tk-font-sans)' }}>Job Details →</Link>
                : '—'
            } />
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Parties Involved" pad="none" style={{ padding: '0 var(--tk-card-pad) 8px' }}>
            {r.parties.map((p, i) => <Fact key={i} {...p} />)}
          </SectionCard>

          {r.jobInfo && (
            <SectionCard title="Job / Trip Information">
              <LabelValue label="Job ID" value={<Link to={`/jobs/${r.jobInfo.jobId}`} className="tk-mono">{r.jobInfo.jobId}</Link>} />
              {r.jobInfo.route && <LabelValue label="Route" value={r.jobInfo.route} />}
              <LabelValue label="Cargo Type" value={r.jobInfo.cargoType} />
              {r.jobInfo.truck && <LabelValue label="Truck" value={<span className="tk-mono">{r.jobInfo.truck}</span>} />}
              {r.jobInfo.tripId && <LabelValue label="Trip ID" value={<span className="tk-mono">{r.jobInfo.tripId}</span>} />}
            </SectionCard>
          )}

          {r.breakdown && (
            <SectionCard title="Amount Breakdown">
              {r.breakdown.map((b) => (
                <LabelValue key={b.label} label={b.label} value={formatNaira(b.value)} />
              ))}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                            marginTop: 6, paddingTop: 12, borderTop: '1px solid var(--tk-line)' }}>
                <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>
                  {r.pos ? 'Total Amount Paid' : 'Total Amount'}
                </span>
                <span style={{ font: '700 16px/22px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{formatNaira(r.amount)}</span>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Payment Method">
            <LabelValue label="Method" value={r.paymentMethod.method} />
            <LabelValue label="Bank" value={r.paymentMethod.bank} />
            <LabelValue label="Account Number" value={<span className="tk-mono">{r.paymentMethod.accountNumber}</span>} />
            <LabelValue label="Account Name" value={r.paymentMethod.accountName} />
          </SectionCard>

          <SectionCard title="Reference & Notes">
            <LabelValue label="Customer Reference" value={<span className="tk-mono">{r.reference.customerRef}</span>} />
            <LabelValue label="Internal Note" value={r.reference.internalNote} />
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Transaction Status">
            <StatusStepper steps={r.timeline} />
          </SectionCard>

          <SectionCard title="Activity Timeline">
            <Timeline items={r.timeline} />
          </SectionCard>

          <SectionCard title="Documents" action={r.documents.length > 2 && (
            <a href="#" onClick={(e) => { e.preventDefault(); setShowAllDocs((s) => !s); }}>
              {showAllDocs ? 'Show Less' : `View All (${r.documents.length})`}
            </a>
          )}>
            <div style={{ display: 'grid', gap: 10 }}>
              {docs.map((d) => (
                <AttachmentCard key={d.name} name={d.name} size={d.size} kind={d.kind}
                  onOpen={() => flash(`Downloading ${d.name}…`)} style={{ width: '100%' }} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Actions">
            <div style={{ display: 'grid', gap: 10 }}>
              <Button variant="secondary" icon="package" fullWidth disabled={!r.jobInfo}
                onClick={() => r.jobInfo && navigate(`/jobs/${r.jobInfo.jobId}`)}>
                View Related Job
              </Button>
              <Button variant="outline" icon="rotate-ccw" fullWidth onClick={() => { setRefundAmount(String(r.amount)); setModal('refund'); }}>
                Create Refund
              </Button>
              <Button variant="danger" icon="flag" fullWidth onClick={() => setModal('issue')}>
                Report an Issue
              </Button>
            </div>
            {r.issueNotes?.length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--tk-line)' }}>
                {r.issueNotes.map((n, i) => (
                  <div key={i} style={{ display: 'grid', gap: 2 }}>
                    <span style={{ font: '500 12px/17px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{n.note}</span>
                    <span className="tk-meta">{n.time}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <Modal open={modal === 'refund'} onClose={() => setModal(null)} title="Create Refund"
        description={`Issue a refund against ${r.id}.`}
        footer={<>
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button disabled={busy || !Number(refundAmount) || Number(refundAmount) <= 0} onClick={handleRefundSubmit}>
            {busy ? 'Processing…' : 'Create Refund'}
          </Button>
        </>}>
        <TextField label="Refund Amount (₦)" required type="number" min="1" max={r.amount}
          value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
      </Modal>

      <Modal open={modal === 'issue'} onClose={() => setModal(null)} title="Report an Issue"
        description={`Flag ${r.id} for the finance team to review.`}
        footer={<>
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy || !issueNote.trim()} onClick={handleIssueSubmit}>
            {busy ? 'Submitting…' : 'Submit Report'}
          </Button>
        </>}>
        <Textarea label="Describe the issue" rows={4} maxLength={280}
          value={issueNote} onChange={(e) => setIssueNote(e.target.value)}
          placeholder="e.g. Amount doesn't match the invoice, duplicate charge…" />
      </Modal>
    </>
  );
}
