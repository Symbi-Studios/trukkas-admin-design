'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  PageHeader, StatCard, Card, Tabs, SearchField, FilterSelect, DropdownMenu,
  Button, DataTable, Pagination, Badge, Avatar, Icon, IconButton, EmptyState,
} from '../ds.js';
import './AuditLogs.css';

const AUDITS = [
  { id: 'AUD-260530-0946', date: 'May 30, 2026', time: '09:46 AM', relative: '2 minutes ago', user: 'Trukkas Admin', email: 'admin@trukkas.com', role: 'Super Admin', action: 'APPROVE', module: 'Payouts', description: 'Approved payout request for driver John Adewale', reference: 'PAY-77421', status: 'Success', ip: '197.210.32.18', device: 'Chrome (Windows 11)', location: 'Lagos, Nigeria', icon: 'circle-check', tone: 'success', related: [{ icon: 'file-check-2', label: 'Payout Request', value: 'PAY-77421', path: '/payouts/PAY-77421' }, { icon: 'user-round', label: 'Driver', value: 'John Adewale (DRV-0045)', path: '/drivers/DRV-0045' }, { icon: 'coins', label: 'Settlement', value: 'SETT-98231', path: '/settlements/SETT-98231' }, { icon: 'receipt', label: 'Transaction', value: 'TRX-82934', path: '/transactions/TRX-82934' }], before: ['status: "pending"', 'approved_by: null', 'approved_at: null', 'processed_at: null'], after: ['status: "approved"', 'approved_by: "Trukkas Admin"', 'approved_at: "2026-05-30 09:46:12"', 'processed_at: null'] },
  { id: 'AUD-260530-0942', date: 'May 30, 2026', time: '09:42 AM', relative: '6 minutes ago', user: 'Ibrahim Sani', email: 'ibrahim@abcfreight.com', role: 'Operations Manager', action: 'CREATE', module: 'Jobs', description: 'Created new job Apapa → Ikeja', reference: 'JOB-29821', status: 'Success', ip: '102.89.44.12', device: 'Safari (macOS)', location: 'Lagos, Nigeria', icon: 'package-plus', tone: 'info', related: [{ icon: 'package', label: 'Job', value: 'JOB-29821', path: '/jobs/JOB-29821' }], before: ['record: null'], after: ['status: "open"', 'route: "Apapa → Ikeja"', 'created_by: "Ibrahim Sani"'] },
  { id: 'AUD-260530-0940', date: 'May 30, 2026', time: '09:40 AM', relative: '8 minutes ago', user: 'Amaka Udo', email: 'amaka@trukkas.com', role: 'Fleet Manager', action: 'UPDATE', module: 'Fleet', description: 'Updated truck TRK-1045 maintenance status', reference: 'TRK-1045', status: 'Success', ip: '105.112.18.7', device: 'Chrome (Android)', location: 'Abuja, Nigeria', icon: 'truck', tone: 'warning', related: [{ icon: 'truck', label: 'Truck', value: 'TRK-1045', path: '/fleet/TRK-1045' }], before: ['maintenance_status: "due"'], after: ['maintenance_status: "scheduled"', 'updated_by: "Amaka Udo"'] },
  { id: 'AUD-260530-0932', date: 'May 30, 2026', time: '09:32 AM', relative: '16 minutes ago', user: 'Funke Olaye', email: 'funke@goodwillng.com', role: 'Compliance Officer', action: 'UPLOAD', module: 'Documents', description: 'Uploaded Proof of Delivery for JOB-29820', reference: 'JOB-29820', status: 'Success', ip: '154.113.7.83', device: 'Edge (Windows 11)', location: 'Ibadan, Nigeria', icon: 'file-up', tone: 'purple', related: [{ icon: 'package', label: 'Job', value: 'JOB-29820', path: '/jobs/JOB-29820' }, { icon: 'file-text', label: 'Document', value: 'DOC-09821', path: '/documents/DOC-09821' }], before: ['pod_document: null'], after: ['pod_document: "DOC-09821"', 'uploaded_by: "Funke Olaye"'] },
  { id: 'AUD-260530-0918', date: 'May 30, 2026', time: '09:18 AM', relative: '30 minutes ago', user: 'Daniel Kim', email: 'kim@dlcshipping.com', role: 'Company Admin', action: 'LOGIN', module: 'Authentication', description: 'User logged in from new device (Chrome, Windows)', reference: '—', status: 'Success', ip: '197.149.91.6', device: 'Chrome (Windows 11)', location: 'Port Harcourt, Nigeria', icon: 'log-in', tone: 'neutral', related: [], before: ['active_session: false'], after: ['active_session: true', 'device_trusted: false'] },
  { id: 'AUD-260529-1842', date: 'May 29, 2026', time: '06:42 PM', relative: 'Yesterday', user: 'Tunde Salami', email: 'tunde@nigerianbulk.com', role: 'Finance Manager', action: 'REJECT', module: 'Payouts', description: 'Rejected payout request (Insufficient docs)', reference: 'PAY-77418', status: 'Success', ip: '102.90.12.46', device: 'Firefox (Windows 10)', location: 'Lagos, Nigeria', icon: 'circle-x', tone: 'danger', related: [{ icon: 'file-check-2', label: 'Payout Request', value: 'PAY-77418', path: '/payouts/PAY-77418' }], before: ['status: "pending"'], after: ['status: "rejected"', 'reason: "Insufficient docs"'] },
  { id: 'AUD-260529-1715', date: 'May 29, 2026', time: '05:15 PM', relative: 'Yesterday', user: 'Trukkas Admin', email: 'admin@trukkas.com', role: 'Super Admin', action: 'DELETE', module: 'Users', description: 'Deactivated user Driver-0192', reference: 'USR-0192', status: 'Success', ip: '197.210.32.18', device: 'Chrome (Windows 11)', location: 'Lagos, Nigeria', icon: 'user-x', tone: 'danger', related: [{ icon: 'user', label: 'User', value: 'USR-0192', path: '/users/USR-0192' }], before: ['status: "active"'], after: ['status: "inactive"', 'deactivated_by: "Trukkas Admin"'] },
  { id: 'AUD-260529-1603', date: 'May 29, 2026', time: '04:03 PM', relative: 'Yesterday', user: 'Admin User', email: 'admin@trukkas.com', role: 'Super Admin', action: 'UPDATE', module: 'Pricing', description: 'Updated lane rate Lagos → Kano', reference: 'RATE-0021', status: 'Success', ip: '197.210.32.18', device: 'Chrome (Windows 11)', location: 'Lagos, Nigeria', icon: 'tag', tone: 'warning', related: [{ icon: 'tag', label: 'Pricing Rule', value: 'RATE-0021', path: '/pricing/RATE-0021' }], before: ['rate: "₦725,000"'], after: ['rate: "₦750,000"', 'updated_by: "Admin User"'] },
  { id: 'AUD-260529-1421', date: 'May 29, 2026', time: '02:21 PM', relative: 'Yesterday', user: 'Ola Ahmed', email: 'ola@totalenergies.com', role: 'Dispatcher', action: 'CREATE', module: 'Trips', description: 'Created trip Lagos → Onne', reference: 'TRIP-98214', status: 'Success', ip: '41.190.3.20', device: 'Chrome (macOS)', location: 'Lagos, Nigeria', icon: 'route', tone: 'info', related: [{ icon: 'route', label: 'Trip', value: 'TRIP-98214', path: '/trips' }], before: ['trip: null'], after: ['status: "assigned"', 'route: "Lagos → Onne"'] },
  { id: 'AUD-260529-1107', date: 'May 29, 2026', time: '11:07 AM', relative: 'Yesterday', user: 'System', email: 'Automated process', role: 'System', action: 'SYSTEM', module: 'System', description: 'Automated escrow release triggered', reference: 'TRX-82930', status: 'Success', ip: '10.0.0.12', device: 'Background worker', location: 'Lagos region', icon: 'cpu', tone: 'neutral', related: [{ icon: 'receipt', label: 'Transaction', value: 'TRX-82930', path: '/transactions/TRX-82930' }], before: ['escrow_status: "held"'], after: ['escrow_status: "released"'] },
  { id: 'AUD-260528-1645', date: 'May 28, 2026', time: '04:45 PM', relative: '2 days ago', user: 'Ngozi Obi', email: 'ngozi@trukkas.com', role: 'Support Lead', action: 'UPDATE', module: 'Support', description: 'Escalated support ticket to operations', reference: 'TKTS-2024-0248', status: 'Success', ip: '105.112.31.2', device: 'Chrome (Windows 11)', location: 'Lagos, Nigeria', icon: 'ticket', tone: 'warning', related: [{ icon: 'ticket', label: 'Support Ticket', value: 'TKTS-2024-0248', path: '/tickets/TKTS-2024-0248' }], before: ['priority: "medium"'], after: ['priority: "high"', 'team: "Operations"'] },
  { id: 'AUD-260528-1310', date: 'May 28, 2026', time: '01:10 PM', relative: '2 days ago', user: 'Bala Musa', email: 'bala@trukkas.com', role: 'Compliance Officer', action: 'VERIFY', module: 'Compliance', description: 'Verified company registration document', reference: 'VER-2024-00567', status: 'Success', ip: '102.91.17.4', device: 'Edge (Windows 11)', location: 'Abuja, Nigeria', icon: 'shield-check', tone: 'success', related: [{ icon: 'shield-check', label: 'Verification', value: 'VER-2024-00567', path: '/verification/VER-2024-00567' }], before: ['status: "in review"'], after: ['status: "verified"', 'verified_by: "Bala Musa"'] },
  { id: 'AUD-260528-1125', date: 'May 28, 2026', time: '11:25 AM', relative: '2 days ago', user: 'System', email: 'Automated process', role: 'System', action: 'SYSTEM', module: 'Security', description: 'Blocked repeated failed login attempts', reference: 'SEC-1842', status: 'Failed', ip: '185.220.101.4', device: 'Unknown device', location: 'Unknown location', icon: 'shield-alert', tone: 'danger', related: [], before: ['failed_attempts: 4'], after: ['failed_attempts: 5', 'access_status: "blocked"'] },
];

const ACTION_TONE = { APPROVE: 'success', CREATE: 'info', UPDATE: 'warning', UPLOAD: 'purple', LOGIN: 'neutral', REJECT: 'danger', DELETE: 'danger', SYSTEM: 'neutral', VERIFY: 'success' };
const TABS = ['All Logs', 'User Actions', 'System Events', 'Data Changes', 'Security Events', 'Login History'];
const DATE_OPTIONS = ['May 1, 2026 – May 30, 2026', 'May 24, 2026 – May 30, 2026', 'May 1, 2026 – May 15, 2026', 'All Time'];
const DATE_RANGES = {
  'May 1, 2026 – May 30, 2026': [new Date('2026-05-01T00:00:00'), new Date('2026-05-30T23:59:59')],
  'May 24, 2026 – May 30, 2026': [new Date('2026-05-24T00:00:00'), new Date('2026-05-30T23:59:59')],
  'May 1, 2026 – May 15, 2026': [new Date('2026-05-01T00:00:00'), new Date('2026-05-15T23:59:59')],
};

function MenuFilter({ value, options, icon, onChange }) {
  const [open, setOpen] = useState(false);
  return <span className="audit-menu-wrap">
    <FilterSelect label={value} icon={icon} active={value !== options[0]} onClick={() => setOpen((v) => !v)} />
    {open && <span className="audit-dropdown" onMouseLeave={() => setOpen(false)}><DropdownMenu width={220} items={options.map((item) => ({ label: item, icon: item === value ? 'check' : undefined, onClick: () => { onChange(item); setOpen(false); } }))} /></span>}
  </span>;
}

function AuditDrawer({ audit, onClose, onNavigate, onNotify }) {
  useEffect(() => {
    const close = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  if (!audit) return null;
  return <>
    <button className="audit-drawer-scrim" aria-label="Close audit details" onClick={onClose} />
    <aside className="audit-drawer" aria-label="Audit log details" role="dialog" aria-modal="true">
      <header className="audit-drawer-header"><h2>Audit Log Details</h2><IconButton icon="x" aria-label="Close" onClick={onClose} /></header>
      <div className="audit-drawer-scroll">
        <section className="audit-event-summary">
          <span className={`audit-event-icon ${audit.tone}`}><Icon name={audit.icon} size={20} /></span>
          <div><strong>{audit.description}</strong><button onClick={() => { navigator.clipboard?.writeText(audit.reference); onNotify('Reference copied'); }}>{audit.reference}</button></div>
          <div><Badge tone={audit.status === 'Success' ? 'success' : 'danger'}>{audit.status}</Badge><time>{audit.date}, {audit.time}<small>{audit.relative}</small></time></div>
        </section>

        <section className="audit-detail-section"><h3>User Information</h3><div className="audit-user"><Avatar name={audit.user} size={42} /><div><strong>{audit.user}</strong><span>{audit.email}</span></div><Badge tone="info">{audit.role}</Badge><button onClick={() => onNavigate(audit.user === 'System' ? '/users' : '/users/USR-2024-00078')}>View User Profile</button></div></section>

        <section className="audit-detail-section"><h3>Action Details</h3><dl className="audit-facts">
          <dt>Action</dt><dd><Badge tone={ACTION_TONE[audit.action]}>{audit.action}</Badge></dd>
          <dt>Module</dt><dd>{audit.module}</dd><dt>Description</dt><dd>{audit.description}</dd>
          <dt>Reference ID</dt><dd><button onClick={() => { navigator.clipboard?.writeText(audit.reference); onNotify('Reference copied'); }}>{audit.reference}</button></dd>
          <dt>IP Address</dt><dd>{audit.ip}</dd><dt>Device</dt><dd>{audit.device}</dd><dt>Location</dt><dd>{audit.location}</dd>
          <dt>Status</dt><dd><span className={audit.status === 'Success' ? 'audit-success' : 'audit-failed'}><Icon name={audit.status === 'Success' ? 'circle-check' : 'circle-x'} size={15} />{audit.status}</span></dd>
        </dl></section>

        <section className="audit-detail-section"><h3>Changes Made</h3><div className="audit-change-labels"><span>Before</span><span>After</span></div><div className="audit-change-grid"><pre>{audit.before.join('\n')}</pre><Icon name="chevron-right" size={18} /><pre>{audit.after.join('\n')}</pre></div></section>

        <section className="audit-detail-section"><h3>Related Records</h3>{audit.related.length ? <div className="audit-related-list">{audit.related.map((item) => <button key={item.value} onClick={() => onNavigate(item.path)}><span><Icon name={item.icon} size={16} /></span><small>{item.label}</small><strong>{item.value}</strong><em>View</em></button>)}</div> : <p className="audit-no-related">No related records for this event.</p>}</section>

        <section className="audit-detail-section"><h3>Additional Information</h3><dl className="audit-facts"><dt>User Agent</dt><dd>Mozilla/5.0 ({audit.device}) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36</dd><dt>Session ID</dt><dd className="audit-session">sess_8f5e2d9c7a4bf0a</dd><dt>Audit ID</dt><dd className="audit-session">{audit.id}</dd></dl></section>
      </div>
    </aside>
  </>;
}

export function AuditLogs() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('All Logs');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState({ date: DATE_OPTIONS[0], user: 'All Users', module: 'All Modules', action: 'All Actions', status: 'All Statuses' });
  const [filters, setFilters] = useState(draft);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectedAudit, setSelectedAudit] = useState(AUDITS[0]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [toast, setToast] = useState('');

  const users = ['All Users', ...new Set(AUDITS.map((row) => row.user))];
  const modules = ['All Modules', ...new Set(AUDITS.map((row) => row.module))];
  const actions = ['All Actions', ...new Set(AUDITS.map((row) => row.action))];
  const baseFilters = { date: DATE_OPTIONS[0], user: 'All Users', module: 'All Modules', action: 'All Actions', status: 'All Statuses' };

  useEffect(() => {
    const syncSearch = (event) => { setQuery(event.detail || ''); setPage(1); };
    window.addEventListener('trukkas:global-search', syncSearch);
    return () => window.removeEventListener('trukkas:global-search', syncSearch);
  }, []);

  const filtered = useMemo(() => AUDITS.filter((row) => {
    const q = query.trim().toLowerCase();
    const range = DATE_RANGES[filters.date];
    const occurredAt = new Date(`${row.date} ${row.time}`);
    const dateMatches = !range || (occurredAt >= range[0] && occurredAt <= range[1]);
    const tabMatches = tab === 'All Logs' || (tab === 'User Actions' && row.user !== 'System') || (tab === 'System Events' && row.user === 'System') || (tab === 'Data Changes' && ['CREATE', 'UPDATE', 'DELETE', 'UPLOAD'].includes(row.action)) || (tab === 'Security Events' && row.module === 'Security') || (tab === 'Login History' && row.action === 'LOGIN');
    return dateMatches && tabMatches && (filters.user === 'All Users' || row.user === filters.user) && (filters.module === 'All Modules' || row.module === filters.module) && (filters.action === 'All Actions' || row.action === filters.action) && (filters.status === 'All Statuses' || row.status === filters.status) && (!q || [row.user, row.email, row.action, row.module, row.description, row.reference, row.id].some((value) => value.toLowerCase().includes(q)));
  }), [tab, filters, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  function reset() { setDraft(baseFilters); setFilters(baseFilters); setQuery(''); setPage(1); }
  function notify(message) { setToast(message); window.setTimeout(() => setToast(''), 1800); }
  function exportRows() {
    const rows = selectedRows.length ? filtered.filter((row) => selectedRows.includes(row.id)) : filtered;
    const csv = [['Date & Time', 'User', 'Action', 'Module', 'Description', 'Reference', 'Status'], ...rows.map((r) => [`${r.date} ${r.time}`, r.user, r.action, r.module, r.description, r.reference, r.status])].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url; link.download = 'trukkas-audit-logs.csv'; link.click(); URL.revokeObjectURL(url); notify('Audit log export downloaded');
  }

  return <div className="audit-page">
    <PageHeader title="Audit Logs" description="Track all system activities, user actions, and changes across Trukkas." actions={<Button variant="outline" icon="download" onClick={exportRows}>Export Logs</Button>} />
    <div className="audit-stats"><StatCard icon="files" tint="blue" label="Total Logs" value="12,482" delta="18%" caption="vs last month" /><StatCard icon="users" tint="navy" label="Active Users" value="96" delta="5%" caption="vs last month" /><StatCard icon="shield-alert" tint="red" label="Security Events" value="7" delta="30%" direction="down" caption="vs last month" /><StatCard icon="triangle-alert" tint="amber" label="Failed Actions" value="3" delta="57%" direction="down" caption="vs last month" /></div>
    <Card pad="none" style={{ minWidth: 0 }}>
      <Tabs value={tab} onChange={(value) => { setTab(value); setPage(1); }} items={TABS} style={{ padding: '0 16px' }} />
      <div className="audit-filter-row">
        <MenuFilter value={draft.date} options={DATE_OPTIONS} icon="calendar-days" onChange={(date) => setDraft((old) => ({ ...old, date }))} />
        <MenuFilter value={draft.user} options={users} onChange={(user) => setDraft((old) => ({ ...old, user }))} />
        <MenuFilter value={draft.module} options={modules} onChange={(module) => setDraft((old) => ({ ...old, module }))} />
        <MenuFilter value={draft.action} options={actions} onChange={(action) => setDraft((old) => ({ ...old, action }))} />
        <MenuFilter value={draft.status} options={['All Statuses', 'Success', 'Failed']} onChange={(status) => setDraft((old) => ({ ...old, status }))} />
      </div>
      <div className="audit-search-row"><SearchField placeholder="Search audit logs..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><div /><Button variant="outline" icon="rotate-ccw" onClick={reset}>Reset</Button><Button icon="check" onClick={() => { setFilters(draft); setPage(1); notify('Filters applied'); }}>Apply</Button></div>
      {paged.length ? <><DataTable rows={paged} rowKey={(r) => r.id} selectable selected={selectedRows} onSelect={setSelectedRows} onRowClick={setSelectedAudit} tableLayout="fixed" columns={[
        { key: 'date', header: 'Date & Time', width: 126, render: (r) => <span className="audit-cell-stack"><span>{r.date}</span><small>{r.time}</small></span> },
        { key: 'user', header: 'User', width: 175, render: (r) => <span className="audit-user-cell"><Avatar name={r.user} size={32} /><span className="audit-cell-stack"><strong>{r.user}</strong><small>{r.email}</small></span></span> },
        { key: 'action', header: 'Action', width: 94, render: (r) => <Badge tone={ACTION_TONE[r.action]}>{r.action}</Badge> },
        { key: 'module', header: 'Module', width: 112 },
        { key: 'description', header: 'Description', width: 230, render: (r) => <span className="audit-description">{r.description}</span> },
        { key: 'reference', header: 'Reference', width: 120, render: (r) => <button className="audit-reference" onClick={(event) => { event.stopPropagation(); navigator.clipboard?.writeText(r.reference); notify('Reference copied'); }}>{r.reference}</button> },
        { key: 'status', header: 'Status', width: 92, render: (r) => <Badge tone={r.status === 'Success' ? 'success' : 'danger'}>{r.status}</Badge> },
        { key: 'actions', header: '', width: 50, render: (r) => <IconButton icon="ellipsis-vertical" aria-label={`View ${r.id}`} onClick={(event) => { event.stopPropagation(); setSelectedAudit(r); }} /> },
      ]} /><Pagination page={page} pageCount={pageCount} pageSize={pageSize} total={filtered.length} onPage={(next) => setPage(Math.max(1, Math.min(next, pageCount)))} onPageSize={(size) => { setPageSize(size); setPage(1); }} /></> : <EmptyState icon="scroll-text" title="No audit logs found" description="Try changing your search or filters." />}
    </Card>
    <AuditDrawer audit={selectedAudit} onClose={() => setSelectedAudit(null)} onNavigate={navigate} onNotify={notify} />
    {toast && <div className="audit-toast" role="status">{toast}</div>}
  </div>;
}
