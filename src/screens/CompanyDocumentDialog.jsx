'use client';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Badge, Banner, Button, LabelValue, Modal, Skeleton, Textarea } from '../ds.js';
import { DriverLoadingNotice } from './DriversLoading.jsx';
import { companyError } from '../store/features/companies/companiesApi.js';
import { useGetAdminCompanyDocumentPreviewQuery, useReviewAdminCompanyDocumentMutation } from '../store/features/companies/companyDocumentsApi.js';
export function CompanyDocumentDialog({ companyId, document, onClose, onDone }) {
  const owner = useSelector(state => state.auth.admin?.id), role = useSelector(state => state.auth.admin?.role);
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const preview = useGetAdminCompanyDocumentPreviewQuery({ companyId, id: document.id, url: document.url, owner }, { skip: !authenticated || !owner || !document.url });
  const previewUrl = preview.error ? null : preview.currentData?.url;
  const [review, state] = useReviewAdminCompanyDocumentMutation();
  const [decision, setDecision] = useState(null), [reason, setReason] = useState(''), [error, setError] = useState(null), [unconfirmed, setUnconfirmed] = useState(false);
  const pending = useRef(false), active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const allowed = ['SUPER_ADMIN', 'OPS_ADMIN'].includes(role) && document.id && document.url;
  const busy = state.isLoading, close = () => { if (!pending.current) onClose(); };
  async function submit() {
    if (pending.current || !allowed || !decision || unconfirmed) return;
    pending.current = true; setError(null);
    try {
      await review({ companyId, document, decision, reason, owner, role }).unwrap();
      if (active.current) { onDone(decision === 'approve' ? 'Company document approved.' : 'Company document rejected.'); onClose(); }
    } catch (failure) {
      if (active.current) { setError(companyError(failure)); setUnconfirmed(failure.saveUnconfirmed === true); }
    } finally { pending.current = false; }
  }
  return <Modal open title={document.name} width={800} onClose={close} footer={<>
    <Button variant="outline" disabled={busy} onClick={close}>Close</Button>
    {!decision && allowed && !unconfirmed && <>
      <Button variant="danger" disabled={!['PENDING', 'APPROVED'].includes(document.statusCode)} onClick={() => setDecision('reject')}>Reject document</Button>
      <Button disabled={!['PENDING', 'REJECTED'].includes(document.statusCode)} onClick={() => setDecision('approve')}>Approve document</Button>
    </>}
    {decision && <><Button variant="outline" disabled={busy || unconfirmed} onClick={() => { setDecision(null); setError(null); }}>Cancel review</Button><Button variant={decision === 'reject' ? 'danger' : 'primary'} disabled={busy || unconfirmed || decision === 'reject' && (!reason.trim() || reason.trim().length > 500)} onClick={submit}>{busy ? 'Saving…' : decision === 'approve' ? 'Confirm approval' : 'Confirm rejection'}</Button></>}
  </>}>
    <div style={{ display: 'grid', gap: 14 }}>
      {error && <Banner tone="danger" title="Unable to confirm document review">{error}</Banner>}
      <Badge>{document.status}</Badge>
      {document.url ? <><Button variant="outline" icon="external-link" onClick={() => window.open(previewUrl || document.url, '_blank', 'noopener,noreferrer')}>Open file</Button>
        {previewUrl ? <iframe src={previewUrl} title={document.name + ' preview'} loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: 380, border: '1px solid var(--tk-line)', borderRadius: 'var(--tk-r-md)' }} />
          : <div style={{ width: '100%', height: 380, border: '1px solid var(--tk-line)', borderRadius: 'var(--tk-r-md)' }}>
            {preview.error ? <DriverLoadingNotice>{companyError(preview.error)}</DriverLoadingNotice> : <Skeleton height={380} />}
          </div>}
      </> : <span className="tk-meta">No uploaded file is available for this document.</span>}
      <LabelValue label="File" value={document.fileName} /><LabelValue label="Document Number" value={document.documentNumber} />
      <LabelValue label="Uploaded" value={document.uploadedAt} /><LabelValue label="Uploaded By" value={document.uploadedBy} />
      <LabelValue label="Expiry Date" value={document.expiresAt} /><LabelValue label="Expiry Status" value={document.expiry} />
      <LabelValue label="Reviewed" value={document.date} /><LabelValue label="Reviewed By" value={document.reviewedBy} />
      {document.rejectionReason && <LabelValue label="Rejection Reason" value={document.rejectionReason} />}
      {decision === 'approve' && <p className="tk-meta">Approve this company document?</p>}
      {decision === 'reject' && <Textarea label="Reason" maxLength={500} value={reason} disabled={busy || unconfirmed} onChange={event => setReason(event.target.value)} />}
    </div>
  </Modal>;
}
