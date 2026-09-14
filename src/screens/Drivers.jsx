import { useMemo, useState } from 'react';
import { Link } from '../router.js';
import {
  PageHeader, Button, StatCard, SectionCard, TableToolbar, SearchField, FilterSelect,
  DataTable, Pagination, Badge, DonutChart, LegendList, LineChart, QuickActionsCard, Card,
  DropdownMenu, IconButton, Avatar, Icon, Tabs,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { setDriverStatus } from '../mock/api.js';

const STATUSES = ['Active', 'On Trip', 'Inactive', 'Pending Review', 'Rejected'];
const STATUS_TONE = { 'Pending Review': 'warning', Rejected: 'danger' };
const REG_TYPES = ['Individual Driver', 'Company Driver'];
const LICENSE_STATUSES = ['Valid', 'Expiring Soon', 'Expired'];
const EARNINGS_LABELS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
const EARNINGS_SERIES_M = [16.2, 18.4, 19.1, 21.3, 22.8, 24.6];

const naira = (n) => `₦${Math.round(n).toLocaleString('en-NG')}`;

function driverCell(d) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar name={d.name} size={34} />
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <Link to={`/drivers/${d.id}`} style={{ font: '600 13px/18px var(--tk-font-sans)' }}>{d.name}</Link>
        <span className="tk-meta">{d.phone}</span>
      </span>
    </span>
  );
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Drivers() {
  const drivers = useCollection('drivers') || [];
  const [tab, setTab] = useState('All Drivers');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [regType, setRegType] = useState('All Types');
  const [status, setStatus] = useState('All Status');
  const [company, setCompany] = useState('All Companies');
  const [licenseStatus, setLicenseStatus] = useState('All');
  const [openMenu, setOpenMenu] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const companies = useMemo(() => (
    [...new Set(drivers.map((d) => d.company).filter(Boolean))].sort()
  ), [drivers]);

  const counts = useMemo(() => ({
    total: drivers.length,
    individual: drivers.filter((d) => d.registrationType === 'Individual Driver').length,
    company: drivers.filter((d) => d.registrationType === 'Company Driver').length,
    pending: drivers.filter((d) => d.status === 'Pending Review').length,
    active: drivers.filter((d) => d.status === 'Active').length,
    onTrip: drivers.filter((d) => d.status === 'On Trip').length,
    inactive: drivers.filter((d) => d.status === 'Inactive').length,
    rejected: drivers.filter((d) => d.status === 'Rejected').length,
    expiringDocs: drivers.filter((d) => d.licenseStatus === 'Expiring Soon' || d.licenseStatus === 'Expired').length,
    totalEarnings: drivers.reduce((s, d) => s + (d.totalEarnings || 0), 0),
    avgRating: drivers.filter((d) => d.reviews > 0).length
      ? drivers.filter((d) => d.reviews > 0).reduce((s, d) => s + d.rating, 0) / drivers.filter((d) => d.reviews > 0).length
      : 0,
    totalReviews: drivers.reduce((s, d) => s + (d.reviews || 0), 0),
  }), [drivers]);
  counts.approved = counts.active + counts.onTrip + counts.inactive;

  const TAB_FILTER = {
    'All Drivers': () => true,
    'Pending Review': (d) => d.status === 'Pending Review',
    'Active': (d) => d.status === 'Active',
    'On Trip': (d) => d.status === 'On Trip',
    'Inactive': (d) => d.status === 'Inactive',
    'Rejected': (d) => d.status === 'Rejected',
  };

  const filtered = useMemo(() => drivers.filter((d) => {
    const matchesTab = TAB_FILTER[tab](d);
    const matchesQ = !q || [d.name, d.license, d.phone, d.company].some((v) => (v || '').toLowerCase().includes(q.toLowerCase()));
    const matchesReg = regType === 'All Types' || d.registrationType === regType;
    const matchesStatus = status === 'All Status' || d.status === status;
    const matchesCompany = company === 'All Companies' || d.company === company;
    const matchesLicense = licenseStatus === 'All' || d.licenseStatus === licenseStatus;
    return matchesTab && matchesQ && matchesReg && matchesStatus && matchesCompany && matchesLicense;
  }), [drivers, tab, q, regType, status, company, licenseStatus]);

  const topRated = useMemo(() => (
    [...drivers].filter((d) => d.reviews > 0).sort((a, b) => b.rating - a.rating).slice(0, 3)
  ), [drivers]);

  function exportRoster() {
    const header = 'Driver,Registration Type,Company,License No.,Status,License Status,Joined,Earnings,Rating\n';
    const rows = filtered.map((d) => [d.name, d.registrationType, d.company || '—', d.license, d.status,
      d.licenseStatus, d.joined, d.totalEarnings, d.rating].join(',')).join('\n');
    download('drivers-export.csv', header + rows);
  }

  const filterMenu = (open, setOpen, options, value, onChange) => open && (
    <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
      <DropdownMenu width={200} items={options.map((s) => ({
        label: s, icon: s === value ? 'check' : undefined,
        onClick: () => { onChange(s); setOpen(null); },
      }))} />
    </span>
  );

  return (
    <>
      <PageHeader crumbs={['Fleet Management', 'Drivers']} title="Drivers"
        description="Monitor, review and manage all drivers on the Trukkas platform — individual drivers and drivers under trucking companies."
        actions={<>
          <Button icon="user-check" onClick={() => setTab('Pending Review')}>Review Pending Drivers ({counts.pending})</Button>
          <Button variant="outline" icon="download" onClick={exportRoster}>Export</Button>
          <span style={{ position: 'relative' }}>
            <Button variant="outline" iconRight="chevron-down" onClick={() => setMoreOpen((o) => !o)}>More Actions</Button>
            {moreOpen && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={210} items={[
                  { label: 'Add Driver', icon: 'user-plus', onClick: () => setMoreOpen(false) },
                  { label: 'Import Drivers', icon: 'upload', onClick: () => setMoreOpen(false) },
                  { label: 'Driver Compliance Report', icon: 'shield-check', onClick: () => setMoreOpen(false) },
                ]} />
              </span>
            )}
          </span>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="users" label="Total Drivers" value={counts.total} caption="All registered drivers" />
        <StatCard icon="user" tint="green" label="Individual Drivers" value={counts.individual}
          caption={`${((counts.individual / counts.total) * 100).toFixed(1)}% of total`} />
        <StatCard icon="building-2" tint="navy" label="Company Drivers" value={counts.company}
          caption={`${((counts.company / counts.total) * 100).toFixed(1)}% of total`} />
        <StatCard icon="clock" tint="amber" label="Pending Review" value={counts.pending} caption="Awaiting approval" />
        <StatCard icon="circle-check" tint="green" label="Approved / Active" value={counts.approved}
          caption={`${((counts.approved / counts.total) * 100).toFixed(1)}% of total`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="route" label="On Trip" value={counts.onTrip}
          caption={`${((counts.onTrip / counts.total) * 100).toFixed(1)}% of total`} />
        <StatCard icon="circle-minus" tint="navy" label="Inactive" value={counts.inactive}
          caption={`${((counts.inactive / counts.total) * 100).toFixed(1)}% of total`} />
        <StatCard icon="circle-x" tint="red" label="Rejected" value={counts.rejected}
          caption="Registration declined" />
        <StatCard icon="triangle-alert" tint="amber" label="Documents Expiring" value={counts.expiringDocs}
          caption="Within 30 days" />
        <StatCard icon="wallet" tint="green" label="Total Driver Earnings" value={naira(counts.totalEarnings)}
          caption="All time earnings" />
        <StatCard icon="star" tint="amber" label="Average Rating" value={`${counts.avgRating.toFixed(1)} / 5`}
          caption={`Based on ${counts.totalReviews} reviews`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <Card pad="none">
          <TableToolbar
            search={<SearchField placeholder="Search by driver name, license number, phone, or company..."
              value={q} onChange={(e) => setQ(e.target.value)} />}
            filters={<>
              <span style={{ position: 'relative' }}>
                <FilterSelect label={regType} active={regType !== 'All Types'} onClick={() => setOpenMenu(openMenu === 'reg' ? null : 'reg')} />
                {filterMenu(openMenu === 'reg', setOpenMenu, ['All Types', ...REG_TYPES], regType, setRegType)}
              </span>
              <span style={{ position: 'relative' }}>
                <FilterSelect label={status} active={status !== 'All Status'} onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')} />
                {filterMenu(openMenu === 'status', setOpenMenu, ['All Status', ...STATUSES], status, setStatus)}
              </span>
              <span style={{ position: 'relative' }}>
                <FilterSelect label={company} active={company !== 'All Companies'} onClick={() => setOpenMenu(openMenu === 'company' ? null : 'company')} />
                {filterMenu(openMenu === 'company', setOpenMenu, ['All Companies', ...companies], company, setCompany)}
              </span>
              <span style={{ position: 'relative' }}>
                <FilterSelect label={licenseStatus === 'All' ? 'All License Status' : licenseStatus} active={licenseStatus !== 'All'}
                  onClick={() => setOpenMenu(openMenu === 'license' ? null : 'license')} />
                {filterMenu(openMenu === 'license', setOpenMenu, ['All', ...LICENSE_STATUSES], licenseStatus, setLicenseStatus)}
              </span>
            </>} />

          <Tabs style={{ padding: '0 var(--tk-card-pad)' }} value={tab} onChange={(t) => { setTab(t); setPage(1); }}
            items={[
              { value: 'All Drivers', label: 'All Drivers', count: counts.total },
              { value: 'Pending Review', label: 'Pending Review', count: counts.pending },
              { value: 'Active', label: 'Active', count: counts.active },
              { value: 'On Trip', label: 'On Trip', count: counts.onTrip },
              { value: 'Inactive', label: 'Inactive', count: counts.inactive },
              { value: 'Rejected', label: 'Rejected', count: counts.rejected },
            ]} />

          <DataTable rows={filtered} rowKey={(r) => r.id}
            columns={[
              { key: 'name', header: 'Driver', render: driverCell },
              { key: 'registrationType', header: 'Registration Type', render: (r) => <Badge tone={r.registrationType === 'Company Driver' ? 'info' : 'neutral'}>{r.registrationType}</Badge> },
              { key: 'company', header: 'Company', render: (r) => r.company || '—' },
              { key: 'license', header: 'License No.', render: (r) => <span className="tk-mono">{r.license}</span> },
              { key: 'truckPlate', header: 'Assigned Truck', render: (r) => r.truckPlate ? <span className="tk-mono">{r.truckPlate}</span> : <span className="tk-meta">Not Assigned</span> },
              { key: 'status', header: 'Status', render: (r) => <Badge dot tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
              { key: 'licenseStatus', header: 'License Status', render: (r) => <Badge>{r.licenseStatus}</Badge> },
              { key: 'joined', header: 'Joined' },
              { key: 'earnings', header: 'Earnings', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(r.totalEarnings)}</strong> },
              { key: 'rating', header: 'Rating', render: (r) => r.reviews ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="star" size={13} color="var(--tk-warning)" />{r.rating.toFixed(1)}
                </span>) : <span className="tk-meta">—</span> },
              { key: 'actions', header: 'Actions', width: 130, render: (r) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link to={`/drivers/${r.id}`}><Button size="sm" variant="outline">View</Button></Link>
                  <span style={{ position: 'relative' }}>
                    <IconButton icon="ellipsis-vertical" onClick={() => setRowMenu(rowMenu === r.id ? null : r.id)} />
                    {rowMenu === r.id && (
                      <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }}>
                        <DropdownMenu width={190} items={
                          r.status === 'Pending Review'
                            ? [
                              { label: 'Approve Driver', icon: 'circle-check', onClick: () => { setDriverStatus(r.id, 'Active'); setRowMenu(null); } },
                              { label: 'Reject Driver', icon: 'circle-x', tone: 'danger', onClick: () => { setDriverStatus(r.id, 'Rejected'); setRowMenu(null); } },
                            ]
                            : STATUSES.filter((s) => s !== r.status && s !== 'Pending Review').map((s) => ({
                              label: `Mark as ${s}`, icon: 'check',
                              onClick: () => { setDriverStatus(r.id, s); setRowMenu(null); },
                            }))
                        } />
                      </span>
                    )}
                  </span>
                </span>) },
            ]} />
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(filtered.length / 10))}
            total={filtered.length} onPage={setPage} onPageSize={() => {}} />
        </Card>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Driver Status">
            <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
              <DonutChart size={140} thickness={18} centerValue={counts.approved} centerLabel="Total"
                data={[{ label: 'Active', value: counts.active, color: 'var(--tk-success)' },
                       { label: 'On Trip', value: counts.onTrip, color: 'var(--tk-blue)' },
                       { label: 'Inactive', value: counts.inactive, color: 'var(--tk-neutral)' }]} />
              <LegendList style={{ width: '100%' }}
                items={[{ label: 'Active', value: counts.active, color: 'var(--tk-success)' },
                        { label: 'On Trip', value: counts.onTrip, color: 'var(--tk-blue)' },
                        { label: 'Inactive', value: counts.inactive, color: 'var(--tk-neutral)' }]} />
            </div>
          </SectionCard>

          <SectionCard title="Earnings Overview" description="Last 6 months">
            <LineChart area height={140} labels={EARNINGS_LABELS}
              series={[{ name: 'Earnings (₦M)', color: 'var(--tk-success)', points: EARNINGS_SERIES_M }]} />
            <div style={{ marginTop: 6, font: '700 20px/28px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>
              {naira(counts.totalEarnings)}
            </div>
            <span className="tk-meta" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--tk-success)' }}>
              <Icon name="arrow-up" size={12} color="var(--tk-success)" /> 18% vs previous 6 months
            </span>
          </SectionCard>

          <SectionCard title="Top Rated Drivers" action={<a onClick={() => setTab('Active')} style={{ cursor: 'pointer' }}>View all</a>}>
            <div style={{ display: 'grid', gap: 12 }}>
              {topRated.map((d, i) => (
                <Link key={d.id} to={`/drivers/${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="tk-meta" style={{ width: 14 }}>{i + 1}</span>
                  <Avatar name={d.name} size={30} />
                  <span style={{ flex: 1, font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>
                    <Icon name="star" size={13} color="var(--tk-warning)" />{d.rating.toFixed(1)} <span className="tk-meta">({d.reviews})</span>
                  </span>
                </Link>
              ))}
            </div>
          </SectionCard>

          <QuickActionsCard items={[
            { icon: 'user-check', label: 'Review Pending Drivers', hint: 'Verify and approve driver registrations', onClick: () => setTab('Pending Review') },
            { icon: 'shield-check', label: 'Verify Documents', hint: 'Review licenses and other documents' },
            { icon: 'file-chart-column', label: 'Driver Compliance Report', hint: 'View compliance and expiry report' },
            { icon: 'download', label: 'Export Driver List', hint: 'Download driver data report', onClick: exportRoster },
          ]} />
        </div>
      </div>
    </>
  );
}
