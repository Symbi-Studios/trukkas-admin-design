import { useMemo, useState } from 'react';
import { Link } from '../router.js';
import {
  PageHeader, StatCard, SectionCard, DataTable, Badge, Button, Card,
  ListRow, QuickActionsCard, Modal, ChoiceCard,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { assignTripsToJob } from '../mock/api.js';
import { getJobTripCounts, getJobTrips } from '../domain/jobTrips.js';

export function DispatchCenter() {
  const jobs = useCollection('jobs') || [];
  const trucks = useCollection('trucks') || [];
  const [assignJob, setAssignJob] = useState(null);
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState('');

  const openJobs = useMemo(() => jobs.filter((job) => {
    const counts = getJobTripCounts(job);
    return ['Open', 'Awaiting Assignment', 'Partially Assigned'].includes(job.status) ||
      (counts.assigned < counts.required && !!job.truckingCompany && !['Pending Approval', 'Bidding', 'Cancelled', 'Rejected'].includes(job.status));
  }), [jobs]);
  const availableTrucks = useMemo(() => trucks.filter((t) => t.status === 'Available'), [trucks]);

  async function handleAssign() {
    if (!assignJob || !picked.length) return;
    try {
      await assignTripsToJob(assignJob.id, picked.map((plate) => {
        const truck = trucks.find((item) => item.plate === plate);
        return { truckPlate: plate, driverId: truck.dr };
      }));
      setAssignJob(null);
      setPicked([]);
      setError('');
    } catch (assignmentError) {
      setError(assignmentError.message);
    }
  }

  function toggleTruck(truck) {
    const required = Math.max(1, Number(assignJob?.requiredTrucks) || 1);
    if (picked.includes(truck.plate)) {
      setPicked((items) => items.filter((plate) => plate !== truck.plate));
      setError('');
      return;
    }
    const selectedCompany = trucks.find((item) => item.plate === picked[0])?.company;
    if ((assignJob?.truckingCompany && truck.company !== assignJob.truckingCompany) || (selectedCompany && truck.company !== selectedCompany)) {
      setError(`All trucks and drivers must come from ${assignJob?.truckingCompany || selectedCompany}.`);
      return;
    }
    if (picked.length >= required) {
      setError(`This job requires ${required} truck${required === 1 ? '' : 's'}.`);
      return;
    }
    setPicked((items) => [...items, truck.plate]);
    setError('');
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
                  <Button size="sm" icon="truck" onClick={() => { setAssignJob(r); setPicked(getJobTrips(r).map((trip) => trip.truckPlate).filter(Boolean)); setError(''); }}>Assign Trucks</Button>) },
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

      <Modal open={!!assignJob} onClose={() => { setAssignJob(null); setPicked([]); setError(''); }}
        title="Assign trucks and drivers" description={assignJob ? `${assignJob.id} requires ${getJobTripCounts(assignJob).required} truck and driver pair${getJobTripCounts(assignJob).required === 1 ? '' : 's'} from one trucking company.` : ''}
        footer={<>
          <Button variant="outline" onClick={() => setAssignJob(null)}>Cancel</Button>
          <Button disabled={!picked.length} onClick={handleAssign}>Assign {picked.length} of {assignJob?.requiredTrucks || 1}</Button>
        </>}>
        <div style={{ display: 'grid', gap: 10 }}>
          {error && <span style={{ color: 'var(--tk-danger)' }} className="tk-meta">{error}</span>}
          {!!assignJob && <span className="tk-meta">Selected: {picked.length} / {assignJob.requiredTrucks || 1}. Partial assignment is allowed; dispatch can add the remaining pairs later.</span>}
          {availableTrucks.length === 0 && <span className="tk-meta">No available trucks right now.</span>}
          {trucks.filter((truck) => (truck.status === 'Available' || picked.includes(truck.plate)) && (!assignJob?.truckingCompany || truck.company === assignJob.truckingCompany)).map((t) => (
            <ChoiceCard key={t.plate} icon="truck" selected={picked.includes(t.plate)}
              title={`${t.plate} — ${t.type}`} description={`${t.driver} · ${t.company}`}
              onSelect={() => toggleTruck(t)} />
          ))}
        </div>
      </Modal>
    </>
  );
}
