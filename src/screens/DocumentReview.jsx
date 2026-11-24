'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavigate } from '../router.js';
import { showToast } from '../components/ActionToast.jsx';
import { DocumentProgress } from '../components/DocumentProgress.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { Badge, Banner, Button, EmptyState, Icon, IconButton, Modal, Skeleton } from '../ds.js';
import {
  DOC_STATUS,
  JOB_REVIEW_STATUS,
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
} from '../domain/containerReview.js';
import {
  useApproveContainerDocumentMutation,
  useGetContainerReviewJobQuery,
  useGetContainerReviewJobsQuery,
  useRejectContainerDocumentMutation,
  useSimulateForwarderReplacementMutation,
} from '../store/features/documents/containerReviewApi.js';
import './DocumentReview.css';

const STATUS_ICON = { PENDING: 'clock', APPROVED: 'circle-check', REJECTED: 'circle-x' };

export function formatTdoDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatWhen(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function fileSize(bytes) {
  if (!Number.isFinite(bytes)) return null;
  return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
}

function isTyping(target) {
  return target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
}

export function DocumentReview() {
  const navigate = useNavigate();
  const params = useSearchParams();
  const jobId = params.get('jobId');
  const requestedDoc = params.get('doc');
  const hint = params.get('ref') ? { jobNumber: params.get('ref') } : undefined;

  const { currentData: job, isLoading, error, refetch } = useGetContainerReviewJobQuery({ jobId, hint }, { skip: !jobId, refetchOnMountOrArgChange: true });
  const { currentData: queue } = useGetContainerReviewJobsQuery();
  const [approve, approveState] = useApproveContainerDocumentMutation();
  const [reject, rejectState] = useRejectContainerDocumentMutation();
  const [simulate, simulateState] = useSimulateForwarderReplacementMutation();
  const busy = approveState.isLoading || rejectState.isLoading || simulateState.isLoading;

  const units = useMemo(() => job?.units || [], [job]);
  const docs = useMemo(() => flattenDocuments(units), [units]);
  const counts = useMemo(() => countDocuments(units), [units]);
  const locked = Boolean(job?.locked);
  const kind = job?.unitKind || 'container';

  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState(null); // 'todo' | 'all'; null until the job loads
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmFinal, setConfirmFinal] = useState(null);
  const [viewVersion, setViewVersion] = useState(null);
  const [actionError, setActionError] = useState(null);
  const reasonRef = useRef(null);
  const railRef = useRef(null);

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

  const select = useCallback((id) => {
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

  const advanceFrom = useCallback((doc) => {
    const next = nextPendingAfter(units, doc.id);
    if (next) select(next.id);
  }, [units, select]);

  const failed = (err) => {
    const message = err?.data?.code === 'DOCUMENTS_LOCKED'
      ? 'These documents are locked because the job is already validated.'
      : getApiErrorMessage(err, 'The review couldn’t be saved. Try again.');
    setActionError(message);
    refetch();
  };

  const doApprove = async (doc, { confirmed = false } = {}) => {
    if (!doc || doc.status !== DOC_STATUS.PENDING || locked || busy) return;
    if (viewVersion != null) { setViewVersion(null); return; } // never approve while an old version is on screen
    const isFinal = counts.pending === 1 && counts.rejected === 0;
    if (isFinal && !confirmed) { setConfirmFinal(doc); return; }
    try {
      const result = await approve({ jobId: job.id, documentId: doc.id }).unwrap();
      setConfirmFinal(null);
      if (result.job.reviewStatus === JOB_REVIEW_STATUS.VALIDATED) {
        showToast(`${job.jobNumber} validated. Documents are locked and the job is open to bids.`);
      } else {
        showToast(`${rejectionPrefix(doc)} approved`);
        advanceFrom(doc);
      }
    } catch (err) { setConfirmFinal(null); failed(err); }
  };

  const fullReason = selected ? `${rejectionPrefix(selected)}: ${reason.trim()}` : '';
  const doReject = async () => {
    if (!selected || !reason.trim() || busy) return;
    try {
      await reject({ jobId: job.id, documentId: selected.id, reason: fullReason }).unwrap();
      showToast(`${rejectionPrefix(selected)} rejected. The forwarder will see your reason.`, { tone: 'info' });
      const doc = selected;
      setRejecting(false);
      setReason('');
      advanceFrom(doc);
    } catch (err) { failed(err); }
  };

  const openReject = () => {
    if (!selected || selected.status !== DOC_STATUS.PENDING || locked) return;
    setRejecting(true);
    setTimeout(() => reasonRef.current?.focus(), 0);
  };

  // Keyboard: A approve · R reject · ↑/↓ or J/K move · Esc closes the reject panel.
  useEffect(() => {
    const onKey = (event) => {
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
  if (isLoading || (!job && !error)) return <ReviewSkeleton />;
  if (error && !job) {
    return (
      <div className="dr-screen">
        <EmptyState icon="file-x" title={error.status === 404 ? 'Job not found' : 'Documents couldn’t be loaded'} description={error.status === 404 ? 'This job has no documents to review.' : 'Check your connection and try again.'}
          action={<span style={{ display: 'flex', gap: 8 }}><Button variant="outline" onClick={() => navigate('/documents')}>Back to Documents</Button>{error.status !== 404 && <Button onClick={refetch}>Retry</Button>}</span>} />
      </div>
    );
  }

  const meta = REVIEW_STATUS_META[job.reviewStatus];
  const nextJob = (queue || []).filter((j) => j.reviewStatus === JOB_REVIEW_STATUS.NEEDS_REVIEW && j.id !== job.id)
    .sort((a, b) => String(a.oldestPendingAt).localeCompare(String(b.oldestPendingAt)))[0];
  const previous = selected?.history?.[selected.history.length - 1] || null;
  const showing = viewVersion != null && selected ? selected.history.find((h) => h.version === viewVersion) || selected : selected;
  const isFinalApproval = selected?.status === DOC_STATUS.PENDING && counts.pending === 1 && counts.rejected === 0;

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
              {job.jobType === 'Bulk break' && <Badge tone="purple">Bulk break</Badge>}
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
            <span>Validated {formatWhen(job.validatedAt)}{job.validatedBy ? ` by ${job.validatedBy}` : ''}. The job is open to bids and the forwarder can no longer replace files.</span></div>
          {nextJob && <Button size="sm" iconRight="arrow-right" onClick={() => navigate(`/documents/review?jobId=${encodeURIComponent(nextJob.id)}`)}>Next job · {nextJob.jobNumber}</Button>}
        </div>
      ) : counts.pending === 0 ? (
        <div className="dr-callout is-waiting" role="status">
          <Icon name="hourglass" size={18} />
          <div><strong>You’re done for now. Waiting on the forwarder.</strong>
            <span>{counts.rejected} rejected {counts.rejected === 1 ? 'document needs' : 'documents need'} replacing. When the forwarder uploads a new file, the job comes back to your queue.</span></div>
          {nextJob ? <Button size="sm" iconRight="arrow-right" onClick={() => navigate(`/documents/review?jobId=${encodeURIComponent(nextJob.id)}`)}>Next job · {nextJob.jobNumber}</Button>
            : <Button size="sm" variant="outline" onClick={() => navigate('/documents')}>Back to queue</Button>}
        </div>
      ) : null}
      {actionError && <Banner tone="danger" title={actionError} onClose={() => setActionError(null)} />}

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
                {showing?.url && <a className="dr-icon-link" href={showing.url} download={showing.fileName} aria-label="Download file" title="Download"><Icon name="download" size={17} /></a>}
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
                  <span>“{selected.rejectionReason}” · {selected.reviewedBy} · {formatWhen(selected.reviewedAt)}</span></div>
                <Button size="sm" variant="ghost" icon="flask-conical" disabled={busy} onClick={() => simulate({ jobId: job.id, documentId: selected.id }).unwrap().then(() => showToast('Forwarder uploaded a replacement (prototype).', { tone: 'info' })).catch(failed)} title="Prototype only: acts as the forwarder replacing this file">Simulate replacement</Button>
              </div>
            )}

            {selected.status === DOC_STATUS.PENDING && !locked && (
              <div className="dr-check" aria-label="What to check">
                <span className="dr-check-label"><Icon name="scan-search" size={14} />Check the file shows</span>
                <span className="dr-check-chip"><small>{kind === 'rack' ? 'Rack' : 'Container'}</small><b>{selected.unitLabel}</b></span>
                {selected.type === 'TDO' && <span className="dr-check-chip"><small>TDO date</small><b>{formatTdoDate(job.tdoDate)}</b></span>}
              </div>
            )}

            <div className="dr-canvas">
              {viewVersion != null && <span className="dr-canvas-flag">Viewing v{viewVersion} (rejected)</span>}
              {showing?.url
                ? (/^image\//.test(showing.mimeType || '') ? <img src={showing.url} alt={`${docDescription(selected.type)} for ${selected.unitLabel}`} /> : <iframe src={showing.url} title={`${docDescription(selected.type)} for ${selected.unitLabel}`} referrerPolicy="no-referrer" />)
                : <div className="dr-canvas-empty"><Icon name="file-x" size={40} /><strong>No preview available</strong><span>The file can’t be shown here.</span></div>}
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
                    <Button type="submit" variant="danger" icon="circle-x" disabled={!reason.trim() || busy} style={{ background: reason.trim() ? 'var(--tk-danger)' : undefined, color: reason.trim() ? '#fff' : undefined }}>{rejectState.isLoading ? 'Rejecting…' : 'Reject document'}</Button>
                  </div>
                </form>
              ) : (
                <>
                  <dl className="dr-meta">
                    <div><dt>File</dt><dd title={showing?.fileName}>{showing?.fileName || '—'}{fileSize(showing?.sizeBytes) ? <small> · {fileSize(showing.sizeBytes)}</small> : null}</dd></div>
                    <div><dt>Uploaded</dt><dd>{showing?.uploadedBy || '—'} · {formatWhen(showing?.uploadedAt)}</dd></div>
                    {selected.status === DOC_STATUS.APPROVED && <div><dt>Approved</dt><dd>{selected.reviewedBy} · {formatWhen(selected.reviewedAt)}</dd></div>}
                  </dl>
                  <div className="dr-actions">
                    {selected.status === DOC_STATUS.PENDING && !locked ? (
                      <>
                        <Button variant="danger" icon="circle-x" disabled={busy} onClick={openReject}>Reject <kbd className="dr-kbd">R</kbd></Button>
                        <Button icon={isFinalApproval ? 'shield-check' : 'circle-check'} disabled={busy || viewVersion != null} onClick={() => doApprove(selected)}>
                          {approveState.isLoading ? 'Approving…' : isFinalApproval ? 'Approve & validate job' : 'Approve'} <kbd className="dr-kbd is-light">A</kbd>
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
          <Button variant="outline" disabled={busy} onClick={() => setConfirmFinal(null)}>Not yet</Button>
          <Button icon="shield-check" disabled={busy} onClick={() => doApprove(confirmFinal, { confirmed: true })} autoFocus>{busy ? 'Validating…' : 'Approve & validate'}</Button>
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

function ReviewSkeleton() {
  return (
    <div className="dr-screen" role="status" aria-busy="true" aria-label="Loading documents">
      <div className="dr-jobbar"><Skeleton width={260} height={28} /><Skeleton width={320} height={40} /></div>
      <div className="dr-workspace">
        <aside className="dr-rail" style={{ padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={i % 4 === 0 ? 18 : 34} />)}</aside>
        <section className="dr-main" style={{ padding: 20 }}><Skeleton height="100%" /></section>
      </div>
    </div>
  );
}

export default DocumentReview;
