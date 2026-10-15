'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from '../router.js';
import {
  PageHeader, Button, EntityHeaderCard, Badge, Tabs, SectionCard, LabelValue, DonutChart,
  LegendList, DataTable, Timeline, ActivityFeed, DropdownMenu, Card, Banner,
  IconButton, ProgressBar, EmptyState,
} from '../ds.js';
import { useGetAdminVerificationDetailQuery, useApproveAdminVerificationEntityMutation, canReviewVerification, verificationDocumentUrl, useGetAdminVerificationHistoryQuery, verificationTimeline, verificationActivity, useGetAdminVerificationEntriesQuery, verificationEntryActivity } from '../store/features/verification/verificationApi.js';
import { VerificationActionDialog } from './VerificationActionDialog.jsx';
import { useVerificationOperations } from '../store/features/verification/useVerificationOperations.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { DriverDetailLoading } from './DriversLoading.jsx';

const STAGE_PILL = {
  Verified: ['success', 'Verified'],
  Rejected: ['danger', 'Rejected'],
  'Non-Compliant': ['danger', 'Non-Compliant'],
  Cancelled: ['neutral', 'Cancelled'],
};

export function VerificationDetail() {
  const { verificationId } = useParams();
  const search = useSearchParams();
  const scope = useSelector(state => [state.auth.admin?.id, state.auth.admin?.role, Boolean(state.auth.accessToken)].join(':'));
  return <VerificationDetailScreen key={[scope, search.get('id') || verificationId, search.get('source')].join(':')} />;
}

function VerificationDetailScreen() {
  const { verificationId } = useParams();
  const search = useSearchParams();
  const id = search.get('id') || verificationId;
  const source = search.get('source');
  const navigate = useNavigate();
  const operations = useVerificationOperations();
  const args = { source, id, owner: operations.owner, role: operations.role };
  const query = useGetAdminVerificationDetailQuery(args, { skip: !id || !operations.authenticated, refetchOnMountOrArgChange: true });
  const history = useGetAdminVerificationHistoryQuery({ id: query.currentData?.id, owner: operations.owner, role: operations.role }, { skip: !operations.authenticated || !query.currentData?.id || Boolean(query.error), refetchOnMountOrArgChange: true });
  const events = history.error ? null : history.currentData;
  const entryArgs = { id: query.currentData?.id, owner: operations.owner, role: operations.role };
  const entryOptions = { skip: !operations.authenticated || !query.currentData?.id || Boolean(query.error), refetchOnMountOrArgChange: true };
  const comments = useGetAdminVerificationEntriesQuery({ ...entryArgs, kind: 'comments' }, entryOptions);
  const notes = useGetAdminVerificationEntriesQuery({ ...entryArgs, kind: 'notes' }, entryOptions);
  const commentEntries = comments.error ? null : comments.currentData;
  const noteEntries = notes.error ? null : notes.currentData;
  const historyActivity = verificationActivity(events);
  const [dialog, setDialog] = useState(null);
  function openDialog(action) {
    setMenu(false);
    if (!operations.canManage || action === 'noncompliant' && !canReviewVerification(role, v?.source)) { window.alert('Your account cannot perform this verification action.'); return; }
    setDialog(action);
  }
  const v = !operations.authenticated || query.error ? null : query.currentData;
  const [approve, approval] = useApproveAdminVerificationEntityMutation();
  const role = useSelector((state) => state.auth.admin?.role);
  const submitting = useRef(false), active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [tab, setTab] = useState('Verification Overview');
  const [menu, setMenu] = useState(false);
  const activity = tab === 'Comments' ? verificationEntryActivity(commentEntries) : tab === 'History' ? historyActivity : [...historyActivity, ...verificationEntryActivity(noteEntries)];
  const unavailable = (action) => { setMenu(false); window.alert(`${action} is not available in the documented verification API.`); };
  useEffect(() => { setTab('Verification Overview'); setMenu(false); setDialog(null); }, [id, source, operations.owner]);

  async function approveVerification() {
    setMenu(false);
    if (submitting.current || approval.isLoading) return;
    if (!v?.canApprove || !canReviewVerification(role, v?.source)) { window.alert('This verification cannot be approved by your account in its current state.'); return; }
    submitting.current = true;
    try { const result = await approve({ id: v.id, owner: operations.owner, role: operations.role }).unwrap(); if (active.current) window.alert(result.message); }
    catch (error) { if (active.current) window.alert(getApiErrorMessage(error)); }
    finally { submitting.current = false; }
  }

  if (query.isLoading || (query.isFetching && !query.currentData)) return <DriverDetailLoading />;

  if (!v) {
    return (
      <Card>
        <span className="tk-body">{query.error ? getApiErrorMessage(query.error) : `No verification found with ID ${id || '—'}.`}</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/verification')}>Back to Verification</Button>
          {query.error && <Button variant="outline" onClick={query.refetch}>Retry</Button>}
        </div>
      </Card>
    );
  }

  const decided = ['Verified', 'Rejected', 'Non-Compliant', 'Cancelled'].includes(v.status);
  const [stagePillTone, stagePillLabel] = STAGE_PILL[v.status] || (v.status === 'In Review' ? ['info', 'In Progress'] : v.status === 'Pending' ? ['warning', 'Pending'] : ['neutral', '—']);
  const requirements = v.requirements || [];
  const completed = v.progress?.completed ?? null;
  const inReview = v.progress?.inReview ?? null;
  const total = v.progress?.total ?? null;
  const pending = v.progress?.pending ?? null;
  const pct = total != null && completed != null ? (total ? Math.round((completed / total) * 100) : 0) : null;
  function viewDocument(requirement) {
    const url = verificationDocumentUrl(requirement.url);
    if (!url) { unavailable('View Requirement Document'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

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
                  { label: 'Edit Verification Details', icon: 'pencil', onClick: () => openDialog('edit') },
                  { label: 'Reassign Verification', icon: 'users', onClick: () => openDialog('reassign') },
                  { label: 'Request More Information', icon: 'message-square', onClick: () => openDialog('information') },
                  { label: 'Mark as Non-Compliant', icon: 'circle-slash', onClick: () => openDialog('noncompliant') },
                  { label: 'Approve Verification', icon: 'circle-check', onClick: approveVerification },
                  { divider: true },
                  { label: 'Add Comment', icon: 'message-square-plus', onClick: () => openDialog('comment') },
                  { label: 'Add Internal Note', icon: 'notebook-pen', onClick: () => openDialog('note') },
                  { divider: true },
                  { label: 'Export Verification Report', icon: 'file-text', onClick: () => operations.download(v.id, 'report') },
                  { label: 'Download All Documents', icon: 'download', onClick: () => operations.download(v.id, 'documents') },
                  { divider: true },
                  { label: 'Cancel Verification', icon: 'trash-2', tone: 'danger', onClick: () => openDialog('cancel') },
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
          items={['Verification Overview', { value: 'Documents', label: 'Documents', count: v.documentCount ?? '—' },
                  'Information', 'Assessment', { value: 'Comments', label: 'Comments', count: commentEntries ? commentEntries.length : v.commentCount ?? '—' }, 'History']} />
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
            <SectionCard title="Verification Progress" footer={<a href="#" onClick={(event) => { event.preventDefault(); setTab('History'); }}>View Full Progress →</a>}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <DonutChart size={116} thickness={16} centerValue={pct == null ? '—' : `${pct}%`} centerLabel="Complete"
                  data={v.progress ? [{ label: 'Completed', value: completed, color: 'var(--tk-success)' },
                         { label: 'In Review', value: inReview, color: 'var(--tk-warning)' },
                         { label: 'Pending', value: pending, color: 'var(--tk-blue)' }] : []} />
                <LegendList style={{ flex: 1 }} showShare={false}
                  items={[{ label: 'Completed', value: completed, display: completed == null || total == null ? '—' : `${completed} / ${total}`, color: 'var(--tk-success)' },
                          { label: 'In Review', value: inReview, display: inReview == null || total == null ? '—' : `${inReview} / ${total}`, color: 'var(--tk-warning)' },
                          { label: 'Pending', value: pending, display: pending == null || total == null ? '—' : `${pending} / ${total}`, color: 'var(--tk-blue)' }]} />
              </div>
            </SectionCard>
            <SectionCard title="Overall Assessment">
              <div style={{ display: 'grid', justifyItems: 'center', gap: 8, textAlign: 'center' }}>
                <span style={{ font: '600 18px/24px var(--tk-font-sans)',
                               color: v.status === 'Non-Compliant' ? 'var(--tk-danger)' : 'var(--tk-success)' }}>
                  {v.assessment}
                </span>
                <span className="tk-meta">
                  {['Verified', 'Rejected'].includes(v.status) ? 'This verification has been decided.' : v.assessmentDescription}
                </span>
              </div>
              <Banner tone={v.riskLevel === 'High' ? 'danger' : 'success'} title={`Risk Level: ${v.riskLevel}`} style={{ marginTop: 12 }}>
                {v.riskDescription}
              </Banner>
            </SectionCard>
          </div>

          <SectionCard title="Requirements Checklist" pad="none" style={{ marginTop: 16 }}
            footer={<a href="#" onClick={(event) => { event.preventDefault(); setTab('Documents'); }}>View All Requirements</a>}>
            <DataTable rows={requirements} rowKey={(r) => r.key}
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
                { key: 'x', header: 'Actions', width: 80, render: (r) => (
                  <span style={{ display: 'flex', gap: 4 }}>
                    <IconButton icon="eye" tone="outline" onClick={() => viewDocument(r)} /><IconButton icon="ellipsis-vertical" onClick={() => unavailable('Requirement Actions')} />
                  </span>) },
              ]} />
            {!requirements.length && <EmptyState title="—" />}
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Verification Status" icon="shield-check" action={<Badge tone={stagePillTone}>{stagePillLabel}</Badge>}>
            <Timeline items={verificationTimeline(v, events)} />
          </SectionCard>
          <SectionCard title="Risk Indicators" icon="triangle-alert">
            <ProgressBar value={null} label="Sanctions Check" caption="—" color="var(--tk-success)" />
            <ProgressBar style={{ marginTop: 12 }} value={null} label="PEP Screening" caption="—" color="var(--tk-success)" />
            <ProgressBar style={{ marginTop: 12 }} value={null} label="Adverse Media" caption="—" color="var(--tk-success)" />
            <ProgressBar style={{ marginTop: 12 }} value={null} label="Credit History" caption="—" color="var(--tk-blue)" />
          </SectionCard>
          <SectionCard title="Activity Log" action={<a href="#" onClick={(event) => { event.preventDefault(); setTab('History'); }}>View All</a>}>
            <ActivityFeed items={activity} />
            {!activity.length && <span className="tk-meta">—</span>}
          </SectionCard>
        </div>
      </div>

      <Card style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="danger" icon="trash-2" style={{ marginRight: 'auto' }} disabled={decided}
          onClick={() => openDialog('cancel')}>Cancel Verification</Button>
        <Button variant="outline" icon="message-square" disabled={decided} onClick={() => openDialog('information')}>Request More Information</Button>
        <Button variant="outline" icon="circle-slash" disabled={decided}
          onClick={() => openDialog('noncompliant')}>Mark as Non-Compliant</Button>
        <Button icon="shield-check" size="lg" disabled={!v.canApprove || approval.isLoading || !canReviewVerification(role, v?.source)}
          onClick={approveVerification}>Approve Verification</Button>
      </Card>
      {dialog && <VerificationActionDialog key={operations.owner + v.id + dialog} action={dialog} model={v} canManage={operations.canManage} onClose={() => setDialog(null)} />}
    </>
  );
}
