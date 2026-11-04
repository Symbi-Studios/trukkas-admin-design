'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import {
  PageHeader, Button, Badge, Card, SectionCard, EntityHeaderCard, LabelValue,
  Tabs, MapPanel, Banner, Modal, Textarea, Select, Skeleton,
} from '../ds.js';
import {
  useGetAdminTriangulationOpportunityQuery,
  useGetAdminTriangulationActivityQuery,
  useReviewAdminTriangulationOpportunityMutation,
  useNotifyAdminTriangulationMatchMutation,
  useInterveneAdminTriangulationJobMutation,
} from '../store/features/triangulation/triangulationApi.js';
import { TriangulationGoogleMap } from './TriangulationGoogleMap.jsx';
import './TriangulationDetail.css';

const naira = (value) => Number.isFinite(value) ? `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const text = (value) => value || '—';
function apiError(error) {
  return getApiErrorMessage(error, error?.status === 403 ? 'Your account cannot access this opportunity.' : 'The request could not be completed.');
}

export function TriangulationApiDetail() {
  const params = useSearchParams();
  const navigate = useNavigate();
  const opportunityId = params.get('opportunityId');
  const role = useSelector((state) => state.auth.admin?.role);
  const canReview = ['SUPER_ADMIN', 'OPS_ADMIN'].includes(role);
  const radiusKm = Math.max(1, Number(params.get('radiusKm')) || 150);
  const { currentData: response, isLoading, isFetching, error, refetch } =
    useGetAdminTriangulationOpportunityQuery({ id: opportunityId, radiusKm }, { skip: !opportunityId });
  const opportunity = response?.opportunity;
  const [notifyCompany, { isLoading: notifying }] = useNotifyAdminTriangulationMatchMutation();
  const [intervene, { isLoading: intervening }] = useInterveneAdminTriangulationJobMutation();
  const [review, { isLoading: reviewing }] = useReviewAdminTriangulationOpportunityMutation();
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewReason, setReviewReason] = useState('TRUCK_UNAVAILABLE');
  const [reviewNote, setReviewNote] = useState('');
  const reviewLock = useRef(false);
  const [tab, setTab] = useState('related');
  const activityQuery = useGetAdminTriangulationActivityQuery({ id: opportunityId }, { skip: !opportunityId || tab !== 'notes' });
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [interveneOpen, setInterveneOpen] = useState(false);
  const [targetJob, setTargetJob] = useState('open');
  const [interventionType, setInterventionType] = useState('MESSAGE_FORWARDER');
  const [notes, setNotes] = useState('');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [notice, setNotice] = useState(null);
  const selectedJobId = targetJob === 'finishing' ? opportunity?.currentJobId : opportunity?.jobId;

  const mapPoints = useMemo(() => opportunity ? [
    opportunity.position && { ...opportunity.position, title: 'Finishing job delivery', color: '#2563eb' },
    opportunity.pickupPosition && { ...opportunity.pickupPosition, title: 'Matched job pickup', color: '#f59e0b' },
    opportunity.deliveryPosition && { ...opportunity.deliveryPosition, title: 'Matched job delivery', color: '#10b981' },
  ].filter(Boolean) : [], [opportunity]);

  async function submitNotification() {
    if (!opportunity?.jobId || !opportunity?.truckerId || notifying) return;
    try {
      const result = await notifyCompany({ jobId: opportunity.jobId, truckerId: opportunity.truckerId }).unwrap();
      setNotice({ tone: 'success', message: result?.message || 'The trucking company was notified.' });
      setNotifyOpen(false);
    } catch (requestFailure) {
      setNotice({ tone: 'danger', message: apiError(requestFailure) });
    }
  }

  async function submitReview() {
    if (!canReview || !opportunity?.id || !opportunity.reviewVersion || reviewing || reviewLock.current || !reviewAction || (reviewAction === 'reject' && reviewReason === 'OTHER' && !reviewNote.trim())) return;
    reviewLock.current = true;
    try {
      await review({ id: opportunity.id, action: reviewAction, radiusKm, expectedVersion: opportunity.reviewVersion, reason: reviewReason, note: reviewNote.trim() }).unwrap();
      setNotice({ tone: 'success', message: reviewAction === 'propose' ? 'The trucking company was notified of the opportunity.' : 'Opportunity rejected.' });
      setReviewAction(null);
      setReviewNote('');
    } catch (requestFailure) {
      setNotice({ tone: 'danger', message: apiError(requestFailure) });
    } finally { reviewLock.current = false; }
  }

  async function submitIntervention() {
    if (!selectedJobId || !notes.trim() || intervening) return;
    try {
      const result = await intervene({ jobId: selectedJobId, type: interventionType, notes: notes.trim() }).unwrap();
      setNotice({ tone: 'success', message: result?.message || 'Job intervention applied.' });
      setInterveneOpen(false);
      setNotes('');
    } catch (requestFailure) {
      setNotice({ tone: 'danger', message: apiError(requestFailure) });
    }
  }

  if (!opportunityId) return <Card><p className="tk-body">Open an opportunity from the Triangulation list.</p>
    <Button variant="outline" onClick={() => navigate('/triangulation')}>Back to Opportunities</Button></Card>;
  if (isLoading || (isFetching && !response)) return <div role="status" aria-label="Loading opportunity details">
    <Card><Skeleton height={36} width={260} /></Card><Card><Skeleton height={350} /></Card>
  </div>;
  if (error) return <Card><p className="tk-body">{apiError(error)}</p>
    <Button variant="outline" onClick={refetch}>Retry</Button>
    <Button variant="secondary" onClick={() => navigate('/triangulation')}>Back to Opportunities</Button></Card>;
  if (!opportunity) return <Card><p className="tk-body">This match is no longer on the selected opportunities page.</p>
    <Button variant="outline" onClick={() => navigate('/triangulation')}>Back to Opportunities</Button></Card>;

  return <>
    <PageHeader crumbs={['Triangulation', 'Opportunities', opportunity.jobNumber || opportunity.id]}
      title="Triangulation Opportunity – Review"
      description="Review the match and coordinate the next steps."
      actions={<>
        <Button variant="outline" icon="arrow-left" onClick={() => navigate('/triangulation')}>Back to Opportunities</Button>
      </>} />
    {notice && <Banner tone={notice.tone} onClose={() => setNotice(null)}>{notice.message}</Banner>}
    {isFetching && <Banner tone="info">Refreshing opportunity…</Banner>}

    <EntityHeaderCard name={opportunity.jobNumber || opportunity.id}
      subtitle={`Finishing job ${opportunity.currentJobNumber || opportunity.currentJobId || '—'} · Open job ${opportunity.jobNumber || opportunity.jobId || '—'}`}
      badges={opportunity.status && <Badge tone="info">{opportunity.status}</Badge>}
      facts={[
        { label: 'Match Score', value: opportunity.score == null ? '—' : `${opportunity.score}%` },
        { label: 'Estimated Revenue', value: naira(opportunity.revenue) },
        { label: 'Proximity', value: opportunity.distanceKm == null ? '—' : `${opportunity.distanceKm} km` },
        { label: 'Current Status', value: text(opportunity.status) },
      ]} />

    <div className="tri-detail-row1">
      <SectionCard title="Current Segment (Active Job)">
        <LabelValue label="Job" value={text(opportunity.currentJobNumber || opportunity.currentJobId)} />
        <LabelValue label="Current Route" value={text(opportunity.currentRoute)} />
        <LabelValue label="Truck" value={text(opportunity.truckPlate)} />
        <LabelValue label="Trucking Company" value={text(opportunity.company)} />
        <LabelValue label="Container" value={text(opportunity.currentContainerNumber)} />
        <LabelValue label="Cargo" value={text(opportunity.currentCargo)} />
        <LabelValue label="Current Location" value={text(opportunity.currentLocation)} />
        <LabelValue label="ETA (Destination)" value={text(opportunity.currentEta)} />
      </SectionCard>
      <SectionCard title="Proposed Next Segment (Opportunity)">
        <LabelValue label="Job" value={text(opportunity.jobNumber || opportunity.jobId)} />
        <LabelValue label="Route" value={text(opportunity.proposedRoute)} />
        <LabelValue label="Forwarder" value={text(opportunity.forwarder)} />
        <LabelValue label="Cargo" value={text(opportunity.proposedCargo)} />
        <LabelValue label="Container" value={text(opportunity.containerNumber)} />
        <LabelValue label="Estimated Revenue" value={naira(opportunity.revenue)} valueTone="var(--tk-success)" />
        <LabelValue label="Pickup Window" value={text(opportunity.pickupWindow)} />
        <LabelValue label="Delivery Location" value={text(opportunity.deliveryLocation)} />
      </SectionCard>
      <div className="tri-detail-actions-rail">
        <SectionCard title="Match Analysis">
          <LabelValue label="Match Score" value={opportunity.score == null ? '—' : `${opportunity.score}%`} />
          <LabelValue label="Job Proximity" value={opportunity.distanceKm == null ? '—' : `${opportunity.distanceKm} km`} />
          <p className="tk-meta">Individual match factors are not available.</p>
        </SectionCard>
        <SectionCard title="Actions">
          <div style={{ display: 'grid', gap: 10 }}>
            <Button fullWidth icon="building-2" disabled={!opportunity.jobId || !opportunity.truckerId}
              onClick={() => setNotifyOpen(true)}>Notify Trucking Company</Button>
            <Button fullWidth variant="outline" icon="shield" onClick={() => setInterveneOpen(true)}>Intervene on Job</Button>
            <Button fullWidth variant="outline" disabled={!canReview || !opportunity.reviewVersion || opportunity.status === 'PROPOSED'} onClick={() => { setReviewNote(''); setReviewAction('propose'); }}>Propose to Trucking Company</Button>
            <Button fullWidth variant="danger" disabled={!canReview || !opportunity.reviewVersion || opportunity.status === 'REJECTED'} onClick={() => { setReviewNote(''); setReviewReason('TRUCK_UNAVAILABLE'); setReviewAction('reject'); }}>Reject Opportunity</Button>
          </div>
        </SectionCard>
      </div>
    </div>

    <div className="tri-detail-row2">
      <MapPanel title="Route Overview" description="Finishing job and matched job locations."
        height={320} onExpand={() => setMapExpanded(true)}
        legend={[{ label: 'Finishing delivery', color: '#2563eb' }, { label: 'Open job pickup', color: '#f59e0b' }, { label: 'Open job delivery', color: '#10b981' }]}>
        <TriangulationGoogleMap points={mapPoints} />
      </MapPanel>
      <SectionCard title="Proposed Multi-Leg Route">
        <LabelValue label="Current Segment" value={text(opportunity.currentRoute)} />
        <LabelValue label="Proposed Segment" value={text(opportunity.proposedRoute)} />
        <p className="tk-meta">Stop sequence, route, distance and travel time are not available.</p>
      </SectionCard>
      <SectionCard title="Financial Breakdown">
        <LabelValue label="Estimated Trip Revenue" value={naira(opportunity.revenue)} />
        <LabelValue label="Estimated Cost (Variable)" value="—" />
        <LabelValue label="Estimated Margin" value="—" />
        <LabelValue label="Platform Commission" value={naira(opportunity.platformFee)} />
        <LabelValue label="Net to Trucking Company" value="—" />
      </SectionCard>
    </div>

    <div className="tri-detail-row3">
      <SectionCard pad="none">
        <Tabs items={[
          { value: 'related', label: 'Related Opportunities' },
          { value: 'compliance', label: 'Compliance & Documentation' },
          { value: 'notes', label: 'Notes & Activity' },
        ]} value={tab} onChange={setTab} />
        <div style={{ padding: 24 }} className="tk-meta">
          {tab === 'related' ? 'Related opportunities are not available.'
            : tab === 'compliance' ? 'Compliance and document status are not available.'
              : activityQuery.isFetching ? 'Loading activity…' : activityQuery.error ? apiError(activityQuery.error)
                : activityQuery.currentData?.length ? activityQuery.currentData.map((entry) => <div key={entry.id} style={{ marginBottom: 12 }}>
                    <strong>{entry.title || '—'}</strong><div>{[entry.by, entry.at && !Number.isNaN(Date.parse(entry.at)) ? new Date(entry.at).toLocaleString('en-NG') : null].filter(Boolean).join(' · ') || '—'}</div>
                    {entry.note && <div>{entry.note}</div>}
                  </div>) : 'Notes and activity are not available.'}
        </div>
      </SectionCard>
      <SectionCard title="Opportunity Details">
        <LabelValue label="Finishing Job ID" value={text(opportunity.currentJobId)} />
        <LabelValue label="Open Job ID" value={text(opportunity.jobId)} />
        <LabelValue label="Status" value={text(opportunity.status)} />
        <LabelValue label="Created" value={text(opportunity.identifiedAt)} />
        <Button fullWidth variant="secondary" disabled={!opportunity.jobId}
          onClick={() => navigate(`/jobs/detail?id=${encodeURIComponent(opportunity.jobId)}`)}>View Proposed Job</Button>
      </SectionCard>
    </div>

    <Modal open={Boolean(reviewAction)} onClose={() => { if (!reviewing) setReviewAction(null); }} title={reviewAction === 'propose' ? 'Propose to Trucking Company' : 'Reject Opportunity'}
      description={reviewAction === 'propose' ? 'The company will be notified and can bid through the normal process. This does not assign the job.' : 'Choose why this opportunity should be rejected.'}
      footer={<><Button variant="outline" disabled={reviewing} onClick={() => setReviewAction(null)}>Cancel</Button><Button variant={reviewAction === 'reject' ? 'danger' : 'primary'} disabled={reviewing || !opportunity.reviewVersion || (reviewAction === 'reject' && reviewReason === 'OTHER' && !reviewNote.trim())} onClick={submitReview}>{reviewing ? 'Saving…' : reviewAction === 'propose' ? 'Send proposal' : 'Reject opportunity'}</Button></>}>
      {reviewAction === 'reject' && <Select label="Reason" value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} options={[
        { value: 'TRUCK_UNAVAILABLE', label: 'Truck or driver unavailable' }, { value: 'EQUIPMENT_MISMATCH', label: 'Equipment mismatch' },
        { value: 'TIMING_CONFLICT', label: 'Timing conflict' }, { value: 'ROUTE_NOT_VIABLE', label: 'Route not viable' },
        { value: 'COMPLIANCE_ISSUE', label: 'Compliance issue' }, { value: 'CUSTOMER_PREFERENCE', label: 'Customer preference' },
        { value: 'OTHER', label: 'Other' },
      ]} />}
      <Textarea label={reviewAction === 'reject' && reviewReason === 'OTHER' ? 'Note (required)' : 'Note (optional)'} value={reviewNote} maxLength={500} onChange={(event) => setReviewNote(event.target.value)} rows={3} />
    </Modal>
    <Modal open={notifyOpen} onClose={() => setNotifyOpen(false)} title="Notify Trucking Company"
      description={`Tell ${opportunity.company || 'the trucking company'} about ${opportunity.jobNumber || opportunity.jobId}?`}
      footer={<><Button variant="outline" disabled={notifying} onClick={() => setNotifyOpen(false)}>Cancel</Button>
        <Button disabled={notifying} onClick={submitNotification}>{notifying ? 'Sending…' : 'Send notification'}</Button></>}>
      <p className="tk-meta">The company still bids through the normal job flow. This action does not assign the job.</p>
    </Modal>
    <Modal open={interveneOpen} onClose={() => setInterveneOpen(false)} title="Intervene on Job"
      footer={<><Button variant="outline" disabled={intervening} onClick={() => setInterveneOpen(false)}>Cancel</Button>
        <Button variant={interventionType === 'CANCEL_JOB' ? 'danger' : 'primary'}
          disabled={intervening || !selectedJobId || !notes.trim()} onClick={submitIntervention}>
          {intervening ? 'Submitting…' : interventionType === 'CANCEL_JOB' ? 'Cancel job and hold escrow' : 'Message forwarder'}
        </Button></>}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Select label="Job" value={targetJob} onChange={(event) => setTargetJob(event.target.value)} options={[
          { value: 'finishing', label: `Finishing job · ${opportunity.currentJobNumber || opportunity.currentJobId || '—'}` },
          { value: 'open', label: `Open job · ${opportunity.jobNumber || opportunity.jobId || '—'}` },
        ]} />
        <Select label="Action" value={interventionType} onChange={(event) => setInterventionType(event.target.value)} options={[
          { value: 'MESSAGE_FORWARDER', label: 'Message forwarder' },
          { value: 'CANCEL_JOB', label: 'Cancel job and hold escrow for review' },
        ]} />
        {interventionType === 'CANCEL_JOB' && <Banner tone="danger">This cancels the selected job and holds its escrow for review.</Banner>}
        <Textarea label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3}
          placeholder="Explain the intervention…" />
      </div>
    </Modal>
    <Modal open={mapExpanded} onClose={() => setMapExpanded(false)} title="Route Overview" width={820}>
      <div style={{ position: 'relative', height: 480, borderRadius: 'var(--tk-r-lg)', overflow: 'hidden' }}>
        <TriangulationGoogleMap points={mapPoints} />
      </div>
    </Modal>
  </>;
}
