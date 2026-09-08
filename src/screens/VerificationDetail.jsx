'use client';

import { useState } from 'react';
import { useNavigate, useParams } from '../router.js';
import {
  PageHeader, Button, EntityHeaderCard, Badge, Tabs, SectionCard, LabelValue, DonutChart,
  LegendList, DataTable, Timeline, ActivityFeed, DropdownMenu, Card, Banner,
  IconButton, ProgressBar,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { approveVerification, markNonCompliant, cancelVerification } from '../mock/api.js';

const TIMELINE_STEPS = [
  { title: 'Application Submitted', icon: 'check' },
  { title: 'Document Review', icon: 'check' },
  { title: 'Information Verification', icon: 'check' },
  { title: 'Compliance Assessment', icon: 'check' },
  { title: 'Final Decision', icon: 'check' },
];

function timelineFor(v) {
  const decided = v.status === 'Verified' || v.status === 'Non-Compliant' || v.status === 'Cancelled';
  return TIMELINE_STEPS.map((step, i) => {
    if (i === 0) return { ...step, state: 'done', time: v.submittedOn };
    if (i === 1) return { ...step, state: 'done', time: v.documentReviewOn };
    if (i === 2) return { ...step, state: decided ? 'done' : 'current', time: v.informationVerificationOn, description: decided ? undefined : 'In Progress' };
    if (i === 3) return { ...step, state: decided ? 'done' : 'pending', description: decided ? undefined : 'Pending' };
    const label = v.status === 'Verified' ? 'Approved' : v.status === 'Non-Compliant' ? 'Marked Non-Compliant' : v.status === 'Cancelled' ? 'Cancelled' : 'Pending';
    return { ...step, state: decided ? 'done' : 'pending', description: decided ? label : 'Pending' };
  });
}

const STAGE_PILL = {
  Verified: ['success', 'Verified'],
  'Non-Compliant': ['danger', 'Non-Compliant'],
  Cancelled: ['neutral', 'Cancelled'],
};

export function VerificationDetail() {
  const { verificationId } = useParams();
  const navigate = useNavigate();
  const verifications = useCollection('verifications') || [];
  const v = verifications.find((x) => x.id === verificationId);
  const [tab, setTab] = useState('Verification Overview');
  const [menu, setMenu] = useState(false);

  if (!v) {
    return (
      <Card>
        <span className="tk-body">No verification found with ID {verificationId}.</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/verification')}>Back to Verification</Button>
        </div>
      </Card>
    );
  }

  const decided = v.status === 'Verified' || v.status === 'Non-Compliant' || v.status === 'Cancelled';
  const [stagePillTone, stagePillLabel] = STAGE_PILL[v.status] || ['info', 'In Progress'];
  const requirements = v.requirements || [];
  const completed = v.progress?.completed ?? requirements.filter((r) => r.status === 'Completed').length;
  const inReview = v.progress?.inReview ?? requirements.filter((r) => r.status === 'In Review').length;
  const total = v.progress?.total ?? requirements.length;
  const pending = v.progress?.pending ?? (requirements.length - completed - inReview);
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      <PageHeader crumbs={['Compliance', 'Verification', v.id]} title="Verification"
        description="Review and verify submitted documents and entity information."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/verification')}>Back to Verification</Button>
          <span style={{ position: 'relative' }}>
            <Button variant="secondary" iconRight="ellipsis-vertical" onClick={() => setMenu((m) => !m)}>More Actions</Button>
            {menu && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setMenu(false)}>
                <DropdownMenu width={250} items={[
                  { label: 'Edit Verification Details', icon: 'pencil' },
                  { label: 'Reassign Verification', icon: 'users' },
                  { label: 'Request More Information', icon: 'message-square' },
                  { label: 'Mark as Non-Compliant', icon: 'circle-slash', onClick: () => { markNonCompliant(v.id); setMenu(false); } },
                  { label: 'Approve Verification', icon: 'circle-check', onClick: () => { approveVerification(v.id); setMenu(false); } },
                  { divider: true },
                  { label: 'Add Comment', icon: 'message-square-plus' },
                  { label: 'Add Internal Note', icon: 'notebook-pen' },
                  { divider: true },
                  { label: 'Export Verification Report', icon: 'file-text' },
                  { label: 'Download All Documents', icon: 'download' },
                  { divider: true },
                  { label: 'Cancel Verification', icon: 'trash-2', tone: 'danger', onClick: () => { cancelVerification(v.id); setMenu(false); } },
                ]} />
              </span>
            )}
          </span>
        </>} />

      <EntityHeaderCard name={v.entityName} initials={v.initials}
        badges={<Badge tone="info">{v.entityType}</Badge>}
        facts={[
          { label: 'Registration No.', value: v.regNo },
          { label: 'Entity Type', value: v.entityType },
          { label: 'Country', value: v.country },
          { label: 'Joined Trukkas', value: v.joined },
        ]} />

      <Card pad="none">
        <Tabs value={tab} onChange={setTab} style={{ padding: '0 var(--tk-card-pad)' }}
          items={['Verification Overview', { value: 'Documents', label: 'Documents', count: 6 },
                  'Information', 'Assessment', { value: 'Comments', label: 'Comments', count: 2 }, 'History']} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--tk-grid-gap)' }}>
            <SectionCard title="Verification Overview">
              <LabelValue label="Verification ID" value={v.id} />
              <LabelValue label="Submission Date" value={v.submittedOn} />
              <LabelValue label="Submitted By" value={v.submittedBy} hint={v.contactHint} layout="stack" />
              <LabelValue label="Verification Type" value={v.type} />
              <LabelValue label="Assigned To" value={v.assignedTo} hint={v.assignedRole} layout="stack" />
              <LabelValue label="Due Date" value={v.dueDate} valueTone={v.dueDate !== '—' ? 'var(--tk-danger)' : undefined} />
              <LabelValue label="Priority" value={<Badge tone="warning">{v.priority}</Badge>} />
            </SectionCard>
            <SectionCard title="Verification Progress" footer={<a href="#">View Full Progress →</a>}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <DonutChart size={116} thickness={16} centerValue={`${pct}%`} centerLabel="Complete"
                  data={[{ label: 'Completed', value: completed || 1, color: 'var(--tk-success)' },
                         { label: 'In Review', value: inReview, color: 'var(--tk-warning)' },
                         { label: 'Pending', value: pending, color: 'var(--tk-blue)' }]} />
                <LegendList style={{ flex: 1 }} showShare={false}
                  items={[{ label: 'Completed', value: completed, display: `${completed} / ${total}`, color: 'var(--tk-success)' },
                          { label: 'In Review', value: inReview, display: `${inReview} / ${total}`, color: 'var(--tk-warning)' },
                          { label: 'Pending', value: pending, display: `${pending} / ${total}`, color: 'var(--tk-blue)' }]} />
              </div>
            </SectionCard>
            <SectionCard title="Overall Assessment">
              <div style={{ display: 'grid', justifyItems: 'center', gap: 8, textAlign: 'center' }}>
                <span style={{ font: '600 18px/24px var(--tk-font-sans)',
                               color: v.status === 'Non-Compliant' ? 'var(--tk-danger)' : 'var(--tk-success)' }}>
                  {v.assessment}
                </span>
                <span className="tk-meta">
                  {decided ? 'This verification has been decided.' : 'Most requirements have been met. Complete remaining reviews to finalize.'}
                </span>
              </div>
              <Banner tone={v.riskLevel === 'High' ? 'danger' : 'success'} title={`Risk Level: ${v.riskLevel}`} style={{ marginTop: 12 }}>
                {v.riskLevel === 'High' ? 'Compliance issues were identified.' : 'No major compliance issues identified.'}
              </Banner>
            </SectionCard>
          </div>

          <SectionCard title="Requirements Checklist" pad="none" style={{ marginTop: 16 }}
            footer={<a href="#">View All Requirements</a>}>
            <DataTable rows={requirements} rowKey={(r) => r.name}
              columns={[
                { key: 'name', header: 'Requirement', render: (r) => (
                  <span style={{ display: 'grid', gap: 2 }}>
                    <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.name}</span>
                    <span className="tk-meta">{r.sub}</span>
                  </span>) },
                { key: 'cat', header: 'Category' },
                { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
                { key: 'by', header: 'Reviewer' },
                { key: 'on', header: 'Reviewed On' },
                { key: 'note', header: 'Notes' },
                { key: 'x', header: 'Actions', width: 80, render: () => (
                  <span style={{ display: 'flex', gap: 4 }}>
                    <IconButton icon="eye" tone="outline" /><IconButton icon="ellipsis-vertical" />
                  </span>) },
              ]} />
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Verification Status" icon="shield-check" action={<Badge tone={stagePillTone}>{stagePillLabel}</Badge>}>
            <Timeline items={timelineFor(v)} />
          </SectionCard>
          <SectionCard title="Risk Indicators" icon="triangle-alert">
            <ProgressBar value={12} label="Sanctions Check" caption="Clear" color="var(--tk-success)" />
            <ProgressBar style={{ marginTop: 12 }} value={8} label="PEP Screening" caption="Clear" color="var(--tk-success)" />
            <ProgressBar style={{ marginTop: 12 }} value={20} label="Adverse Media" caption="Clear" color="var(--tk-success)" />
            <ProgressBar style={{ marginTop: 12 }} value={34} label="Credit History" caption="Reviewed" color="var(--tk-blue)" />
          </SectionCard>
          <SectionCard title="Activity Log" action={<a href="#">View All</a>}>
            <ActivityFeed items={v.activity || []} />
          </SectionCard>
        </div>
      </div>

      <Card style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="danger" icon="trash-2" style={{ marginRight: 'auto' }} disabled={decided}
          onClick={() => cancelVerification(v.id)}>Cancel Verification</Button>
        <Button variant="outline" icon="message-square" disabled={decided}>Request More Information</Button>
        <Button variant="outline" icon="circle-slash" disabled={decided}
          onClick={() => markNonCompliant(v.id)}>Mark as Non-Compliant</Button>
        <Button icon="shield-check" size="lg" disabled={decided}
          onClick={() => approveVerification(v.id)}>Approve Verification</Button>
      </Card>
    </>
  );
}
