import { useMemo, useState } from 'react';
import { Link } from '../router.js';
import {
  PageHeader, StatCard, SectionCard, DataTable, Badge, Button, Card,
  ListRow, QuickActionsCard, Modal, ChoiceCard,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { assignTruckToJob } from '../mock/api.js';

export function DispatchCenter() {
  const jobs = useCollection('jobs') || [];
  const trucks = useCollection('trucks') || [];
  const [assignJob, setAssignJob] = useState(null);
  const [picked, setPicked] = useState(null);

  const openJobs = useMemo(() => jobs.filter((j) => j.status === 'Open'), [jobs]);
  const availableTrucks = useMemo(() => trucks.filter((t) => t.status === 'Available'), [trucks]);

  async function handleAssign() {
    if (!assignJob || !picked) return;
    await assignTruckToJob(assignJob.id, picked);
    setAssignJob(null);
    setPicked(null);
  }

  return (
    <>
      <PageHeader crumbs={['Operations', 'Dispatch Center']} title="Dispatch Center"
        description="Assign available trucks to open jobs and track dispatch status in real time." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="package-open" label="Open Jobs" value={openJobs.length} caption="awaiting dispatch" />
        <StatCard icon="truck" tint="green" label="Trucks Available" value={availableTrucks.length}
          caption={`${((availableTrucks.length / trucks.length) * 100).toFixed(1)}% of fleet`} />
        <StatCard icon="timer" tint="amber" label="Avg Dispatch Time" value="18 min" delta="3 min" direction="down" caption="vs last week" />
        <StatCard icon="circle-alert" tint="red" label="Unassigned" value={openJobs.length} caption="in the queue" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Open Jobs" count={openJobs.length} pad="none">
          {openJobs.length === 0 ? (
            <div style={{ padding: 20 }}><span className="tk-meta">No jobs waiting on dispatch right now.</span></div>
          ) : (
            <DataTable rows={openJobs} rowKey={(r) => r.id}
              columns={[
                { key: 'id', header: 'Job', render: (r) => (
                  <span style={{ display: 'grid', gap: 2 }}>
                    <Link to={`/jobs/${r.id}`}>{r.id}</Link><span className="tk-meta">{r.cargo}</span>
                  </span>) },
                { key: 'pickup', header: 'Pickup Location', render: (r) => r.pickupLocation || r.origin },
                { key: 'suggested', header: 'Note', render: (r) => r.suggestedTruck || '—' },
                { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
                { key: 'x', header: '', width: 140, render: (r) => (
                  <Button size="sm" icon="truck" onClick={() => setAssignJob(r)}>Assign Truck</Button>) },
              ]} />
          )}
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Nearby Available Trucks" action={<Link to="/fleet">View all</Link>}>
            {availableTrucks.length === 0 && <span className="tk-meta">No trucks available right now.</span>}
            {availableTrucks.slice(0, 4).map((t) => (
              <ListRow key={t.plate} icon="truck" title={t.plate} subtitle={`${t.type} · ${t.company}`}
                value="Available" valueTone="var(--tk-success)" />
            ))}
          </SectionCard>
          <QuickActionsCard items={[
            { icon: 'zap', label: 'Auto-Assign', hint: 'Match nearest available truck to each open job' },
            { icon: 'flag', label: 'Flag for Review', hint: 'Escalate a stuck job to operations' },
          ]} />
        </div>
      </div>

      <Modal open={!!assignJob} onClose={() => { setAssignJob(null); setPicked(null); }}
        title="Assign Truck" description={assignJob ? `Choose an available truck for ${assignJob.id} — ${assignJob.cargo}.` : ''}
        footer={<>
          <Button variant="outline" onClick={() => setAssignJob(null)}>Cancel</Button>
          <Button disabled={!picked} onClick={handleAssign}>Confirm Assignment</Button>
        </>}>
        <div style={{ display: 'grid', gap: 10 }}>
          {availableTrucks.length === 0 && <span className="tk-meta">No available trucks right now.</span>}
          {availableTrucks.map((t) => (
            <ChoiceCard key={t.plate} icon="truck" selected={picked === t.plate}
              title={`${t.plate} — ${t.type}`} description={`${t.driver} · ${t.company}`}
              onSelect={() => setPicked(t.plate)} />
          ))}
        </div>
      </Modal>
    </>
  );
}
