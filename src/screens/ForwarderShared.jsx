"use client";
// Pieces shared by the forwarder list drawer and the forwarder detail page.
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Avatar, Badge, Banner, Button, CopyableId, DataTable, DrawerFacts, DrawerSection, DropdownMenu, EmptyState, FilterSelect, Icon, IconButton, RouteStack, SideDrawer, Skeleton, Timeline } from '../ds.js';
import { forwarderMoney } from '../store/features/forwarders/forwardersApi.js';
import { useGetAdminJobScreenQuery } from '../store/features/jobs/jobDetailApi.js';
import { statusTone } from '../domain/jobStatus';

export const FORWARDER_STATUS_TONE = { Active: 'success', Pending: 'warning', Suspended: 'danger', Banned: 'danger' };
export const VERIFICATION_TONE = { Verified: 'success', Pending: 'warning', Rejected: 'danger' };

const DONE = new Set(['Delivered', 'Completed']);
const FAILED = new Set(['Cancelled', 'Rejected', 'Delayed', 'Attention Required']);

/** Recent jobs as timeline entries: the forwarder's latest activity on the platform. */
export function jobActivityItems(jobs) {
  return jobs.map((job) => ({
    title: `${job.id} · ${job.status}`,
    description: job.origin || job.destination ? `${job.origin || '—'} → ${job.destination || '—'}` : job.route,
    time: job.date,
    state: DONE.has(job.status) ? 'done' : FAILED.has(job.status) ? 'danger' : 'current',
    icon: DONE.has(job.status) ? 'check' : FAILED.has(job.status) ? 'x' : 'truck',
  }));
}

export function ForwarderActivity({ jobs, emptyText = 'Jobs this forwarder posts will appear here.' }) {
  if (!jobs.length) return <EmptyState icon="activity" title="No recent activity" description={emptyText} />;
  return <Timeline items={jobActivityItems(jobs)} />;
}

/** Jobs posted by a forwarder, laid out like the main Jobs table. */
export function ForwarderJobsTable({ rows, onRowClick }) {
  if (!rows.length) return <EmptyState title="No jobs found" description="Jobs for this forwarder will appear here." />;
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.detailId || r.id}
      onRowClick={onRowClick}
      columns={[
        {
          key: 'id', header: 'Job', width: '22%',
          render: (r) => (
            <span className="tk-cell-id">
              <strong>{r.id || '—'}</strong>
              <small>{r.date}</small>
            </span>
          ),
        },
        { key: 'route', header: 'Route', width: '42%', render: (r) => <RouteStack from={r.origin} to={r.destination} /> },
        { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)} dot>{r.status}</Badge> },
        { key: 'amount', header: 'Amount (₦)', align: 'right', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{forwarderMoney(r.amount)}</strong> },
      ]}
    />
  );
}

/** Small "Not submitted" marker for optional fields left empty. */
export function NotSubmitted() {
  return <Badge tone="neutral"><Icon name="circle-dashed" size={11} />Not submitted</Badge>;
}

/** Job status filter for a forwarder's jobs; values are the user-jobs API `tab` param. */
export const JOB_FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function JobStatusFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = JOB_FILTERS.find((f) => f.value === value) || JOB_FILTERS[0];
  return (
    <span style={{ position: 'relative' }}>
      <FilterSelect label={current.label} active={value !== 'all'} onClick={() => setOpen((o) => !o)} onClear={value !== 'all' ? () => onChange('all') : undefined} />
      {open && (
        <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 'var(--tk-z-dropdown)' }}>
          <DropdownMenu width={180} items={JOB_FILTERS.map((f) => ({ label: f.label, icon: f.value === value ? 'check' : undefined, onClick: () => { onChange(f.value); setOpen(false); } }))} />
        </span>
      )}
    </span>
  );
}

/** Side drawer for one of a forwarder's jobs. Shows the row data at once and fills in from the job detail API. */
export function ForwarderJobDrawer({ job, onClose, onOpen }) {
  const owner = useSelector((state) => state.auth.admin?.id);
  const role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.signedIn && state.auth.admin?.id));
  const detailQuery = useGetAdminJobScreenQuery({ id: job.detailId, owner, role }, { skip: !authenticated || !job.detailId, refetchOnMountOrArgChange: true });
  const detail = detailQuery.error ? null : detailQuery.currentData;
  const loading = detailQuery.isFetching && !detail;
  const trips = detail?.trips || [];
  const docs = detail?.documentStatusCounts;
  const known = (value) => value != null && value !== '—' ? value : null;
  return (
    <SideDrawer
      label="Job details"
      eyebrow="Job"
      onClose={onClose}
      title={<CopyableId id={job.id} size="lg" onCopy={(value) => navigator.clipboard?.writeText(value)} />}
      meta={<Badge tone={statusTone(job.status)} dot>{job.status}</Badge>}
      headerActions={job.detailId && <IconButton icon="maximize-2" label="Open full page" onClick={onOpen} />}
      footer={<div className="tk-drawer-footer-row"><Button iconRight="maximize-2" disabled={!job.detailId} onClick={onOpen}>Open Full Page</Button></div>}
    >
      <div className="tk-drawer-card"><RouteStack from={known(detail?.origin) || job.origin} to={known(detail?.destination) || job.destination} wrap /></div>

      {detailQuery.error && <Banner tone="warning" title="Some job details could not be loaded." action={<Button size="sm" variant="outline" onClick={detailQuery.refetch}>Retry</Button>} />}

      <DrawerSection title="Overview">
        <DrawerFacts items={[
          { label: 'Job value', value: forwarderMoney(detail?.jobValue ?? job.amount) },
          { label: 'Created', value: known(detail?.createdAt) || job.date },
          { label: 'Cargo', value: loading ? <Skeleton as="span" width={90} height={14} /> : known(detail?.cargoType) || known(detail?.cargo) || '—' },
          { label: 'Distance', value: loading ? <Skeleton as="span" width={60} height={14} /> : detail?.distanceKm != null ? `${detail.distanceKm} km` : '—' },
        ]} />
      </DrawerSection>

      <DrawerSection title="Assigned to">
        {loading ? <Skeleton height={64} /> : detail?.truckingCompany ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={detail.truckingCompany} size={32} />
              <strong style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{detail.truckingCompany}</strong>
            </span>
            {trips.map((trip) => {
              const driver = trip.driverName && trip.driverName !== '—' ? trip.driverName : null;
              return (
                <div key={trip.id} className="fd-row">
                  {driver ? <Avatar name={driver} size={28} /> : <span className="tk-cell-placeholder"><Icon name="user" size={13} /></span>}
                  <span style={{ flex: 1, display: 'grid', gap: 1, minWidth: 0 }}>
                    <strong style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{driver || 'No driver yet'}</strong>
                    {trip.truckPlate && trip.truckPlate !== '—' && <span className="tk-meta">{trip.truckPlate}</span>}
                  </span>
                  <Badge tone={statusTone(trip.status)}>{trip.status}</Badge>
                </div>
              );
            })}
          </div>
        ) : <div className="tk-drawer-note info"><Icon name="building-2" size={16} /><span>No trucking company has been assigned yet.</span></div>}
      </DrawerSection>

      {docs && docs.total != null && <DrawerSection title="Documents">
        <DrawerFacts items={[
          { label: 'Approved', value: docs.approved ?? '—' },
          { label: 'Pending review', value: docs.pending ?? '—' },
          { label: 'Rejected', value: docs.rejected ?? '—' },
          { label: 'Total', value: docs.total ?? '—' },
        ]} />
      </DrawerSection>}
    </SideDrawer>
  );
}
