'use client';

import { useState } from 'react';
import { useNavigate, useParams } from '../router.js';
import { Badge, Banner, Button, Card, Icon, Modal, PageHeader, SectionCard, Textarea } from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { approveOperationalDocument, rejectOperationalDocument } from '../mock/api.js';
import { canAdminReview, documentStatusTone } from '../domain/documents.js';
import './Documents.css';

const labels = { tdo: 'TDO', customs_gate_pass: 'Customs Gate Pass', exit_note: 'Exit Note', indemnity_letter: 'Indemnity Letter', confirmation_letter: 'Confirmation Letter' };

export function DocumentDetail() {
  const navigate = useNavigate();
  const { documentId } = useParams();
  const documents = useCollection('documents');
  const jobs = useCollection('jobs');
  const document = documents.find((item) => item.id === documentId);
  const job = jobs.find((item) => item.id === document?.jobId);
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  if (!document) return <Card><p>Document not found.</p><Button variant="secondary" onClick={() => navigate('/documents')}>Back to Documents</Button></Card>;

  const download = () => {
    const file = new Blob([`${document.name}\nJob: ${document.jobId}\nStatus: ${document.status}`], { type: 'text/plain' });
    const url = URL.createObjectURL(file); const link = window.document.createElement('a');
    link.href = url; link.download = document.fileName === '—' ? 'document.txt' : `${document.fileName}.txt`; link.click(); URL.revokeObjectURL(url);
  };
  const submit = async () => {
    if (action === 'approve') await approveOperationalDocument(document.id);
    else await rejectOperationalDocument(document.id, reason, action === 'request');
    setNotice(action === 'approve' ? 'Document approved.' : action === 'request' ? 'Re-upload requested from the forwarder.' : 'Document rejected.');
    setAction(null); setReason('');
  };

  return <div className="documents-screen">
    <PageHeader crumbs={[{ label: 'Operations' }, { label: 'Documents', href: '/documents' }, { label: document.jobId }, { label: labels[document.requirement] }]} title={document.name} description={`Job document for ${document.jobId}.`} actions={<><Button variant="secondary" icon="arrow-left" onClick={() => navigate('/documents')}>Back to Documents</Button><Button variant="outline" icon="download" disabled={document.status === 'Missing'} onClick={download}>Download</Button></>} />
    {notice && <Banner tone="success" onClose={() => setNotice('')}>{notice}</Banner>}
    {document.reviewAuthority !== 'trukkas_admin' && <Banner tone="info">This export document is reviewed by the trucking company. Admin access is view-only.</Banner>}
    <div className="job-document-detail-grid">
      <div className="document-detail-main">
        <SectionCard title="Document preview" action={<Badge tone={documentStatusTone(document.status)}>{document.status}</Badge>}>
          <div className="job-document-preview"><Icon name="file-text" size={38} color="var(--tk-blue)" /><strong>{document.fileName}</strong><span>{document.status === 'Missing' ? 'This required document has not been uploaded yet.' : 'PDF document · Secure preview is available to authorized administrators.'}</span></div>
        </SectionCard>
        <SectionCard title="Review history">
          <div className="document-activity"><span className="node"><Icon name="upload" size={12} /></span><span><strong>{document.status === 'Missing' ? 'Document required' : 'Document uploaded'}</strong><small>{document.status === 'Missing' ? `${document.uploadedBy} needs to upload this requirement.` : `${document.uploadedBy} · ${document.uploadedAt}`}</small></span></div>
          {document.reviewedAt && <div className="document-activity"><span className="node"><Icon name="shield-check" size={12} /></span><span><strong>Review recorded</strong><small>{document.reviewedBy} · {document.reviewedAt}</small></span></div>}
          {(document.rejectionReason || document.reuploadMessage) && <div className="document-review-note"><strong>{document.status === 'Re-upload Requested' ? 'Re-upload request' : 'Review reason'}</strong><p>{document.reuploadMessage || document.rejectionReason}</p></div>}
        </SectionCard>
      </div>
      <div className="document-detail-rail">
        <SectionCard title="Document status">
          <Info label="Status" value={<Badge tone={documentStatusTone(document.status)}>{document.status}</Badge>} />
          <Info label="Review authority" value={document.reviewAuthority === 'trukkas_admin' ? 'Trukkas Admin' : 'Trucking company'} />
          <Info label="Required for" value={job?.requestType || 'Job progression'} />
          {canAdminReview(document) && <div className="document-review-actions"><Button fullWidth onClick={() => setAction('approve')}>Approve document</Button><Button fullWidth variant="secondary" onClick={() => setAction('request')}>Request re-upload</Button><Button fullWidth variant="danger" onClick={() => setAction('reject')}>Reject document</Button></div>}
        </SectionCard>
        <SectionCard title="Document information">
          <Info label="Document type" value={labels[document.requirement]} /><Info label="Job ID" value={document.jobId} /><Info label="Uploaded by" value={document.uploadedBy} /><Info label="Uploader role" value={document.uploadedByRole} /><Info label="Date uploaded" value={document.uploadedAt} /><Info label="File type" value={document.fileType} /><Info label="File size" value={document.fileSize} /><Info label="Version" value={`v${document.version}`} />
          {job && <Button fullWidth variant="secondary" style={{ marginTop: 12 }} onClick={() => navigate(`/jobs/${job.id}`)}>View job details</Button>}
        </SectionCard>
      </div>
    </div>
    <Modal open={!!action} onClose={() => setAction(null)} title={action === 'approve' ? 'Approve document' : action === 'request' ? 'Request re-upload' : 'Reject document'} footer={<><Button variant="outline" onClick={() => setAction(null)}>Cancel</Button><Button variant={action === 'reject' ? 'danger' : 'primary'} disabled={action !== 'approve' && !reason.trim()} onClick={submit}>{action === 'approve' ? 'Approve' : action === 'request' ? 'Send request' : 'Reject'}</Button></>}>
      {action === 'approve' ? <p className="tk-muted">Approve this document for job progression?</p> : <Textarea label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain what needs to be corrected…" />}
    </Modal>
  </div>;
}

function Info({ label, value }) { return <div className="document-info-row"><span>{label}</span><span>{value}</span></div>; }
export default DocumentDetail;
