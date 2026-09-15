export const DOCUMENT_REQUIREMENTS = {
  Import: [
    { key: 'tdo', label: 'TDO', description: 'Truck Dispatch Order' },
    { key: 'customs_gate_pass', label: 'Customs Gate Pass', description: 'Customs gate pass' },
    { key: 'exit_note', label: 'Exit Note', description: 'Terminal exit note' },
  ],
  Export: [
    { key: 'indemnity_letter', label: 'Indemnity Letter', description: 'Exporter indemnity letter' },
    { key: 'confirmation_letter', label: 'Confirmation Letter', description: 'Export confirmation letter' },
  ],
};

export function jobDocumentType(job) {
  if (job?.requestType?.toLowerCase().startsWith('import')) return 'Import';
  if (job?.requestType?.toLowerCase().startsWith('export')) return 'Export';
  return null;
}

export function requirementsForJob(job) {
  return DOCUMENT_REQUIREMENTS[jobDocumentType(job)] || [];
}

export function canAdminReview(document) {
  return document?.reviewAuthority === 'trukkas_admin'
    && !['Approved', 'Missing'].includes(document.status);
}

export function documentStatusTone(status) {
  if (status === 'Approved') return 'success';
  if (status === 'Rejected') return 'danger';
  if (status === 'Re-upload Requested') return 'warning';
  if (status === 'Missing') return 'neutral';
  if (status === 'Pending Truck Company') return 'info';
  return 'warning';
}

export function summarizeDocuments(documents) {
  return documents.reduce((summary, document) => {
    summary.total += 1;
    if (document.status === 'Approved') summary.approved += 1;
    else if (document.status === 'Rejected') summary.rejected += 1;
    else if (document.status === 'Missing') summary.missing += 1;
    else summary.pending += 1;
    return summary;
  }, { total: 0, approved: 0, pending: 0, rejected: 0, missing: 0 });
}

export function groupDocumentsByJob(jobs, documents) {
  return jobs
    .filter((job) => jobDocumentType(job))
    .map((job) => {
      const jobDocuments = documents.filter((document) => document.jobId === job.id);
      const latest = [...jobDocuments].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
      return {
        id: job.id,
        job,
        jobType: jobDocumentType(job),
        company: job.forwarder || job.exporter || '—',
        documents: jobDocuments,
        summary: summarizeDocuments(jobDocuments),
        updatedAt: latest?.updatedAt || job.updatedAt || job.createdAt || '—',
      };
    });
}
