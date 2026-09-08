'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  PageHeader, FilterSelect, DropdownMenu, StatCard, SectionCard, Tabs, DataTable, Badge, Tag,
  Button, SearchField, Pagination, IconButton, Modal, TextField, Select, Banner, ListRow,
  AlertRow, LabelValue, Icon,
} from '../ds.js';
import './Documents.css';
import { useCollection } from '../mock/useCollection.js';
import { createDocument, updateDocument, deleteDocument, bulkUpdateDocuments, bulkDeleteDocuments } from '../mock/api.js';

const TYPES = ['TDO', 'Exit Note', 'Indemnity Letter', 'Custom', 'Exporter', 'Other'];
const TYPE_LABEL = { TDO: 'TDO', 'Exit Note': 'Exit Note', 'Indemnity Letter': 'Indemnity Letter', Custom: 'Custom Documents', Exporter: 'Exporter Documents', Other: 'Other Documents' };
const TYPE_TONE = { TDO: 'blue', 'Exit Note': 'orange', 'Indemnity Letter': 'purple', Custom: 'teal', Exporter: 'success', Other: 'neutral' };
const LIST_TINT = { blue: 'blue', orange: 'amber', purple: 'purple', teal: 'green', success: 'green', neutral: 'neutral' };
const TAB_ITEMS = ['All Documents', 'TDO', 'Exit Note', 'Indemnity Letter', 'Custom Documents', 'Exporter Documents', 'Other Documents'];
const TAB_TYPE = { 'All Documents': null, TDO: 'TDO', 'Exit Note': 'Exit Note', 'Indemnity Letter': 'Indemnity Letter', 'Custom Documents': 'Custom', 'Exporter Documents': 'Exporter', 'Other Documents': 'Other' };
const STATUS_TONE = { Verified: 'success', Pending: 'warning', Rejected: 'danger' };
const STATUSES = ['Verified', 'Pending', 'Rejected'];
const DATE_RANGES = ['May 24 – May 30, 2026', 'May 17 – May 23, 2026', 'Last 7 Days', 'Last 30 Days'];
const PAGE_SIZE = 10;
const EMPTY_FORM = { name: '', type: 'TDO', job: '', trip: '', createdBy: '' };

const INITIAL_DOCS = [
  { id: 'd1', name: 'TDO (Truck Dispatch Order)', desc: 'Dispatch order for truck movement', type: 'TDO', route: 'Apapa Port → Ikeja Warehouse', job: 'JOB-29821', trip: 'TRIP-98231', createdBy: 'John Adewale', dept: 'Operations', status: 'Verified', date: 'May 30, 2026', time: '09:42 AM' },
  { id: 'd2', name: 'Exit Note', desc: 'Gate exit clearance note', type: 'Exit Note', route: 'Lagos Port → Multiple Sites (20)', job: 'JOB-29814', trip: 'TRIP-98214', createdBy: 'S. Musa', dept: 'Documentation', status: 'Pending', date: 'May 30, 2026', time: '08:15 AM' },
  { id: 'd3', name: 'Custom Clearance Document', desc: 'Customs clearance certificate', type: 'Custom', route: 'Tin Can Port → Victoria Island', job: 'JOB-29820', trip: 'TRIP-98230', createdBy: 'Victoria Udo', dept: 'Finance Team', status: 'Verified', date: 'May 29, 2026', time: '06:30 PM' },
  { id: 'd4', name: 'Indemnity Letter', desc: 'Indemnity letter for cargo release', type: 'Indemnity Letter', route: 'Apapa Port → Onne Port', job: 'JOB-29819', trip: 'TRIP-98219', createdBy: 'A. Ibrahim', dept: 'Documentation', status: 'Verified', date: 'May 29, 2026', time: '04:26 PM' },
  { id: 'd5', name: 'Exporter Document', desc: 'Exporter registration & details', type: 'Exporter', route: 'Port Harcourt → Aba Depot', job: 'JOB-29818', trip: 'TRIP-98218', createdBy: 'T. James', dept: 'Customer Service', status: 'Verified', date: 'May 29, 2026', time: '03:50 PM' },
  { id: 'd6', name: 'Bill of Lading', desc: 'Copy of bill of lading', type: 'Other', route: 'Lekki Warehouse → Apapa Port', job: 'JOB-29822', trip: 'TRIP-98222', createdBy: 'John Adewale', dept: 'Operations', status: 'Rejected', date: 'May 29, 2026', time: '01:15 PM' },
  { id: 'd7', name: 'Invoice', desc: 'Commercial invoice', type: 'Other', route: 'Tin Can Island → Lagos Island', job: 'JOB-29816', trip: 'TRIP-98216', createdBy: 'S. Musa', dept: 'Finance Team', status: 'Pending', date: 'May 29, 2026', time: '11:32 AM' },
  { id: 'd8', name: 'Packing List', desc: 'Cargo packing list', type: 'Other', route: 'Apapa Port → Lekki Warehouse', job: 'JOB-29817', trip: 'TRIP-98217', createdBy: 'Victoria Udo', dept: 'Documentation', status: 'Verified', date: 'May 28, 2026', time: '05:20 PM' },
  { id: 'd9', name: 'Insurance Certificate', desc: 'Cargo insurance certificate', type: 'Other', route: 'PH Port → Aba Enugu Road', job: 'JOB-29812', trip: 'TRIP-98212', createdBy: 'A. Ibrahim', dept: 'Documentation', status: 'Verified', date: 'May 28, 2026', time: '03:18 PM' },
  { id: 'd10', name: 'Payment Receipt', desc: 'Payment receipt copy', type: 'Other', route: 'Apapa Port → Ikeja Warehouse', job: 'JOB-29811', trip: 'TRIP-98211', createdBy: 'T. James', dept: 'Finance Team', status: 'Verified', date: 'May 28, 2026', time: '12:05 PM' },
];
const CATEGORIES = [
  { type: 'TDO', label: 'TDO (Truck Dispatch Order)', count: '876' },
  { type: 'Exit Note', label: 'Exit Note', count: '542' },
  { type: 'Indemnity Letter', label: 'Indemnity Letter', count: '318' },
  { type: 'Custom', label: 'Custom Documents', count: '1,124' },
  { type: 'Exporter', label: 'Exporter Documents', count: '652' },
  { type: 'Other', label: 'Other Documents', count: '1,350' },
];
const RECENT = [
  { name: 'TDO (Truck Dispatch Order)', type: 'TDO', job: 'JOB-29821', trip: 'TRIP-98231', status: 'Verified', ago: 'Just now' },
  { name: 'Exit Note', type: 'Exit Note', job: 'JOB-29820', trip: 'TRIP-98230', status: 'Pending', ago: '8m ago' },
  { name: 'Indemnity Letter', type: 'Indemnity Letter', job: 'JOB-29819', trip: 'TRIP-98219', status: 'Verified', ago: '15m ago' },
  { name: 'Custom Clearance Document', type: 'Custom', job: 'JOB-29818', trip: 'TRIP-98218', status: 'Verified', ago: '25m ago' },
  { name: 'Exporter Document', type: 'Exporter', job: 'JOB-29817', trip: 'TRIP-98217', status: 'Verified', ago: '40m ago' },
];
const ALERTS = [
  { icon: 'triangle-alert', tone: 'amber', title: '78 documents will expire within 30 days', desc: 'Review and update to avoid disruption', time: 'Just now' },
  { icon: 'triangle-alert', tone: 'amber', title: '12 documents pending verification', desc: 'Action required', time: '15m ago' },
  { icon: 'circle-alert', tone: 'red', title: '3 documents were rejected', desc: 'Click to review and re-upload', time: '1h ago' },
];

export function Documents() {
  const navigate = useNavigate();
  const docs = useCollection('documents') || [];
  const [tab, setTab] = useState('All Documents');
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [jobFilter, setJobFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [userFilter, setUserFilter] = useState('All Users');
  const [openFilter, setOpenFilter] = useState(null);
  const [dateRange, setDateRange] = useState(DATE_RANGES[0]);
  const [dense, setDense] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState([]);
  const [menuFor, setMenuFor] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState(null);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { setPage(1); }, [tab, q, typeFilter, jobFilter, statusFilter, userFilter]);

  const jobs = useMemo(() => [...new Set(docs.map((d) => d.job))], [docs]);
  const users = useMemo(() => [...new Set(docs.map((d) => d.createdBy))], [docs]);

  const filtered = useMemo(() => docs.filter((d) =>
    (!TAB_TYPE[tab] || d.type === TAB_TYPE[tab]) &&
    (typeFilter === 'All Types' || d.type === typeFilter) &&
    (jobFilter === 'All' || d.job === jobFilter) &&
    (statusFilter === 'All Status' || d.status === statusFilter) &&
    (userFilter === 'All Users' || d.createdBy === userFilter) &&
    (dateRange === 'Last 30 Days' || (dateRange === 'May 17 – May 23, 2026' ? /May (1[7-9]|2[0-3]), 2026/.test(d.date) : /May (2[4-9]|30), 2026/.test(d.date))) &&
    (!q || [d.name, d.job, d.trip, d.route].some((v) => v.toLowerCase().includes(q.toLowerCase())))
  ), [docs, tab, typeFilter, jobFilter, statusFilter, userFilter, dateRange, q]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  function notify(tone, title) { setToast({ tone, title }); }
  function downloadDocument(d) {
    const url = URL.createObjectURL(new Blob([`${d.name}\n${d.job} · ${d.trip}\n${d.route}`], { type: 'text/plain' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = d.name.replaceAll(' ', '_') + '.txt'; anchor.click();
    URL.revokeObjectURL(url); notify('info', `${d.name} downloaded.`);
  }
  function resetFilters() {
    setTypeFilter('All Types'); setJobFilter('All'); setStatusFilter('All Status'); setUserFilter('All Users');
    setQ(''); setOpenFilter(null); setPage(1);
  }
  function setStatus(id, status) {
    updateDocument(id, { status, compliance: status === 'Verified' ? 'Compliant' : status === 'Rejected' ? 'Non-Compliant' : 'Pending' });
    setMenuFor(null);
    notify(status === 'Verified' ? 'success' : status === 'Rejected' ? 'danger' : 'info', `${status === 'Rejected' ? 'Marked' : 'Document'} ${status === 'Verified' ? 'verified' : status === 'Rejected' ? 'rejected' : 'set to ' + status}.`);
  }
  function removeDoc(id) {
    deleteDocument(id);
    setMenuFor(null);
    notify('warning', 'Document deleted.');
  }
  function bulkVerify() {
    bulkUpdateDocuments(selected, { status: 'Verified', compliance: 'Compliant' });
    notify('success', `${selected.length} document${selected.length === 1 ? '' : 's'} verified.`);
    setSelected([]);
  }
  function bulkDelete() {
    bulkDeleteDocuments(selected);
    notify('warning', `${selected.length} document${selected.length === 1 ? '' : 's'} deleted.`);
    setSelected([]);
  }
  async function handleCreate() {
    if (!form.name || !form.job) return;
    const document = await createDocument({ name: form.name, desc: TYPE_LABEL[form.type], type: form.type, job: form.job,
      trip: form.trip || '—', createdBy: form.createdBy || 'Admin' });
    setNewOpen(false); setForm(EMPTY_FORM);
    notify('success', `${form.name} uploaded.`);
    navigate('/documents/' + document.id);
  }

  const columns = [
    { key: 'name', header: 'Document Name', width: 180, render: (d) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ width: 34, height: 34, borderRadius: 'var(--tk-r-sm)', flex: '0 0 auto', display: 'grid', placeItems: 'center',
                       background: `var(--tk-${TYPE_TONE[d.type] === 'neutral' ? 'neutral' : TYPE_TONE[d.type]}-soft)`,
                       color: TYPE_TONE[d.type] === 'neutral' ? 'var(--tk-ink-500)' : `var(--tk-${TYPE_TONE[d.type]})` }}>
          <Icon name="file-text" size={16} />
        </span>
        <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <strong style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.name}</strong>
          <span className="tk-meta">{d.desc}</span>
        </span>
      </span>) },
    { key: 'type', header: 'Document Type', width: 110, render: (d) => <Tag tone={TYPE_TONE[d.type]}>{d.type}</Tag> },
    { key: 'related', header: 'Related To', width: 160, render: (d) => (
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span style={{ font: '500 12px/17px var(--tk-font-sans)', color: 'var(--tk-ink-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.route}>{d.route}</span>
        <span className="tk-meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.job} · {d.trip}</span>
      </span>) },
    { key: 'createdBy', header: 'Created By', width: 105, render: (d) => (
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <strong style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.createdBy}</strong>
        <span className="tk-meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.dept}</span>
      </span>) },
    { key: 'status', header: 'Status', width: 85, render: (d) => <Badge tone={STATUS_TONE[d.status]} dot>{d.status}</Badge> },
    { key: 'date', header: 'Created At', width: 95, render: (d) => (
      <span style={{ display: 'grid', gap: 2 }}>
        <strong style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.date}</strong>
        <span className="tk-meta">{d.time}</span>
      </span>) },
    { key: 'actions', header: 'Actions', width: 105, render: (d) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <IconButton icon="eye" onClick={() => navigate('/documents/' + d.id)} label="View" />
        <IconButton icon="download" onClick={() => downloadDocument(d)} label="Download" />
        <IconButton icon="ellipsis-vertical" onClick={() => setMenuFor(menuFor === d.id ? null : d.id)} label="More" />
        {menuFor === d.id && (
          <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }}>
            <DropdownMenu width={200} items={[
              { label: 'View Document', icon: 'eye', onClick: () => { setMenuFor(null); navigate('/documents/' + d.id); } },
              { divider: true },
              ...(d.status !== 'Verified' ? [{ label: 'Mark Verified', icon: 'circle-check', onClick: () => setStatus(d.id, 'Verified') }] : []),
              ...(d.status !== 'Rejected' ? [{ label: 'Reject Document', icon: 'circle-x', onClick: () => setStatus(d.id, 'Rejected') }] : []),
              ...(d.status !== 'Pending' ? [{ label: 'Mark Pending', icon: 'hourglass', onClick: () => setStatus(d.id, 'Pending') }] : []),
              { divider: true },
              { label: 'Delete Document', icon: 'trash-2', tone: 'danger', onClick: () => removeDoc(d.id) },
            ]} />
          </span>
        )}
      </span>) },
  ];

  return (
    <>
      <PageHeader title="Documents" description="Manage, generate and track all documents across Trukkas."
        actions={<>
          <span style={{ position: 'relative' }}>
            <FilterSelect label={dateRange} icon="calendar" active={openFilter === 'date'} onClick={() => setOpenFilter(openFilter === 'date' ? null : 'date')} />
            {openFilter === 'date' && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={200} items={DATE_RANGES.map((r) => ({ label: r, icon: r === dateRange ? 'check' : undefined,
                  onClick: () => { setDateRange(r); setOpenFilter(null); } }))} />
              </span>
            )}
          </span>
          <span style={{ position: 'relative' }}>
            <Button variant="outline" icon="sliders-horizontal" onClick={() => setOpenFilter(openFilter === 'quick' ? null : 'quick')}>Filters</Button>
            {openFilter === 'quick' && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={210} items={[
                  { section: 'QUICK FILTERS' },
                  { label: 'Expiring Soon', icon: 'calendar-clock', onClick: () => { setStatusFilter('Pending'); setOpenFilter(null); } },
                  { label: 'Pending Verification Only', icon: 'clock', onClick: () => { setStatusFilter('Pending'); setOpenFilter(null); } },
                  { label: 'Rejected Only', icon: 'circle-x', onClick: () => { setStatusFilter('Rejected'); setOpenFilter(null); } },
                ]} />
              </span>
            )}
          </span>
          <Button icon="plus" onClick={() => setNewOpen(true)}>New Document</Button>
        </>} />

      {toast && <Banner tone={toast.tone} title={toast.title} />}

      <div className="documents-stats">
        <StatCard icon="file-text" tint="blue" label="Total Documents" value="4,862" delta="14.6%" caption="vs May 17 – May 23" />
        <StatCard icon="clock" tint="amber" label="Pending Verification" value="132" delta="8.7%" caption="vs May 17 – May 23" />
        <StatCard icon="calendar-clock" tint="red" label="Expiring Soon" value="78" delta="12.4%" direction="down" caption="Within 30 days" />
        <StatCard icon="circle-check" tint="green" label="Verified Documents" value="4,120" delta="15.3%" caption="vs May 17 – May 23" />
        <StatCard icon="circle-x" tint="red" label="Rejected Documents" value="24" delta="4.1%" direction="down" caption="vs May 17 – May 23" />
        <StatCard icon="hard-drive" tint="navy" label="Storage Used" value="68.4 GB" caption="of 200 GB · 34% used" />
      </div>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      <div className="documents-main">
        <SectionCard pad="none">
          <div className="documents-filters">
            <SearchField placeholder="Search documents by name, job ID, trip ID..." style={{ flex: '1 1 260px', minWidth: 200 }}
              value={q} onChange={(e) => setQ(e.target.value)} />
            <span style={{ position: 'relative' }}>
              <FilterSelect label={typeFilter} active={typeFilter !== 'All Types'} onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')} />
              {openFilter === 'type' && (
                <span style={{ position: 'absolute', left: 0, top: 40, zIndex: 30 }}>
                  <DropdownMenu width={190} items={['All Types', ...TYPES].map((s) => ({ label: s, icon: s === typeFilter ? 'check' : undefined,
                    onClick: () => { setTypeFilter(s); setOpenFilter(null); } }))} />
                </span>
              )}
            </span>
            <span style={{ position: 'relative' }}>
              <FilterSelect label={jobFilter === 'All' ? 'Related To' : jobFilter} active={jobFilter !== 'All'} onClick={() => setOpenFilter(openFilter === 'job' ? null : 'job')} />
              {openFilter === 'job' && (
                <span style={{ position: 'absolute', left: 0, top: 40, zIndex: 30 }}>
                  <DropdownMenu width={190} items={['All', ...jobs].map((s) => ({ label: s, icon: s === jobFilter ? 'check' : undefined,
                    onClick: () => { setJobFilter(s); setOpenFilter(null); } }))} />
                </span>
              )}
            </span>
            <span style={{ position: 'relative' }}>
              <FilterSelect label={statusFilter} active={statusFilter !== 'All Status'} onClick={() => setOpenFilter(openFilter === 'status' ? null : 'status')} />
              {openFilter === 'status' && (
                <span style={{ position: 'absolute', left: 0, top: 40, zIndex: 30 }}>
                  <DropdownMenu width={180} items={['All Status', ...STATUSES].map((s) => ({ label: s, icon: s === statusFilter ? 'check' : undefined,
                    onClick: () => { setStatusFilter(s); setOpenFilter(null); } }))} />
                </span>
              )}
            </span>
            <span style={{ position: 'relative' }}>
              <FilterSelect label={userFilter} active={userFilter !== 'All Users'} onClick={() => setOpenFilter(openFilter === 'user' ? null : 'user')} />
              {openFilter === 'user' && (
                <span style={{ position: 'absolute', left: 0, top: 40, zIndex: 30 }}>
                  <DropdownMenu width={190} items={['All Users', ...users].map((s) => ({ label: s, icon: s === userFilter ? 'check' : undefined,
                    onClick: () => { setUserFilter(s); setOpenFilter(null); } }))} />
                </span>
              )}
            </span>
            <Button variant="outline" icon="rotate-cw" onClick={resetFilters}>Reset</Button>
            <IconButton icon="layout-grid" tone={dense ? 'blue' : 'outline'} label="Toggle density" onClick={() => setDense((d) => !d)} />
          </div>

          {selected.length > 0 && (
            <div className="documents-bulk">
              <Icon name="check-check" size={15} /><span>{selected.length} selected</span>
              <span style={{ flex: 1 }} />
              <Button size="sm" variant="outline" icon="circle-check" onClick={bulkVerify}>Verify Selected</Button>
              <Button size="sm" variant="danger" icon="trash-2" onClick={bulkDelete}>Delete Selected</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }} className="tk-meta">No documents match the current filters.</div>
          ) : (
            <DataTable selectable rows={paged} columns={columns} selected={selected} onSelect={setSelected}
              rowKey={(r) => r.id} onRowClick={(d) => navigate('/documents/' + d.id)} tableLayout="fixed"
              style={dense ? { font: '400 12px/17px var(--tk-font-sans)' } : undefined} />
          )}
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(filtered.length / pageSize))}
            total={filtered.length} pageSize={pageSize} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
        </SectionCard>

        <div className="documents-rail">
          <SectionCard title="Document Categories" action={<a onClick={() => { setTab('All Documents'); setTypeFilter('All Types'); setPage(1); }} style={{ cursor: 'pointer' }}>View All</a>}>
            {CATEGORIES.map((c) => (
              <div key={c.type} className="documents-cat-row" onClick={() => { setTab(TAB_ITEMS.find((t) => TAB_TYPE[t] === c.type) || 'All Documents'); }}>
                <span style={{ width: 32, height: 32, borderRadius: 'var(--tk-r-sm)', flex: '0 0 auto', display: 'grid', placeItems: 'center',
                               background: `var(--tk-${TYPE_TONE[c.type] === 'neutral' ? 'neutral' : TYPE_TONE[c.type]}-soft)`,
                               color: TYPE_TONE[c.type] === 'neutral' ? 'var(--tk-ink-500)' : `var(--tk-${TYPE_TONE[c.type]})` }}>
                  <Icon name="file-text" size={15} />
                </span>
                <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{c.label}</span>
                <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{c.count} documents</span>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Recent Documents" action={<a onClick={() => notify('info', 'Showing recent documents.')} style={{ cursor: 'pointer' }}>View All</a>}>
            {RECENT.map((r) => (
              <ListRow key={r.name} icon="file-text" iconTint={LIST_TINT[TYPE_TONE[r.type]]}
                title={r.name} subtitle={`${r.job} · ${r.trip}`}
                value={<Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>} caption={r.ago} />
            ))}
          </SectionCard>

          <SectionCard title="Document Alerts" action={<a onClick={() => notify('info', 'Showing all document alerts.')} style={{ cursor: 'pointer' }}>View All</a>}>
            {ALERTS.map((a) => (
              <AlertRow key={a.title} icon={a.icon} tone={a.tone} title={a.title} description={a.desc}
                action={<span className="tk-meta" style={{ whiteSpace: 'nowrap' }}>{a.time}</span>} />
            ))}
          </SectionCard>
        </div>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New Document" description="Upload and register a new document."
        footer={<>
          <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
          <Button disabled={!form.name || !form.job} onClick={handleCreate}>Upload Document</Button>
        </>}>
        <div style={{ display: 'grid', gap: 14 }}>
          <TextField label="Document Name" required placeholder="e.g. Bill of Lading" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Select label="Document Type" options={TYPES} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <TextField label="Job ID" required placeholder="e.g. JOB-29821" value={form.job} onChange={(e) => setForm((f) => ({ ...f, job: e.target.value }))} />
            <TextField label="Trip ID" placeholder="e.g. TRIP-98231" value={form.trip} onChange={(e) => setForm((f) => ({ ...f, trip: e.target.value }))} />
          </div>
          <TextField label="Created By" placeholder="e.g. John Adewale" value={form.createdBy} onChange={(e) => setForm((f) => ({ ...f, createdBy: e.target.value }))} />
        </div>
      </Modal>

    </>
  );
}
