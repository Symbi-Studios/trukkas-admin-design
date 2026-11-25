'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigate } from '../router.js';
import { showToast } from '../components/ActionToast.jsx';
import { DocumentProgress } from '../components/DocumentProgress.jsx';
import { approveDocumentAction, rejectDocumentAction } from '@/lib/doc-review/actions';
import type { ApiError } from '@/types/api';
import type { ReviewJob } from '@/types/docReview';
import { Badge, Banner, Button, EmptyState, Icon, IconButton, Modal, Skeleton } from '../ds.js';
import {
  DOC_STATUS,
  REJECTION_PRESETS,
  REVIEW_STATUS_META,
  countDocuments,
  docDescription,
  docLabel,
  docStatusLabel,
  docStatusTone,
  flattenDocuments,
  nextPendingAfter,
  rejectionPrefix,
  unitNoun,
  type FlatDocument,
} from '@/domain/containerReview';
import './DocumentReview.css';

const STATUS_ICON = { PENDING: 'clock', APPROVED: 'circle-check', REJECTED: 'circle-x', MISSING: 'file-question' } as const;

export function formatTdoDate(value?: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatWhen(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function fileSize(bytes?: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
}

// Files go through our own server so the browser shows them in the page instead of downloading them.
function fileLink(url: string, fileName: string | null, download = false): string {
  return `/api/document?url=${encodeURIComponent(url)}&name=${encodeURIComponent(fileName ?? '')}${download ? '&download=1' : ''}`;
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
}

/**
 * The data comes from the Next.js server (app/documents/review/page.jsx).
 * Approve and reject are server actions: after each one the server sends back a fresh `job`.
 */
interface DocumentReviewProps {
  job: ReviewJob | null;
  error: ApiError | null;
  jobId: string;
  requestedDoc: string | null;
  nextJob: { id: string; jobNumber: string } | null;
}

export function DocumentReview({ job, error, jobId, requestedDoc, nextJob }: DocumentReviewProps) {
  const navigate = useNavigate();
  const router = useRouter();

  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const units = useMemo(() => job?.units || [], [job]);
  const docs = useMemo(() => flattenDocuments(units), [units]);
  const counts = useMemo(() => countDocuments(units), [units]);
  const locked = Boolean(job?.locked);
  const kind = job?.unitKind || 'container';

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todo' | 'all' | null>(null); // null until the job loads
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmFinal, setConfirmFinal] = useState<FlatDocument | null>(null);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // First load: open the requested document, else the first one to review.
  useEffect(() => {
    if (!job || selectedId) return;
    const first = docs.find((d) => d.id === requestedDoc) || docs.find((d) => d.status === DOC_STATUS.PENDING) || docs[0];
    setSelectedId(first?.id || null);
    setFilter(counts.pending > 0 ? 'todo' : 'all');
    setCollapsed(new Set(units.filter((u) => u.documents.every((d) => d.status === DOC_STATUS.APPROVED) && !u.documents.some((d) => d.id === first?.id)).map((u) => u.id)));
  }, [job, docs, counts.pending, units, requestedDoc, selectedId]);

  // Nothing left to review: show the whole job so rejected files stay in view.
  useEffect(() => { if (job && counts.pending === 0 && filter === 'todo') setFilter('all'); }, [job, counts.pending, filter]);

  const selected = docs.find((d) => d.id === (selectedId || requestedDoc))
    || (selectedId ? null : docs.find((d) => d.status === DOC_STATUS.PENDING) || docs[0]) || null;
  const visibleUnits = units
    .map((unit) => ({ ...unit, shown: filter === 'todo' ? unit.documents.filter((d) => d.status === DOC_STATUS.PENDING || d.id === selectedId) : unit.documents }))
    .filter((unit) => unit.shown.length);
  const hiddenUnits = units.length - visibleUnits.length;
  const navOrder = visibleUnits.flatMap((u) => (collapsed.has(u.id) ? [] : u.shown));

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setRejecting(false);
    setReason('');
    setViewVersion(null);
    setActionError(null);
    const unit = units.find((u) => u.documents.some((d) => d.id === id));
    if (unit) setCollapsed((current) => { if (!current.has(unit.id)) return current; const next = new Set(current); next.delete(unit.id); return next; });
  }, [units]);

  useEffect(() => {
    railRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const advanceFrom = useCallback((doc: FlatDocument) => {
    const next = nextPendingAfter(units, doc.id);
    if (next) select(next.id);
  }, [units, select]);

  // A failed action means the screen may be out of date: show the reason and ask the server for fresh data.
  const failed = (problem?: ApiError | null) => {
    setActionError(problem?.code === 'DOCUMENTS_LOCKED'
      ? 'These documents are locked because the job is already validated.'
      : problem?.message || 'The review couldn’t be saved. Try again.');
    router.refresh();
  };

  const doApprove = async (doc: FlatDocument | null, { confirmed = false }: { confirmed?: boolean } = {}) => {
    if (!doc || !job || doc.status !== DOC_STATUS.PENDING || !doc.canReview || locked || busy) return;
    if (viewVersion != null) { setViewVersion(null); return; } // never approve while an old version is on screen
    const isFinal = counts.pending === 1 && counts.rejected === 0 && counts.missing === 0;
    if (isFinal && !confirmed) { setConfirmFinal(doc); return; }
    setBusy('approve');
    try {
      const result = await approveDocumentAction({ jobId: job.id, documentId: doc.id });
      setConfirmFinal(null);
      if (!result.ok) { failed(result.error); return; }
      if (isFinal) {
        // the backend validates the job by itself when the last required document is approved
        showToast(`${job.jobNumber} validated. Documents are locked and the job is open to bids.`);
      } else {
        showToast(`${rejectionPrefix(doc)} approved`);
        advanceFrom(doc);
      }
    } catch {
      setConfirmFinal(null);
      failed(null);
    } finally {
      setBusy(null);
    }
  };

  const fullReason = selected ? `${rejectionPrefix(selected)}: ${reason.trim()}` : '';
  const doReject = async () => {
    if (!selected || !job || !selected.canReview || !reason.trim() || busy) return;
    const doc = selected;
    setBusy('reject');
    try {
      const result = await rejectDocumentAction({ jobId: job.id, documentId: doc.id, reason: fullReason });
      if (!result.ok) { failed(result.error); return; }
      showToast(`${rejectionPrefix(doc)} rejected. The forwarder will see your reason.`, { tone: 'info' });
      setRejecting(false);
      setReason('');
      advanceFrom(doc);
    } catch {
      failed(null);
    } finally {
      setBusy(null);
    }
  };

  const openReject = () => {
    if (!selected || selected.status !== DOC_STATUS.PENDING || !selected.canReview || locked) return;
    setRejecting(true);
    setTimeout(() => reasonRef.current?.focus(), 0);
  };

  // Keyboard: A approve · R reject · ↑/↓ or J/K move · Esc closes the reject panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (confirmFinal || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape' && rejecting) { setRejecting(false); return; }
      if (isTyping(event.target)) return;
      const index = navOrder.findIndex((d) => d.id === selectedId);
      if (event.key === 'ArrowDown' || event.key === 'j') { event.preventDefault(); const next = navOrder[index + 1]; if (next) select(next.id); }
      else if (event.key === 'ArrowUp' || event.key === 'k') { event.preventDefault(); const prev = navOrder[index - 1]; if (prev) select(prev.id); }
      else if (event.key === 'a' && selected) { event.preventDefault(); doApprove(selected); }
      else if (event.key === 'r' && selected) { event.preventDefault(); openReject(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!jobId) return <div className="dr-screen"><EmptyState icon="file-question" title="No job selected" description="Open a job from the Documents queue to review it." action={<Button onClick={() => navigate('/documents')}>Go to Documents</Button>} /></div>;
  if (!job) {
    return (
      <div className="dr-screen">
        <EmptyState icon="file-x" title={error?.status === 404 ? 'Job not found' : 'Documents couldn’t be loaded'} description={error?.status === 404 ? 'This job has no documents to review.' : error?.message || 'Check your connection and try again.'}
          action={<span style={{ display: 'flex', gap: 8 }}><Button variant="outline" onClick={() => navigate('/documents')}>Back to Documents</Button>{error?.status !== 404 && <Button onClick={() => router.refresh()}>Retry</Button>}</span>} />
      </div>
    );
  }

  const meta = REVIEW_STATUS_META[job.reviewStatus];
  const previous = selected?.history?.[selected.history.length - 1] || null;
  const showing = viewVersion != null && selected ? selected.history.find((h) => h.version === viewVersion) || selected : selected;
  const isFinalApproval = selected?.status === DOC_STATUS.PENDING && counts.pending === 1 && counts.rejected === 0 && counts.missing === 0;
  const shownSize = showing?.fileSize || fileSize(showing?.sizeBytes);
  const canAct = Boolean(selected?.canReview) && selected?.status === DOC_STATUS.PENDING && !locked;

  return (
    <div className="dr-screen">
      {/* ── Job bar ─────────────────────────────────────────────────── */}
      <header className="dr-jobbar">
        <div className="dr-jobbar-main">
          <IconButton icon="arrow-left" label="Back to Documents" onClick={() => navigate('/documents')} />
          <div className="dr-jobbar-title">
            <div className="dr-jobbar-heading">
              <h1>{job.jobNumber}</h1>
              <Badge tone={meta.tone} dot>{meta.label}</Badge>
              {job.movement && <Badge tone={kind === 'rack' ? 'purple' : 'neutral'}>{job.movement}</Badge>}
            </div>
            <p>{job.forwarder} · {job.route?.pickup} → {job.route?.delivery} · {units.length} {unitNoun(kind, units.length)}</p>
          </div>
        </div>
        <div className="dr-jobbar-facts">
          <div className="dr-fact dr-fact-tdo">
            <span className="dr-fact-label"><Icon name="calendar-check" size={14} />TDO date</span>
            <strong>{formatTdoDate(job.tdoDate)}</strong>
            <small>Same for every {unitNoun(kind)}</small>
          </div>
          <div className="dr-fact dr-fact-progress">
            <span className="dr-fact-label"><Icon name="list-checks" size={14} />Progress</span>
            <DocumentProgress counts={counts} size="lg" />
            <small className="dr-fact-legend">
              <span className="is-pending">{counts.pending} pending</span>
              <span className="is-rejected">{counts.rejected} rejected</span>
              {counts.missing > 0 && <span className="is-rejected">{counts.missing} not uploaded</span>}
            </small>
          </div>
          <Button variant="outline" size="sm" iconRight="arrow-up-right" onClick={() => navigate(`/jobs/detail?id=${encodeURIComponent(job.id)}`)}>Open job</Button>
        </div>
      </header>

      {/* ── State banners ───────────────────────────────────────────── */}
      {locked ? (
        <div className="dr-callout is-success" role="status">
          <Icon name="lock" size={18} />
          <div><strong>All {counts.total} documents approved. Documents are locked.</strong>
            <span>{job.validatedAt ? `Validated ${formatWhen(job.validatedAt)}${job.validatedBy ? ` by ${job.validatedBy}` : ''}. ` : ''}The job is open to bids and the forwarder can no longer replace files.</span></div>
          {nextJob && <Button size="sm" iconRight="arrow-right" onClick={() => navigate(`/documents/review?jobId=${encodeURIComponent(nextJob.id)}`)}>Next job · {nextJob.jobNumber}</Button>}
        </div>
      ) : counts.pending === 0 ? (
        <div className="dr-callout is-waiting" role="status">
          <Icon name="hourglass" size={18} />
          <div><strong>You’re done for now. Waiting on the forwarder.</strong>
            <span>{counts.rejected + counts.missing} {counts.rejected + counts.missing === 1 ? 'document needs' : 'documents need'} the forwarder: {counts.rejected} to replace, {counts.missing} not uploaded. When the forwarder uploads a file, the job comes back to your queue.</span></div>
          {nextJob ? <Button size="sm" iconRight="arrow-right" onClick={() => navigate(`/documents/review?jobId=${encodeURIComponent(nextJob.id)}`)}>Next job · {nextJob.jobNumber}</Button>
            : <Button size="sm" variant="outline" onClick={() => navigate('/documents')}>Back to queue</Button>}
        </div>
      ) : null}
      {actionError && <Banner tone="danger" title={actionError} />}

      <div className="dr-workspace">
        {/* ── Rail ──────────────────────────────────────────────────── */}
        <aside className="dr-rail" aria-label={`Documents by ${unitNoun(kind)}`}>
          <div className="dr-rail-head">
            <div className="dr-seg" role="tablist" aria-label="Show documents">
              <button type="button" role="tab" aria-selected={filter === 'todo'} onClick={() => setFilter('todo')}>To review <span>{counts.pending}</span></button>
              <button type="button" role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>All <span>{counts.total}</span></button>
            </div>
          </div>
          <div className="dr-rail-scroll" ref={railRef}>
            {visibleUnits.length === 0 && (
              <div className="dr-rail-empty"><Icon name="check-check" size={22} /><strong>Nothing to review</strong><button type="button" onClick={() => setFilter('all')}>Show all documents</button></div>
            )}
            {visibleUnits.map((unit) => {
              const unitCounts = countDocuments([unit]);
              const done = unitCounts.approved === unitCounts.total;
              const open = !collapsed.has(unit.id);
              return (
                <section key={unit.id} className={'dr-unit' + (done ? ' is-done' : '')}>
                  <button type="button" className="dr-unit-head" aria-expanded={open} onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(unit.id)) next.delete(unit.id); else next.add(unit.id); return next; })}>
                    <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
                    <span className="dr-unit-label">{unit.label}</span>
                    <span className="dr-unit-count">
                      {done ? <Icon name="circle-check" size={15} color="var(--tk-success)" title="All approved" /> : unitCounts.rejected ? <Icon name="circle-alert" size={15} color="var(--tk-danger)" title="Has a rejected document" /> : null}
                      {unitCounts.approved}/{unitCounts.total}
                    </span>
                  </button>
                  {open && (
                    <ul>
                      {unit.shown.map((doc) => (
                        <li key={doc.id}>
                          <button type="button" className={'dr-doc is-' + doc.status.toLowerCase()} aria-current={doc.id === selectedId ? 'true' : undefined} onClick={() => select(doc.id)}>
                            <Icon name={STATUS_ICON[doc.status]} size={16} className="dr-doc-icon" />
                            <span className="dr-doc-name">{docLabel(doc.type)}</span>
                            {doc.status === DOC_STATUS.PENDING && doc.version > 1 && <span className="dr-pill is-info">Resubmitted</span>}
                            <span className="dr-doc-status">{docStatusLabel(doc.status)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
            {filter === 'todo' && hiddenUnits > 0 && (
              <button type="button" className="dr-rail-hidden" onClick={() => setFilter('all')}>
                <Icon name="eye-off" size={14} />{hiddenUnits} {unitNoun(kind, hiddenUnits)} with nothing to review
              </button>
            )}
          </div>
          <div className="dr-rail-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>A</kbd> approve <kbd>R</kbd> reject</div>
        </aside>

        {/* ── Document ──────────────────────────────────────────────── */}
        {selected ? (
          <section className="dr-main" aria-label="Selected document">
            <div className="dr-doc-header">
              <div className="dr-doc-title">
                <span className="dr-eyebrow">{kind === 'rack' ? 'Rack' : 'Container'} <b>{selected.unitLabel}</b></span>
                <h2>{docDescription(selected.type)}{selected.type === 'TDO' ? ' (TDO)' : ''}</h2>
              </div>
              <div className="dr-doc-badges">
                {selected.version > 1 && <span className="dr-pill">v{selected.version}</span>}
                <Badge tone={docStatusTone(selected.status)} dot>{docStatusLabel(selected.status)}</Badge>
                {locked && <Badge tone="neutral"><Icon name="lock" size={12} /> Locked</Badge>}
                {showing?.url && <a className="dr-icon-link" href={fileLink(showing.url, showing.fileName, true)} aria-label="Download file" title="Download"><Icon name="download" size={17} /></a>}
              </div>
            </div>

            {selected.status === DOC_STATUS.PENDING && previous && (
              <div className="dr-note is-info">
                <Icon name="history" size={16} />
                <div><strong>Resubmitted after a rejection</strong>
                  <span>v{previous.version} was rejected {formatWhen(previous.reviewedAt)}{previous.reviewedBy ? ` by ${previous.reviewedBy}` : ''}: “{previous.rejectionReason}”</span></div>
                <div className="dr-seg dr-seg-sm" role="tablist" aria-label="Version">
                  {[...selected.history.map((h) => h.version), selected.version].map((v) => (
                    <button key={v} type="button" role="tab" aria-selected={(viewVersion ?? selected.version) === v} onClick={() => setViewVersion(v === selected.version ? null : v)}>v{v}{v === selected.version ? ' · new' : ''}</button>
                  ))}
                </div>
              </div>
            )}
            {selected.status === DOC_STATUS.REJECTED && (
              <div className="dr-note is-danger">
                <Icon name="circle-x" size={16} />
                <div><strong>Rejected. Waiting on the forwarder to replace this file.</strong>
                  <span>“{selected.rejectionReason}” · {selected.reviewedBy || '—'} · {formatWhen(selected.reviewedAt)}</span></div>
              </div>
            )}
            {selected.status === DOC_STATUS.MISSING && (
              <div className="dr-note is-info">
                <Icon name="file-question" size={16} />
                <div><strong>Not uploaded yet</strong>
                  <span>The forwarder still has to upload the {docDescription(selected.type)} for {selected.unitLabel}. You can review it once it arrives.</span></div>
              </div>
            )}

            {canAct && (
              <div className="dr-check" aria-label="What to check">
                <span className="dr-check-label"><Icon name="scan-search" size={14} />Check the file shows</span>
                <span className="dr-check-chip"><small>{kind === 'rack' ? 'Rack' : 'Container'}</small><b>{selected.unitLabel}</b></span>
                {selected.type === 'TDO' && <span className="dr-check-chip"><small>TDO date</small><b>{formatTdoDate(job.tdoDate)}</b></span>}
              </div>
            )}

            <div className="dr-canvas">
              {viewVersion != null && <span className="dr-canvas-flag">Viewing v{viewVersion} (rejected)</span>}
              {showing?.url
                ? (/^image\//.test(showing.mimeType || '') ? <img src={fileLink(showing.url, showing.fileName)} alt={`${docDescription(selected.type)} for ${selected.unitLabel}`} /> : <iframe src={fileLink(showing.url, showing.fileName)} title={`${docDescription(selected.type)} for ${selected.unitLabel}`} referrerPolicy="no-referrer" />)
                : <div className="dr-canvas-empty"><Icon name="file-x" size={40} /><strong>{selected.status === DOC_STATUS.MISSING ? 'Not uploaded yet' : 'No preview available'}</strong><span>{selected.status === DOC_STATUS.MISSING ? 'There is no file to show.' : 'The file can’t be shown here.'}</span></div>}
            </div>

            <footer className="dr-footer">
              {rejecting ? (
                <form className="dr-reject" onSubmit={(event) => { event.preventDefault(); doReject(); }}>
                  <div className="dr-reject-head">
                    <strong>Why are you rejecting this?</strong>
                    <span>The forwarder sees this message and replaces only this file.</span>
                  </div>
                  <div className="dr-chips" role="group" aria-label="Common reasons">
                    {REJECTION_PRESETS.map((preset) => (
                      <button key={preset} type="button" className={'dr-chip' + (reason === preset ? ' is-on' : '')} onClick={() => { setReason(preset); reasonRef.current?.focus(); }}>{preset}</button>
                    ))}
                  </div>
                  <div className="dr-reason">
                    <span className="dr-reason-prefix">{rejectionPrefix(selected)}:</span>
                    <textarea ref={reasonRef} rows={1} value={reason} maxLength={280} placeholder="Describe what’s wrong…" onChange={(event) => setReason(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); doReject(); } }} />
                  </div>
                  <div className="dr-reject-actions">
                    <span className="dr-hint"><kbd>⌘</kbd><kbd>↵</kbd> send · <kbd>Esc</kbd> cancel</span>
                    <Button variant="outline" onClick={() => { setRejecting(false); setReason(''); }}>Cancel</Button>
                    <Button type="submit" variant="danger" icon="circle-x" disabled={!reason.trim() || Boolean(busy)} style={{ background: reason.trim() ? 'var(--tk-danger)' : undefined, color: reason.trim() ? '#fff' : undefined }}>{busy === 'reject' ? 'Rejecting…' : 'Reject document'}</Button>
                  </div>
                </form>
              ) : (
                <>
                  <dl className="dr-meta">
                    <div><dt>File</dt><dd title={showing?.fileName ?? undefined}>{showing?.fileName || '—'}{shownSize ? <small> · {shownSize}</small> : null}</dd></div>
                    <div><dt>Uploaded</dt><dd>{showing?.uploadedBy || '—'} · {formatWhen(showing?.uploadedAt)}</dd></div>
                    {selected.status === DOC_STATUS.APPROVED && <div><dt>Approved</dt><dd>{selected.reviewedBy || '—'} · {formatWhen(selected.reviewedAt)}</dd></div>}
                  </dl>
                  <div className="dr-actions">
                    {canAct ? (
                      <>
                        <Button variant="danger" icon="circle-x" disabled={Boolean(busy)} onClick={openReject}>Reject <kbd className="dr-kbd">R</kbd></Button>
                        <Button icon={isFinalApproval ? 'shield-check' : 'circle-check'} disabled={Boolean(busy) || viewVersion != null} onClick={() => doApprove(selected)}>
                          {busy === 'approve' ? 'Approving…' : isFinalApproval ? 'Approve & validate job' : 'Approve'} <kbd className="dr-kbd is-light">A</kbd>
                        </Button>
                      </>
                    ) : counts.pending > 0 ? (
                      <Button variant="secondary" iconRight="arrow-right" onClick={() => { const next = nextPendingAfter(units, selected.id); if (next) select(next.id); }}>Next to review</Button>
                    ) : null}
                  </div>
                </>
              )}
            </footer>
          </section>
        ) : (
          <section className="dr-main"><EmptyState icon="files" title="No documents" description="This job has no documents yet." /></section>
        )}
      </div>

      <Modal
        open={Boolean(confirmFinal)}
        onClose={() => { if (!busy) setConfirmFinal(null); }}
        title="Approve and validate this job?"
        description={confirmFinal ? `${rejectionPrefix(confirmFinal)} is the last document on ${job.jobNumber}.` : ''}
        footer={<>
          <Button variant="outline" disabled={Boolean(busy)} onClick={() => setConfirmFinal(null)}>Not yet</Button>
          <Button icon="shield-check" disabled={Boolean(busy)} onClick={() => doApprove(confirmFinal, { confirmed: true })} autoFocus>{busy ? 'Validating…' : 'Approve & validate'}</Button>
        </>}
      >
        <ul className="dr-confirm-list">
          <li><Icon name="circle-check" size={16} color="var(--tk-success)" />All {counts.total} documents across {units.length} {unitNoun(kind, units.length)} will be approved.</li>
          <li><Icon name="lock" size={16} color="var(--tk-ink-500)" />Documents are locked. The forwarder can’t replace them.</li>
          <li><Icon name="gavel" size={16} color="var(--tk-blue)" />The job opens to bids from trucking companies.</li>
        </ul>
      </Modal>
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <div className="dr-screen" role="status" aria-busy="true" aria-label="Loading documents">
      <div className="dr-jobbar"><Skeleton width={260} height={28} /><Skeleton width={320} height={40} /></div>
      <div className="dr-workspace">
        <aside className="dr-rail" style={{ padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={i % 4 === 0 ? 18 : 34} />)}</aside>
        <section className="dr-main" style={{ padding: 20 }}><Skeleton height={420} /></section>
      </div>
    </div>
  );
}

export default DocumentReview;