'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavigate, useParams } from '../router.js';
import { Badge, Banner, Button, Card, EmptyState, Icon, Modal, PageHeader, SectionCard, Skeleton, Textarea } from '../ds.js';
import { canAdminReview, documentStatusTone } from '../domain/documents.js';
import {
  useApproveAdminDocumentMutation,
  useGetAdminDocReviewDetailQuery,
  useRejectAdminDocumentMutation,
} from '../store/features/documents/documentsApi.js';
import './Documents.css';

function requestError(error) {
  const message = error?.data?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(' ');
  return error?.status === 403 ? 'Your account cannot review this document.' : 'The request could not be completed.';
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function Info({ label, value }) {
  return <div className="document-info-row"><span>{label}</span><span>{value ?? '—'}</span></div>;
}

export function DocumentDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  const documentId = searchParams.get('documentId') || params.documentId;
  const { currentData: job, isLoading, isFetching, error, refetch } = useGetAdminDocReviewDetailQuery(jobId, {
    skip: !jobId,
    refetchOnMountOrArgChange: true,
  });
  const document = job?.documents.find((item) => item.id === documentId || item.rowKey === documentId);
  const [approveDocument] = useApproveAdminDocumentMutation();
  const [rejectDocument] = useRejectAdminDocumentMutation();
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!document?.id || !jobId || !action || submitting) return;
    setSubmitting(true);
    try {
      if (action === 'approve') await approveDocument({ jobId, documentId: document.id }).unwrap();
      else await rejectDocument({ jobId, documentId: document.id, reason: reason.trim() }).unwrap();
      setNotice({ tone: 'success', title: action === 'approve' ? 'Document approved.' : action === 'request' ? 'Re-upload request sent to the forwarder.' : 'Document rejected.' });
      setAction(null);
      setReason('');
    } catch (requestFailure) {
      setNotice({ tone: 'danger', title: requestError(requestFailure) });
    } finally {
      setSubmitting(false);
    }
  }

  if (!jobId) return <Card><EmptyState icon="file-text" title="Open a document from the queue" description="The document link needs its job ID." /><Button variant="secondary" onClick={() => navigate('/documents')}>Back to Documents</Button></Card>;
  if (isLoading || (isFetching && !job)) return <div className="documents-screen" role="status" aria-label="Loading document details" aria-busy="true"><Card><Skeleton width={240} height={28} /></Card><Card><Skeleton height={360} /></Card></div>;
  if (error) return <Card><EmptyState icon="file-text" title={error.status === 403 ? 'Access denied' : error.status === 404 ? 'Job not found' : 'Document details unavailable'} description="Please try again or return to Documents." /><div className="documents-detail-empty-actions"><Button variant="outline" onClick={refetch}>Retry</Button><Button variant="secondary" onClick={() => navigate('/documents')}>Back to Documents</Button></div></Card>;
  if (!document) return <Card><EmptyState icon="file-text" title="Document not found" description="This document is not in the job review response." /><Button variant="secondary" onClick={() => navigate('/documents')}>Back to Documents</Button></Card>;

  const reviewable = Boolean(document.id) && canAdminReview(document);
  return (
    <div className="documents-screen">
      <PageHeader
        crumbs={[{ label: 'Operations' }, { label: 'Documents', href: '/documents' }, { label: job.displayId }, { label: document.name }]}
        title={document.name}
        description={`Job document for ${job.displayId}.`}
        actions={<>
          <Button variant="secondary" icon="arrow-left" onClick={() => navigate('/documents')}>Back to Documents</Button>
          <Button variant="outline" icon="download" disabled={!document.url} onClick={() => window.open(document.url, '_blank', 'noopener,noreferrer')}>Open file</Button>
        </>}
      />
      {notice && <Banner tone={notice.tone} onClose={() => setNotice(null)}>{notice.title}</Banner>}
      {isFetching && <Banner tone="info" title="Refreshing document details…" />}
      <div className="job-document-detail-grid">
        <div className="document-detail-main">
          <SectionCard title="Document preview" action={<Badge tone={documentStatusTone(document.status)}>{document.status}</Badge>}>
            {document.url ? <div className="job-document-preview has-file"><iframe src={document.url} title={`${document.name} preview`} loading="lazy" referrerPolicy="no-referrer" /></div>
              : <div className="job-document-preview"><Icon name="file-text" size={38} color="var(--tk-blue)" /><strong>{document.fileName || document.name}</strong><span>This document has not been uploaded.</span></div>}
          </SectionCard>
          <SectionCard title="Review history">
            {document.uploadedAt || document.reviewedAt || document.rejectionReason ? <>
              {document.uploadedAt && <div className="document-activity"><span className="node"><Icon name="upload" size={12} /></span><span><strong>Document uploaded</strong><small>{document.uploadedBy || 'Uploader unavailable'} · {formatTime(document.uploadedAt)}</small></span></div>}
              {document.reviewedAt && <div className="document-activity"><span className="node"><Icon name="shield-check" size={12} /></span><span><strong>Review recorded</strong><small>{document.reviewedBy || 'Reviewer unavailable'} · {formatTime(document.reviewedAt)}</small></span></div>}
              {document.rejectionReason && <div className="document-review-note"><strong>Review reason</strong><p>{document.rejectionReason}</p></div>}
            </> : <p className="tk-muted">Review history is not available in this response.</p>}
          </SectionCard>
        </div>
        <div className="document-detail-rail">
          <SectionCard title="Document status">
            <Info label="Status" value={<Badge tone={documentStatusTone(document.status)}>{document.status}</Badge>} />
            <Info label="Review authority" value={document.reviewAuthority === 'trukkas_admin' ? 'Trukkas Admin' : '—'} />
            <Info label="Required for" value={job.jobType || '—'} />
            {reviewable && <div className="document-review-actions"><Button fullWidth onClick={() => setAction('approve')}>Approve document</Button><Button fullWidth variant="secondary" onClick={() => setAction('request')}>Request re-upload</Button><Button fullWidth variant="danger" onClick={() => setAction('reject')}>Reject document</Button></div>}
          </SectionCard>
          <SectionCard title="Document information">
            <Info label="Document type" value={document.name} />
            <Info label="Job ID" value={job.displayId} />
            <Info label="Uploaded by" value={document.uploadedBy || '—'} />
            <Info label="Uploader role" value={document.uploadedByRole || '—'} />
            <Info label="Date uploaded" value={formatTime(document.uploadedAt)} />
            <Info label="File type" value={document.fileType || '—'} />
            <Info label="File size" value={document.fileSize || '—'} />
            <Info label="Version" value={document.version ? `v${document.version}` : '—'} />
            <Button fullWidth variant="secondary" style={{ marginTop: 12 }} onClick={() => navigate(`/jobs/detail?id=${encodeURIComponent(job.id)}`)}>View job details</Button>
          </SectionCard>
        </div>
      </div>
      <Modal open={!!action} onClose={() => setAction(null)} title={action === 'approve' ? 'Approve document' : action === 'request' ? 'Request re-upload' : 'Reject document'} footer={<><Button variant="outline" disabled={submitting} onClick={() => setAction(null)}>Cancel</Button><Button variant={action === 'reject' ? 'danger' : 'primary'} disabled={submitting || (action !== 'approve' && !reason.trim())} onClick={submit}>{submitting ? 'Saving…' : action === 'approve' ? 'Approve' : action === 'request' ? 'Send request' : 'Reject'}</Button></>}>
        {action === 'approve' ? <p className="tk-muted">Approve this document for job progression?</p> : <Textarea label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain what needs to be corrected…" />}
      </Modal>
    </div>
  );
}

export default DocumentDetail;
