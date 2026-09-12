'use client';

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from '../router.js';
import {
  PageHeader, Button, Badge, Tag, Card, SectionCard, EntityHeaderCard, LabelValue,
  DataTable, Tabs, MapPanel, QuickActionsCard, Banner, Modal, Textarea, TextField,
  DropdownMenu, IconButton, Icon, Avatar, Divider, ActivityFeed,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import {
  createTriangulationOpportunityMatch, proposeOpportunityToTruckingCompany,
  proposeOpportunityToForwarder, rejectTriangulationOpportunity,
  addOpportunityTag, addOpportunityNote,
} from '../mock/api.js';
import { formatNaira } from '../mock/format.js';
import './TriangulationDetail.css';

const STATUS_TONE = {
  Suggested: 'info',
  Available: 'success',
  'Awaiting Trucking Company': 'orange',
  'Awaiting Forwarder': 'orange',
  Matched: 'success',
  Rejected: 'danger',
};

const MATCH_LABEL_TONE = { 'High Match': 'success', 'Good Match': 'info', 'Fair Match': 'warning' };

// Same Nigeria silhouette used on the Container Triangulation list map, kept
// screen-local since neither screen imports a shared map module.
const LANDMASS = '6.6% 11.2%,32.8% 3.7%,60.1% 1.9%,82% 7.5%,94% 20.6%,96.2% 46.7%,92.9% 71%,85.2% 87.9%,71% 93.5%,60.1% 89.7%,49.2% 86%,38.3% 80.4%,27.3% 74.8%,16.4% 76.6%,8.7% 71%,6.6% 59.8%,4.4% 37.4%';
const WATER = '0% 60%,6.6% 59.8%,8.7% 71%,16.4% 76.6%,27.3% 74.8%,30% 86%,22% 100%,0% 100%';
const CITY_COORDS = {
  Lagos: { left: 14, top: 69 }, Ibadan: { left: 17, top: 63 }, Abeokuta: { left: 10, top: 51 },
  'Benin City': { left: 35, top: 73 }, 'Port Harcourt': { left: 48, top: 92 }, Onne: { left: 50, top: 90 },
  Enugu: { left: 51, top: 72 }, Abuja: { left: 49, top: 51 }, Kaduna: { left: 52, top: 24 },
  Kano: { left: 65, top: 9 }, Jos: { left: 73, top: 29 }, Maiduguri: { left: 93, top: 18 }, Ilorin: { left: 22, top: 55 },
};

function ScoreRing({ value, size = 46, thickness = 4 }) {
  const r = (size - thickness) / 2, c = 2 * Math.PI * r, len = (value / 100) * c;
  const color = value >= 90 ? 'var(--tk-success)' : value >= 75 ? 'var(--tk-warning)' : 'var(--tk-danger)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tk-viz-track)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={`${len} ${c - len}`} strokeLinecap="round" />
      </g>
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
        style={{ font: `700 ${Math.round(size * 0.26)}px var(--tk-font-sans)`, fill: 'var(--tk-ink-900)' }}>
        {value}%
      </text>
    </svg>
  );
}

function RouteMiniMap({ legs, currentLocation }) {
  const legPoints = legs.map((l) => ({ ...CITY_COORDS[l.city], city: l.city })).filter((p) => p.left != null);
  const curCity = (currentLocation || '').split(',')[0].trim();
  const curPoint = CITY_COORDS[curCity];
  const showCur = curPoint && curCity !== legs[0]?.city;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(${WATER})`, background: '#dbeafe' }} />
      <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(${LANDMASS})`, background: '#eef1e7', border: '1px solid var(--tk-line-strong)' }} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {legPoints.slice(0, -1).map((p, i) => {
          const n = legPoints[i + 1];
          const dashed = i > 0;
          return (
            <polyline key={i} points={`${p.left},${p.top} ${n.left},${n.top}`} fill="none"
              stroke={dashed ? 'var(--tk-orange)' : 'var(--tk-blue)'} strokeWidth="0.4"
              strokeDasharray={dashed ? '1.4 1.2' : undefined} />
          );
        })}
      </svg>
      {legPoints.map((p, i) => (
        <span key={p.city} style={{ position: 'absolute', left: p.left + '%', top: p.top + '%', transform: 'translate(-50%,-50%)', zIndex: 2 }} title={p.city}>
          <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 999,
            background: i === 0 ? 'var(--tk-blue)' : i === legPoints.length - 1 ? 'var(--tk-orange)' : 'var(--tk-teal)',
            border: '2px solid #fff', boxShadow: 'var(--tk-shadow-card)', color: '#fff', font: '700 10px var(--tk-font-sans)' }}>
            {i + 1}
          </span>
          <span style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            font: '600 10px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{p.city}</span>
        </span>
      ))}
      {showCur && (
        <span style={{ position: 'absolute', left: curPoint.left + '%', top: curPoint.top + '%', transform: 'translate(-50%,-50%)', zIndex: 3 }} title={`Current position: ${currentLocation}`}>
          <span style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 999,
            background: 'var(--tk-purple)', border: '2px solid #fff', boxShadow: 'var(--tk-shadow-card)' }}>
            <Icon name="truck" size={12} color="#fff" />
          </span>
        </span>
      )}
    </div>
  );
}

export function TriangulationDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const opportunities = useCollection('triangulationOpportunities') || [];
  const o = opportunities.find((x) => x.id === matchId);

  const [tab, setTab] = useState('related');
  const [moreOpen, setMoreOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [tagOpen, setTagOpen] = useState(false);
  const [tagValue, setTagValue] = useState('');
  const [noteValue, setNoteValue] = useState('');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  function notify(tone, title) { setToast({ tone, title }); }

  if (!o) {
    return (
      <Card>
        <span className="tk-body">No triangulation opportunity found with ID {matchId}.</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/triangulation')}>Back to Opportunities</Button>
        </div>
      </Card>
    );
  }

  const decided = !['Suggested', 'Available'].includes(o.status);
  const related = o.relatedOpportunityIds
    .map((id) => opportunities.find((x) => x.id === id))
    .filter(Boolean);

  async function run(fn, successTone, successMsg) {
    setBusy(true);
    try { await fn(); notify(successTone, successMsg); }
    finally { setBusy(false); }
  }

  const handleCreateMatch = () => run(() => createTriangulationOpportunityMatch(o.id), 'success', `${o.id} matched — trip plan updated for ${o.currentSegment.truck}.`);
  const handleProposeCompany = () => run(() => proposeOpportunityToTruckingCompany(o.id), 'info', `Proposal sent to ${o.currentSegment.truckingCompany}.`);
  const handleProposeForwarder = () => run(() => proposeOpportunityToForwarder(o.id), 'info', `Proposal sent to ${o.proposedSegment.forwarder}.`);
  async function confirmReject() {
    await run(() => rejectTriangulationOpportunity(o.id, rejectReason), 'danger', `${o.id} rejected.`);
    setRejectOpen(false);
    setRejectReason('');
  }
  async function submitTag() {
    if (!tagValue.trim()) return;
    await addOpportunityTag(o.id, tagValue.trim());
    setTagValue('');
    setTagOpen(false);
  }
  async function submitNote() {
    if (!noteValue.trim()) return;
    await addOpportunityNote(o.id, noteValue.trim());
    setNoteValue('');
  }

  return (
    <>
      <PageHeader
        crumbs={['Triangulation', 'Opportunities', o.id]}
        title="Triangulation Opportunity – Review"
        description="Review the details, analyze the match and coordinate the next steps."
        actions={
          <>
            <Button variant="outline" icon="arrow-left" onClick={() => navigate('/triangulation')}>Back to Opportunities</Button>
            <Button variant="outline" icon="share-2" onClick={() => notify('info', 'Opportunity link copied to clipboard.')}>Share Opportunity</Button>
            <Button icon="check-check" disabled={busy || o.status !== 'Suggested'} onClick={handleCreateMatch}>Create Match</Button>
            <span style={{ position: 'relative' }}>
              <IconButton icon="ellipsis-vertical" tone="outline" onClick={() => setMoreOpen((v) => !v)} label="More actions" />
              {moreOpen && (
                <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                  <DropdownMenu
                    width={230}
                    items={[
                      { label: 'Print Opportunity Sheet', icon: 'printer', onClick: () => { setMoreOpen(false); window.print(); } },
                      { label: 'Duplicate Opportunity', icon: 'copy', onClick: () => { setMoreOpen(false); notify('success', 'Opportunity duplicated as a draft.'); } },
                      { divider: true },
                      { label: 'Reject Opportunity', icon: 'ban', tone: 'danger', onClick: () => { setMoreOpen(false); setRejectOpen(true); } },
                    ]}
                  />
                </span>
              )}
            </span>
          </>
        }
      />

      {toast && <Banner tone={toast.tone === 'danger' ? 'danger' : toast.tone} title={toast.title} />}

      <EntityHeaderCard
        name={o.id}
        avatar={
          <span style={{ width: 56, height: 56, borderRadius: 'var(--tk-r-lg)', background: 'var(--tk-blue-soft)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
            <Icon name="truck" size={26} color="var(--tk-blue)" />
          </span>
        }
        badges={<Badge tone={MATCH_LABEL_TONE[o.matchLabel] || 'success'}>{o.matchLabel}</Badge>}
        subtitle={`Identified on ${o.identifiedAt}`}
        facts={[
          { label: 'Match Score', value: <ScoreRing value={o.matchScore} size={40} thickness={4} /> },
          { label: 'Estimated Revenue', value: formatNaira(o.estRevenue) },
          { label: 'Empty KM Avoided', value: `${o.emptyKmAvoided} km` },
          { label: 'Current Status', value: <Badge tone={STATUS_TONE[o.status] || 'neutral'}>{o.status}</Badge> },
        ]}
      />

      <div className="tri-detail-row1">
        <SectionCard title="Current Segment (Active Job)" action={<Badge tone={STATUS_TONE[o.currentSegment.statusLabel] || 'info'}>{o.currentSegment.statusLabel}</Badge>}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ width: 34, height: 34, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-blue-soft)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
              <Icon name="truck" size={16} color="var(--tk-blue)" />
            </span>
            <div>
              <div className="tk-meta">{o.currentSegment.job}</div>
              <div style={{ font: '600 15px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{o.currentSegment.route}</div>
            </div>
          </div>
          <span className="tk-meta">{o.currentSegment.eta}</span>
          <div style={{ marginTop: 6 }}>
            <LabelValue label="Truck" value={o.currentSegment.truck} />
            <LabelValue label="Trucking Company" value={o.currentSegment.truckingCompany} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0' }}>
              <span style={{ font: '400 13px/20px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>Driver</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={o.currentSegment.driver} size={26} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{o.currentSegment.driver}</div>
                  <div className="tk-meta">{o.currentSegment.driverPhone}</div>
                </div>
              </div>
            </div>
            <LabelValue label="Container" value={o.currentSegment.container} />
            <LabelValue label="Cargo" value={o.currentSegment.cargo} />
            <LabelValue label="Current Location" value={o.currentSegment.currentLocation} />
            <LabelValue label="ETA (Destination)" value={o.currentSegment.etaDestination} />
          </div>
        </SectionCard>

        <SectionCard title="Proposed Next Segment (Opportunity)" action={<Badge tone={STATUS_TONE[o.proposedSegment.statusLabel] || 'success'}>{o.proposedSegment.statusLabel}</Badge>}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ width: 34, height: 34, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-orange-soft)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
              <Icon name="package" size={16} color="var(--tk-orange-ink)" />
            </span>
            <div>
              <div className="tk-meta">{o.proposedSegment.job}</div>
              <div style={{ font: '600 15px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{o.proposedSegment.route}</div>
            </div>
          </div>
          <span className="tk-meta">Pickup window: {o.proposedSegment.pickupWindow}</span>
          <div style={{ marginTop: 6 }}>
            <LabelValue label="Forwarder" value={o.proposedSegment.forwarder} />
            <LabelValue label="Cargo" value={o.proposedSegment.cargo} />
            <LabelValue label="Container" value={o.proposedSegment.container} />
            <LabelValue label="Estimated Revenue" value={formatNaira(o.proposedSegment.estRevenue)} valueTone="var(--tk-success)" />
            <LabelValue label="Pickup Location" value={o.proposedSegment.pickupLocation} />
            <LabelValue label="Delivery Location" value={o.proposedSegment.deliveryLocation} />
            <LabelValue label="Distance" value={`${o.proposedSegment.distanceKm} km`} />
            <LabelValue label="Required By" value={o.proposedSegment.requiredBy} />
          </div>
        </SectionCard>

        <SectionCard title="Match Analysis">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
            <ScoreRing value={o.matchScore} size={72} thickness={7} />
            <div>
              <div style={{ font: '600 15px/20px var(--tk-font-sans)', color: 'var(--tk-success)' }}>{o.matchSummary.title}</div>
              <div className="tk-meta">{o.matchSummary.description}</div>
            </div>
          </div>
          <div>
            {o.matchFactors.map((f) => (
              <div className="tri-detail-factor-row" key={f.label}>
                <Icon name="circle-check" size={16} color="var(--tk-success)" />
                <span style={{ flex: 1, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{f.label}</span>
                <strong style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{f.result}</strong>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="tri-detail-actions-rail">
          <SectionCard title="Actions">
            <div style={{ display: 'grid', gap: 10 }}>
              <Button size="lg" icon="check-check" fullWidth disabled={busy || o.status !== 'Suggested'} onClick={handleCreateMatch}>Create Match</Button>
              <Button variant="outline" icon="building-2" fullWidth disabled={busy || decided} onClick={handleProposeCompany}>Propose to Trucking Company</Button>
              <Button variant="outline" icon="warehouse" fullWidth disabled={busy || decided} onClick={handleProposeForwarder}>Propose to Forwarder</Button>
              <Button variant="danger" icon="ban" fullWidth disabled={busy || decided} onClick={() => setRejectOpen(true)}>Reject Opportunity</Button>
            </div>
          </SectionCard>
          <QuickActionsCard
            title="Quick Actions"
            items={[
              { label: 'View Current Job', icon: 'briefcase', onClick: () => navigate(`/jobs/${o.currentSegment.job}`) },
              { label: 'View Proposed Job', icon: 'briefcase', onClick: () => navigate(`/jobs/${o.proposedSegment.job}`) },
              { label: 'View Truck Details', icon: 'truck', onClick: () => navigate(`/fleet/${encodeURIComponent(o.currentSegment.truck)}`) },
              { label: 'View Driver Profile', icon: 'user', onClick: () => navigate(`/drivers/${o.currentSegment.driverId}`) },
              { label: 'View Company Profile', icon: 'building-2', onClick: () => navigate(`/companies/${o.currentSegment.companyId}`) },
              { label: 'View Container Details', icon: 'boxes', onClick: () => notify('info', `${o.currentSegment.container} is managed under Fleet → Maintenance.`) },
              { label: 'View Route on Map', icon: 'map', onClick: () => document.getElementById('tri-route-overview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
            ]}
          />
        </div>
      </div>

      <div className="tri-detail-row2" id="tri-route-overview">
        <MapPanel
          title="Route Overview"
          description="Current segment, proposed segment and the truck's live position."
          height={320}
          onExpand={() => setMapExpanded(true)}
          legend={[
            { label: 'Current Segment', color: 'var(--tk-blue)' },
            { label: 'Proposed Segment', color: 'var(--tk-orange)' },
            { label: 'Pickup Location', color: 'var(--tk-teal)' },
            { label: 'Delivery Location', color: 'var(--tk-orange)' },
          ]}
        >
          <RouteMiniMap legs={o.routeLegs} currentLocation={o.currentSegment.currentLocation} />
        </MapPanel>

        <SectionCard title="Proposed Multi-Leg Route">
          <div className="tri-detail-legs">
            {o.routeLegs.map((leg, i) => (
              <div key={leg.n} style={{ display: 'contents' }}>
                <div className="tri-detail-leg">
                  <span style={{ width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center',
                    background: i === 0 ? 'var(--tk-blue)' : i === o.routeLegs.length - 1 ? 'var(--tk-orange)' : 'var(--tk-purple)' }}>
                    <Icon name={leg.icon} size={14} color="#fff" />
                  </span>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{leg.n}　{leg.city}</div>
                    <div className="tk-meta">{leg.label}</div>
                  </div>
                </div>
                {i < o.routeLegs.length - 1 && (
                  <div className="tri-detail-leg-connector">
                    <span className="tri-detail-leg-connector-line" />
                    <span className="tk-meta">{o.routeLegs[i + 1].distance} · {o.routeLegs[i + 1].duration}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Banner tone="success" icon="trending-up">{o.routeImpact}</Banner>
        </SectionCard>

        <SectionCard title="Financial Breakdown">
          <LabelValue label="Estimated Trip Revenue" value={formatNaira(o.financials.tripRevenue)} />
          <LabelValue label="Estimated Cost (Variable)" value={formatNaira(o.financials.variableCost)} />
          <LabelValue label="Estimated Margin" value={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {formatNaira(o.financials.margin)}
              <Badge tone="success">{o.financials.marginPct}%</Badge>
            </span>
          } />
          <Divider style={{ margin: '6px 0' }} />
          <LabelValue label={`Platform Commission (${o.financials.platformCommissionPct}%)`} value={formatNaira(o.financials.platformCommission)} />
          <LabelValue label="Net to Trucking Company" value={formatNaira(o.financials.netToTruckingCompany)} valueTone="var(--tk-success)" />
        </SectionCard>
      </div>

      <div className="tri-detail-row3">
        <SectionCard pad="none">
          <div style={{ padding: '0 4px' }}>
            <Tabs
              items={[
                { value: 'related', label: 'Related Opportunities', count: related.length },
                { value: 'compliance', label: 'Compliance & Documentation', count: o.compliance.length },
                { value: 'notes', label: 'Notes & Activity', count: o.notes.length },
              ]}
              value={tab}
              onChange={setTab}
            />
          </div>

          {tab === 'related' && (
            <DataTable
              rows={related}
              rowKey={(r) => r.id}
              columns={[
                { key: 'id', header: 'ID', render: (r) => <span style={{ color: 'var(--tk-blue)', fontWeight: 600 }}>{r.id}</span> },
                { key: 'route', header: 'Route', render: (r) => r.proposedSegment.route },
                { key: 'type', header: 'Type', render: (r) => r.tags[0]?.label || '—' },
                { key: 'cargo', header: 'Cargo', render: (r) => r.proposedSegment.cargo },
                { key: 'pickupWindow', header: 'Pickup Window', render: (r) => r.proposedSegment.pickupWindow },
                { key: 'revenue', header: 'Est. Revenue', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{formatNaira(r.estRevenue)}</strong> },
                { key: 'score', header: 'Match Score', align: 'center', render: (r) => <ScoreRing value={r.matchScore} size={38} thickness={3.5} /> },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status] || 'info'}>{r.status}</Badge> },
                { key: 'action', header: 'Action', render: (r) => <Button size="sm" onClick={() => navigate(`/triangulation/${r.id}`)}>Review</Button> },
              ]}
            />
          )}

          {tab === 'compliance' && (
            <DataTable
              rows={o.compliance}
              rowKey={(r) => r.doc}
              columns={[
                { key: 'doc', header: 'Document', render: (r) => (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="shield-check" size={16} color="var(--tk-success)" />
                    {r.doc}
                  </span>
                ) },
                { key: 'status', header: 'Status', render: (r) => <Badge tone="success">{r.status}</Badge> },
                { key: 'expiry', header: 'Expiry', render: (r) => r.expiry },
              ]}
            />
          )}

          {tab === 'notes' && (
            <div style={{ padding: '4px 20px 20px', display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Textarea
                  style={{ flex: 1 }}
                  rows={2}
                  placeholder="Add an internal note about this opportunity..."
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                />
                <Button icon="send" disabled={!noteValue.trim()} onClick={submitNote}>Add Note</Button>
              </div>
              <ActivityFeed items={o.notes.map((n) => ({ text: n.text, actor: n.actor, time: n.time }))} />
            </div>
          )}
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Opportunity Details">
            <LabelValue label="Created" value={o.createdAt} />
            <LabelValue label="Created by" value={o.createdBy} />
            <LabelValue label="Status" value={<Badge tone={STATUS_TONE[o.status] || 'neutral'}>{o.status}</Badge>} />
            <LabelValue label="Priority" value={<Badge tone={o.priority === 'High' ? 'danger' : 'neutral'}>{o.priority}</Badge>} />
            <LabelValue label="Last updated" value={o.lastUpdated} />
          </SectionCard>

          <SectionCard title="Tags">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {o.tags.map((t) => <Tag key={t.label} tone={t.tone}>{t.label}</Tag>)}
              {!tagOpen ? (
                <button type="button" onClick={() => setTagOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 'var(--tk-h-tag)', padding: '0 8px',
                    borderRadius: 'var(--tk-r-xs)', border: '1px dashed var(--tk-line-strong)', background: 'transparent',
                    color: 'var(--tk-ink-400)', font: '500 11px/1 var(--tk-font-sans)', cursor: 'pointer' }}>
                  <Icon name="plus" size={11} /> Add Tag
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 4 }}>
                  <TextField style={{ flex: 1 }} placeholder="Tag name" value={tagValue}
                    onChange={(e) => setTagValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitTag(); if (e.key === 'Escape') setTagOpen(false); }} />
                  <Button size="sm" onClick={submitTag}>Add</Button>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Opportunity" description={`Reject ${o.id}? This cannot be undone.`}
        footer={<>
          <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button variant="danger" icon="ban" onClick={confirmReject}>Reject Opportunity</Button>
        </>}>
        <Textarea label="Reason (optional)" placeholder="Why is this opportunity being rejected?" rows={3}
          value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
      </Modal>

      <Modal open={mapExpanded} onClose={() => setMapExpanded(false)} title="Route Overview" description={`${o.currentSegment.route} → ${o.proposedSegment.route}`} width={820}>
        <div style={{ position: 'relative', height: 480, borderRadius: 'var(--tk-r-lg)', overflow: 'hidden', background: 'var(--tk-surface-sunk)' }}>
          <RouteMiniMap legs={o.routeLegs} currentLocation={o.currentSegment.currentLocation} />
        </div>
      </Modal>
    </>
  );
}
