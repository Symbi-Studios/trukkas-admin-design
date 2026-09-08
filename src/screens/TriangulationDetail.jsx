'use client';

import { useNavigate, useParams } from '../router.js';
import {
  PageHeader, Button, Badge, SectionCard, LabelValue, Card, Banner, Timeline,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { approveTriangulationMatch, rejectTriangulationMatch } from '../mock/api.js';
import { formatNaira } from '../mock/format.js';

const TRIANGULATION_TONE = { Matched: 'success', Pending: 'warning', Expired: 'danger' };

export function TriangulationDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const matches = useCollection('triangulation') || [];
  const m = matches.find((x) => x.id === matchId);

  if (!m) {
    return (
      <Card>
        <span className="tk-body">No match found with ID {matchId}.</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/triangulation')}>Back to Container Triangulation</Button>
        </div>
      </Card>
    );
  }

  const decided = m.status !== 'Pending';

  return (
    <>
      <PageHeader crumbs={['Operations', 'Container Triangulation', m.id]} title={m.id}
        description={`Container ${m.container} · ${m.containerSize}`}
        actions={<Button variant="outline" icon="arrow-left" onClick={() => navigate('/triangulation')}>Back to Container Triangulation</Button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--tk-grid-gap)' }}>
        <SectionCard title="Origin">
          <LabelValue label="Job" value={m.originJob} />
          <LabelValue label="Detail" value={m.originLabel} />
          <LabelValue label="Date" value={m.originDate} />
        </SectionCard>

        {m.status === 'Pending' ? (
          <SectionCard title="Candidate Match">
            <LabelValue label="Job" value={m.candidateMatchedJob} />
            <LabelValue label="Detail" value={m.candidateLabel} />
            <LabelValue label="Date" value={m.candidateDate} />
            <LabelValue label="Distance Saved" value={`${m.candidateDistanceSavedKm} km`} />
            <LabelValue label="Est. Savings" value={formatNaira(m.candidateEstSavings)} valueTone="var(--tk-success)" />
          </SectionCard>
        ) : m.status === 'Matched' ? (
          <SectionCard title="Matched Job">
            <LabelValue label="Job" value={m.matchedJob} />
            <LabelValue label="Detail" value={m.matchedLabel} />
            <LabelValue label="Date" value={m.matchedDate} />
            <LabelValue label="Distance Saved" value={`${m.distanceSavedKm} km`} />
            <LabelValue label="Est. Savings" value={formatNaira(m.estSavings)} valueTone="var(--tk-success)" />
          </SectionCard>
        ) : (
          <SectionCard title="Outcome">
            <Banner tone="danger" title="No match found">
              This candidate window closed without an admin approving a match.
            </Banner>
          </SectionCard>
        )}

        <SectionCard title="Status">
          <div style={{ display: 'grid', justifyItems: 'center', gap: 8, textAlign: 'center', padding: '8px 0 16px' }}>
            <Badge tone={TRIANGULATION_TONE[m.status]}>{m.status}</Badge>
          </div>
          <Timeline items={m.history.slice().reverse().map((h) => ({ title: h.text, time: h.time, state: 'done' }))} />
        </SectionCard>
      </div>

      {!decided && (
        <Card style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="outline" icon="circle-slash" onClick={() => rejectTriangulationMatch(m.id)}>Reject Match</Button>
          <Button icon="circle-check" size="lg" onClick={() => approveTriangulationMatch(m.id)}>Approve Match</Button>
        </Card>
      )}
    </>
  );
}
