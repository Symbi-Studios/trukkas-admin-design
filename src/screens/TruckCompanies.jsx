import { useMemo, useState } from 'react';
import { Link } from '../router.js';
import {
  PageHeader, Button, SplitButton, StatCard, SectionCard, TableToolbar, SearchField,
  FilterSelect, DataTable, Pagination, Badge, Card, DropdownMenu, IconButton, Icon,
  Avatar, Modal, TextField,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { companyStats } from '../mock/fixtures/companies.js';
import { setCompanyStatus, setCompanyVerification, addCompany } from '../mock/api.js';

const STATUSES = ['Active', 'Inactive', 'Suspended'];
const VERIFICATIONS = ['Verified', 'Pending', 'Rejected'];
const VERIFICATION_META = {
  Verified: { tone: 'success', icon: 'circle-check' },
  Pending: { tone: 'warning', icon: 'hourglass' },
  Rejected: { tone: 'danger', icon: 'circle-x' },
};
const STATUS_TONE = { Active: 'success', Inactive: 'neutral', Suspended: 'danger' };
const EMPTY_FORM = { name: '', regNo: '', contactName: '', contactPhone: '', contactEmail: '', location: '' };

function PerformanceRing({ value }) {
  if (value == null) return <span className="tk-meta">—</span>;
  const color = value >= 85 ? 'var(--tk-success)' : value >= 60 ? 'var(--tk-warning)' : 'var(--tk-danger)';
  const size = 38, thickness = 4;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const len = (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tk-viz-track)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={`${len} ${c - len}`} strokeLinecap="round" />
      </g>
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
        style={{ font: '700 10px var(--tk-font-sans)', fill: 'var(--tk-ink-900)' }}>{value}%</text>
    </svg>
  );
}

// This table uses tableLayout="fixed" (each column's `width` is authoritative,
// not content-negotiated), so an ellipsis only needs to fill its cell — no per-span
// width floor required the way it would under the default auto layout.
const ellipsis = { display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const wrap = { display: 'block', maxWidth: '100%', overflowWrap: 'break-word' };

function ContactCell({ c }) {
  return (
    <span style={{ display: 'grid', gap: 2, minWidth: 0 }} title={`${c.contactName} · ${c.contactPhone} · ${c.contactEmail}`}>
      <span style={{ ...wrap, font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{c.contactName}</span>
      <span className="tk-meta" style={ellipsis}>{c.contactPhone}</span>
      <span className="tk-meta" style={ellipsis}>{c.contactEmail}</span>
    </span>
  );
}

export function TruckCompanies() {
  const companies = useCollection('companies') || [];
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All Status');
  const [verification, setVerification] = useState('All Verification Status');
  const [location, setLocation] = useState('All Locations');
  const [openFilter, setOpenFilter] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const locations = useMemo(() => [...new Set(companies.map((c) => c.location))], [companies]);

  const filtered = useMemo(() => companies.filter((c) => {
    const matchesQ = !q || [c.name, c.regNo, c.contactEmail, c.contactPhone].some(
      (v) => v.toLowerCase().includes(q.toLowerCase()),
    );
    const matchesStatus = status === 'All Status' || c.status === status;
    const matchesVerification = verification === 'All Verification Status' || c.verification === verification;
    const matchesLocation = location === 'All Locations' || c.location === location;
    return matchesQ && matchesStatus && matchesVerification && matchesLocation;
  }), [companies, q, status, verification, location]);

  const rankedByPerformance = useMemo(
    () => companies.filter((c) => c.performance != null).sort((a, b) => b.performance - a.performance).slice(0, 5),
    [companies],
  );
  const avgPerformance = useMemo(() => {
    const scored = companies.filter((c) => c.performance != null);
    return scored.length ? Math.round(scored.reduce((s, c) => s + c.performance, 0) / scored.length) : 0;
  }, [companies]);

  function resetForm() { setAddOpen(false); setAddMenuOpen(false); setForm(EMPTY_FORM); }

  async function handleSave() {
    setSaving(true);
    await addCompany({
      id: `TC-${Math.floor(Math.random() * 9000000 + 1000000)}`,
      name: form.name, regNo: form.regNo, contactName: form.contactName,
      contactPhone: form.contactPhone, contactEmail: form.contactEmail, location: form.location,
    });
    setSaving(false);
    resetForm();
  }

  return (
    <>
      <PageHeader crumbs={['Fleet', 'Truck Companies']} title="Truck Companies"
        description="Manage and monitor all registered truck companies on the platform."
        actions={<>
          <span style={{ position: 'relative' }}>
            <SplitButton icon="plus" onAction={() => setAddOpen(true)} onToggle={() => setAddMenuOpen((o) => !o)}>
              Add Truck Company
            </SplitButton>
            {addMenuOpen && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={200} items={[
                  { label: 'Add Truck Company', icon: 'plus', onClick: () => { setAddMenuOpen(false); setAddOpen(true); } },
                  { label: 'Import from CSV', icon: 'upload' },
                ]} />
              </span>
            )}
          </span>
          <Button variant="outline" icon="download" iconRight="chevron-down">Export</Button>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="users" label="Total Companies" value={companyStats.totalCompanies} delta={companyStats.totalCompaniesDelta} caption="vs last month" />
        <StatCard icon="truck" tint="green" label="Active Companies" value={companyStats.activeCompanies} delta={companyStats.activeCompaniesDelta} caption="vs last month" />
        <StatCard icon="shield-check" tint="purple" label="Verified Companies" value={companyStats.verifiedCompanies} delta={companyStats.verifiedCompaniesDelta} caption="vs last month" />
        <StatCard icon="truck" tint="navy" label="Total Trucks" value={companyStats.totalTrucks} delta={companyStats.totalTrucksDelta} caption="vs last month" />
        <StatCard icon="truck" tint="amber" label="Active Trucks" value={companyStats.activeTrucks} delta={companyStats.activeTrucksDelta} caption="vs last month" />
        <StatCard icon="user" tint="teal" label="Total Drivers" value={companyStats.totalDrivers} delta={companyStats.totalDriversDelta} caption="vs last month" />
      </div>

      <Card pad="none">
        <TableToolbar
          search={<SearchField placeholder="Search companies by name, email, phone, RC number..."
            value={q} onChange={(e) => setQ(e.target.value)} />}
          filters={<>
            <span style={{ position: 'relative' }}>
              <FilterSelect label={status} active={status !== 'All Status'} onClick={() => setOpenFilter(openFilter === 'status' ? null : 'status')} />
              {openFilter === 'status' && (
                <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
                  <DropdownMenu width={180} items={['All Status', ...STATUSES].map((s) => ({
                    label: s, icon: s === status ? 'check' : undefined,
                    onClick: () => { setStatus(s); setOpenFilter(null); },
                  }))} />
                </span>
              )}
            </span>
            <span style={{ position: 'relative' }}>
              <FilterSelect label={verification} active={verification !== 'All Verification Status'} onClick={() => setOpenFilter(openFilter === 'verification' ? null : 'verification')} />
              {openFilter === 'verification' && (
                <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
                  <DropdownMenu width={200} items={['All Verification Status', ...VERIFICATIONS].map((s) => ({
                    label: s, icon: s === verification ? 'check' : undefined,
                    onClick: () => { setVerification(s); setOpenFilter(null); },
                  }))} />
                </span>
              )}
            </span>
            <span style={{ position: 'relative' }}>
              <FilterSelect label={location} active={location !== 'All Locations'} onClick={() => setOpenFilter(openFilter === 'location' ? null : 'location')} />
              {openFilter === 'location' && (
                <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
                  <DropdownMenu width={220} items={['All Locations', ...locations].map((s) => ({
                    label: s, icon: s === location ? 'check' : undefined,
                    onClick: () => { setLocation(s); setOpenFilter(null); },
                  }))} />
                </span>
              )}
            </span>
            <FilterSelect label="Filters" icon="sliders-horizontal" />
          </>} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard pad="none">
          <DataTable rows={filtered} rowKey={(r) => r.id} tableLayout="fixed"
            columns={[
              { key: 'name', header: 'Company', width: 150, render: (r) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Avatar name={r.name} size={28} square />
                  <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <Link to={`/companies/${r.id}`} style={{ ...wrap, font: '600 13px/16px var(--tk-font-sans)' }}>{r.name}</Link>
                    <span className="tk-meta" style={ellipsis}>{r.regNo}</span>
                  </span>
                </span>) },
              { key: 'contact', header: 'Contact Person', width: 90, render: (r) => <ContactCell c={r} /> },
              { key: 'location', header: 'Location', width: 80, render: (r) => (
                <span style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                  <Icon name="map-pin" size={13} color="var(--tk-ink-300)" style={{ marginTop: 3, flex: '0 0 auto' }} />{r.location}
                </span>) },
              { key: 'trucks', header: 'Trucks', align: 'right', width: 60, render: (r) => (
                <span style={{ font: '600 13px/1 var(--tk-font-sans)', color: 'var(--tk-blue)' }}>{r.trucks}</span>) },
              { key: 'drivers', header: 'Drivers', align: 'right', width: 60 },
              { key: 'status', header: 'Status', width: 82, render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
              { key: 'verification', header: 'Verification', width: 84, render: (r) => (
                <Badge tone={VERIFICATION_META[r.verification].tone}>
                  <Icon name={VERIFICATION_META[r.verification].icon} size={11} />{r.verification}
                </Badge>) },
              { key: 'performance', header: 'Score', width: 70, render: (r) => <PerformanceRing value={r.performance} /> },
              { key: 'joined', header: 'Joined On', width: 80 },
              { key: 'x', header: '', width: 52, render: (r) => (
                <span style={{ position: 'relative' }}>
                  <IconButton icon="ellipsis-vertical" size={24} onClick={() => setMenuFor(menuFor === r.id ? null : r.id)} />
                  {menuFor === r.id && (
                    <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }}>
                      <DropdownMenu width={220} items={[
                        { label: 'View Details', icon: 'eye' },
                        { divider: true },
                        ...STATUSES.filter((s) => s !== r.status).map((s) => ({
                          label: `Mark as ${s}`, icon: 'circle-check',
                          onClick: () => { setCompanyStatus(r.id, s); setMenuFor(null); },
                        })),
                        { divider: true },
                        ...VERIFICATIONS.filter((s) => s !== r.verification).map((s) => ({
                          label: s === 'Verified' ? 'Verify Company' : s === 'Rejected' ? 'Reject Verification' : 'Mark Verification Pending',
                          icon: VERIFICATION_META[s].icon,
                          onClick: () => { setCompanyVerification(r.id, s); setMenuFor(null); },
                        })),
                      ]} />
                    </span>
                  )}
                </span>) },
            ]} />
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(filtered.length / 10))}
            total={filtered.length} onPage={setPage} onPageSize={() => {}} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Company Overview">
            <div style={{ display: 'grid', justifyItems: 'center', gap: 10, textAlign: 'center', paddingBottom: 16 }}>
              <span style={{ width: 56, height: 56, borderRadius: 'var(--tk-r-pill)', display: 'grid', placeItems: 'center',
                             background: 'var(--tk-blue-soft)', color: 'var(--tk-blue)' }}>
                <Icon name="building-2" size={26} />
              </span>
              <span className="tk-meta">
                Truck companies are the backbone of operations. Verify, manage fleet capacity, performance and compliance.
              </span>
            </div>
            <div style={{ display: 'grid', gap: 2, borderTop: '1px solid var(--tk-line)', paddingTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <Icon name="trending-up" size={16} color="var(--tk-ink-400)" />
                <span style={{ flex: 1, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>Average Performance</span>
                <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{avgPerformance}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <Icon name="truck" size={16} color="var(--tk-ink-400)" />
                <span style={{ flex: 1, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>Total Fleet Capacity</span>
                <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{companyStats.totalTrucks.toLocaleString()} Trucks</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <Icon name="users" size={16} color="var(--tk-ink-400)" />
                <span style={{ flex: 1, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>Total Drivers</span>
                <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{companyStats.totalDrivers.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <Icon name="circle-check" size={16} color="var(--tk-ink-400)" />
                <span style={{ flex: 1, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>Active Today</span>
                <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{companyStats.activeTrucks.toLocaleString()} Trucks</span>
              </div>
            </div>
            <Button variant="outline" icon="chart-column" fullWidth style={{ marginTop: 12 }}>View Analytics</Button>
          </SectionCard>

          <SectionCard title="Top Performing Companies">
            <div style={{ display: 'grid' }}>
              {rankedByPerformance.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                                         borderTop: i ? '1px solid var(--tk-line)' : 'none' }}>
                  <span className="tk-meta" style={{ width: 16 }}>{i + 1}.</span>
                  <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{c.name}</span>
                  <span style={{ font: '700 13px/18px var(--tk-font-sans)', color: 'var(--tk-success)' }}>{c.performance}%</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <a href="#">View all rankings</a>
            </div>
          </SectionCard>
        </div>
      </div>

      <Modal open={addOpen} onClose={resetForm} title="Add Truck Company"
        description="Register a new truck company on the platform."
        footer={<>
          <Button variant="outline" onClick={resetForm}>Cancel</Button>
          <Button disabled={saving || !form.name || !form.contactEmail} onClick={handleSave}>Save Company</Button>
        </>}>
        <div style={{ display: 'grid', gap: 14 }}>
          <TextField label="Company Name" required placeholder="e.g. Meridian Freight Ltd"
            value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="Registration No." placeholder="e.g. RC 9012345"
            value={form.regNo} onChange={(e) => setForm((f) => ({ ...f, regNo: e.target.value }))} />
          <TextField label="Contact Name" placeholder="e.g. Ngozi Adeyemi"
            value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <TextField label="Contact Phone" placeholder="0800 000 0000"
              value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} />
            <TextField label="Contact Email" required type="email" placeholder="name@company.com"
              value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} />
          </div>
          <TextField label="Location" placeholder="e.g. Lagos, Lagos State"
            value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
        </div>
      </Modal>
    </>
  );
}
