'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import {
  PageHeader, StatCard, Card, Tabs, SearchField, FilterSelect, DropdownMenu,
  Button, DataTable, Pagination, Badge, Avatar, Icon, IconButton, EmptyState, Skeleton,
} from '../ds.js';
import { useGetAdminAuditDirectoryQuery, useGetAdminSystemEventsQuery, useGetAdminAuditScreenSummaryQuery, useGetAdminAuditDetailQuery, auditPeriod, auditMatchesTab, auditTabAvailable, auditCsv, AUDIT_DATE_OPTIONS } from '../store/features/audit/auditApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { DriverTableLoading } from './DriversLoading.jsx';
import './AuditLogs.css';

const EMPTY_ROWS = [];
const STATUS_TONE = { Success: 'success', Failed: 'danger' };

const ACTION_TONE = { APPROVE: 'success', CREATE: 'info', UPDATE: 'warning', UPLOAD: 'purple', LOGIN: 'neutral', REJECT: 'danger', DELETE: 'danger', SYSTEM: 'neutral', VERIFY: 'success' };
const TABS = ['All Logs', 'User Actions', 'System Events', 'Data Changes', 'Security Events', 'Login History'];
const DATE_OPTIONS = AUDIT_DATE_OPTIONS;

function MenuFilter({ value, options, icon, onChange }) {
  const [open, setOpen] = useState(false);
  return <span className="audit-menu-wrap">
    <FilterSelect label={value} icon={icon} active={value !== options[0]} onClick={() => setOpen((v) => !v)} />
    {open && <span className="audit-dropdown" onMouseLeave={() => setOpen(false)}><DropdownMenu width={220} items={options.map((item) => ({ label: item, icon: item === value ? 'check' : undefined, onClick: () => { onChange(item); setOpen(false); } }))} /></span>}
  </span>;
}

function AuditDrawer({ audit, loading, onClose, onNavigate, onNotify, onCopy }) {
  useEffect(() => {
    const close = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  const detailValue = (value) => loading ? <Skeleton as="span" width={100} height={16} /> : value;
  if (!audit) return null;
  return <>
    <button className="audit-drawer-scrim" aria-label="Close audit details" onClick={onClose} />
    <aside className="audit-drawer" aria-label="Audit log details" role="dialog" aria-modal="true">
      <header className="audit-drawer-header"><h2>Audit Log Details</h2><IconButton icon="x" aria-label="Close" onClick={onClose} /></header>
      <div className="audit-drawer-scroll">
        <section className="audit-event-summary">
          <span className={`audit-event-icon ${audit.tone}`}><Icon name={audit.icon} size={20} /></span>
          <div><strong>{audit.description}</strong><button onClick={() => onCopy(audit.reference)}>{audit.reference}</button></div>
          <div><Badge tone={STATUS_TONE[audit.status] || 'neutral'}>{audit.status}</Badge><time>{audit.date}, {audit.time}<small>{audit.relative}</small></time></div>
        </section>

        <section className="audit-detail-section"><h3>User Information</h3><div className="audit-user"><Avatar name={audit.user} size={42} /><div><strong>{audit.user}</strong><span>{audit.email}</span></div><Badge tone="info">{audit.role}</Badge><button onClick={() => audit.actorPath ? onNavigate(audit.actorPath) : onNotify('Viewing this admin actor profile is not supported by the current profile routes.')}>View User Profile</button></div></section>

        <section className="audit-detail-section"><h3>Action Details</h3><dl className="audit-facts">
          <dt>Action</dt><dd><Badge tone={ACTION_TONE[audit.action]}>{audit.action}</Badge></dd>
          <dt>Module</dt><dd>{audit.module}</dd><dt>Description</dt><dd>{audit.description}</dd>
          <dt>Reference ID</dt><dd><button onClick={() => onCopy(audit.reference)}>{audit.reference}</button></dd>
          <dt>IP Address</dt><dd>{audit.ip}</dd><dt>Device</dt><dd>{audit.device}</dd><dt>Location</dt><dd>{detailValue(audit.location)}</dd>
          <dt>Status</dt><dd><span className={audit.status === 'Success' ? 'audit-success' : audit.status === 'Failed' ? 'audit-failed' : undefined}><Icon name={audit.status === 'Success' ? 'circle-check' : audit.status === 'Failed' ? 'circle-x' : 'minus'} size={15} />{audit.status}</span></dd>
        </dl></section>

        <section className="audit-detail-section"><h3>Changes Made</h3><div className="audit-change-labels"><span>Before</span><span>After</span></div><div className="audit-change-grid"><pre>{detailValue(audit.before?.join('\n') ?? '—')}</pre><Icon name="chevron-right" size={18} /><pre>{detailValue(audit.after?.join('\n') ?? '—')}</pre></div></section>

        <section className="audit-detail-section"><h3>Related Records</h3>{audit.related?.length ? <div className="audit-related-list">{audit.related.map((item) => <button key={item.key} onClick={() => item.path ? onNavigate(item.path) : onNotify('Opening this related record requires a supported detail route and its record context.')}><span><Icon name={item.icon} size={16} /></span><small>{item.label}</small><strong>{item.value}</strong><em>View</em></button>)}</div> : <p className="audit-no-related">{audit.related == null ? '—' : 'No related records for this event.'}</p>}</section>

        <section className="audit-detail-section"><h3>Additional Information</h3><dl className="audit-facts"><dt>User Agent</dt><dd>{detailValue(audit.userAgent)}</dd><dt>Session ID</dt><dd className="audit-session">{detailValue(audit.sessionId)}</dd><dt>Audit ID</dt><dd className="audit-session">{audit.id}</dd></dl></section>
      </div>
    </aside>
  </>;
}

export function AuditLogs() {
  const scope = useSelector(state => [state.auth.admin?.id, state.auth.admin?.role, Boolean(state.auth.accessToken)].join(':'));
  return <AuditLogsScreen key={scope} />;
}

function AuditLogsScreen() {
  const navigate = useNavigate();
  const role = useSelector((state) => state.auth.admin?.role);
  const owner = useSelector((state) => state.auth.admin?.id);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const canView = authenticated && Boolean(owner) && role === 'SUPER_ADMIN';
  const [tab, setTab] = useState('All Logs');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState({ date: DATE_OPTIONS[0], user: 'All Users', module: 'All Modules', action: 'All Actions', status: 'All Statuses' });
  const [filters, setFilters] = useState(draft);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectedAuditId, setSelectedAuditId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null), initialDrawer = useRef(false), active = useRef(true);
  const period = useMemo(() => auditPeriod(filters.date), [filters.date]);
  const systemEvents = tab === 'System Events';
  const adminLogsQuery = useGetAdminAuditDirectoryQuery({ ...period, owner, role }, { skip: !canView || systemEvents, refetchOnMountOrArgChange: true });
  const systemEventsQuery = useGetAdminSystemEventsQuery({ ...period, owner, role }, { skip: !canView || !systemEvents, refetchOnMountOrArgChange: true });
  const logsQuery = systemEvents ? systemEventsQuery : adminLogsQuery;
  const summaryScope = systemEvents ? 'system' : tab === 'All Logs' ? 'all' : 'admin';
  const summaryQuery = useGetAdminAuditScreenSummaryQuery({ owner, role, scope: summaryScope }, { skip: !canView, refetchOnMountOrArgChange: true });
  const error = role && !canView ? { status: 403, data: { message: 'Only Super Admins can view audit logs.' } } : logsQuery.error;
  const audits = !canView || logsQuery.error ? EMPTY_ROWS : logsQuery.currentData?.rows || EMPTY_ROWS;
  const summary = canView && !summaryQuery.error ? summaryQuery.currentData : null;
  const loading = !role || logsQuery.isLoading || (logsQuery.isFetching && !logsQuery.currentData);
  const summaryLoading = !role || summaryQuery.isLoading || (summaryQuery.isFetching && !summaryQuery.currentData);
  const metric = (value) => summaryLoading ? <Skeleton as="span" width={54} height={23} /> : value == null ? '—' : value.toLocaleString();
  const comparison = (key) => summary?.comparisons?.[key];
  const delta = (key) => comparison(key)?.percent == null ? '—' : `${comparison(key).percent}%`;
  const direction = (key) => comparison(key)?.direction ?? null;
  const selectedAuditRow = audits.find((row) => row.id === selectedAuditId) || null;
  const detailQuery = useGetAdminAuditDetailQuery({ id: selectedAuditId, owner, role }, { skip: !canView || !selectedAuditRow || systemEvents, refetchOnMountOrArgChange: true });
  const selectedAudit = systemEvents ? selectedAuditRow : selectedAuditRow && !detailQuery.error && detailQuery.currentData?.id === selectedAuditId ? detailQuery.currentData : selectedAuditRow;
  const detailLoading = !systemEvents && (detailQuery.isLoading || (detailQuery.isFetching && !detailQuery.currentData));
  const selectAudit = (row) => { if (!systemEvents && row.id === selectedAuditId && detailQuery.error) detailQuery.refetch(); setSelectedAuditId(row.id); };

  const users = ['All Users', ...new Set(audits.map((row) => row.user).filter((value) => value !== '—'))];
  const modules = ['All Modules', ...new Set(audits.map((row) => row.module).filter((value) => value !== '—'))];
  const actions = ['All Actions', ...new Set(audits.map((row) => row.action).filter((value) => value !== '—'))];
  const baseFilters = { date: DATE_OPTIONS[0], user: 'All Users', module: 'All Modules', action: 'All Actions', status: 'All Statuses' };

  useEffect(() => {
    const syncSearch = (event) => { setQuery(event.detail || ''); setPage(1); };
    window.addEventListener('trukkas:global-search', syncSearch);
    return () => window.removeEventListener('trukkas:global-search', syncSearch);
  }, []);

  const filtered = useMemo(() => audits.filter((row) => {
    const q = query.trim().toLowerCase();
    const tabMatches = auditMatchesTab(row, tab);
    return tabMatches && (filters.user === 'All Users' || row.user === filters.user) && (filters.module === 'All Modules' || row.module === filters.module) && (filters.action === 'All Actions' || row.action === filters.action) && (filters.status === 'All Statuses' || row.status === filters.status) && (!q || [row.user, row.email, row.action, row.actionCode, row.module, row.description, row.reference, row.id, row.ip, row.related?.map((item) => item.id).join(' ')].some((value) => typeof value === 'string' && value.toLowerCase().includes(q)));
  }), [audits, tab, filters, query, period]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { active.current = true; return () => { active.current = false; window.clearTimeout(toastTimer.current); }; }, []);
  useEffect(() => { if (!systemEvents && detailQuery.error && selectedAuditRow) notify(getApiErrorMessage(detailQuery.error)); }, [detailQuery.error, selectedAuditId, systemEvents]);
  useEffect(() => {
    setPage((current) => Math.max(1, Math.min(current, pageCount)));
    setSelectedRows((current) => current.filter((id) => filtered.some((row) => row.id === id)));
  }, [filtered, pageCount]);
  useEffect(() => {
    if (canView && logsQuery.currentData && !logsQuery.error && !initialDrawer.current) {
      initialDrawer.current = true;
      setSelectedAuditId(filtered[0]?.id || null);
    }
  }, [canView, filtered, logsQuery.currentData, logsQuery.error]);

  function reset() { setDraft(baseFilters); setFilters(baseFilters); setQuery(''); setPage(1); }
  function notify(message) { if (!active.current) return; window.clearTimeout(toastTimer.current); setToast(message); toastTimer.current = window.setTimeout(() => setToast(''), 1800); }
  async function copyReference(value) {
    if (!value || value === '—') { notify('The API did not provide a reference to copy.'); return; }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
      await navigator.clipboard.writeText(value); notify('Reference copied');
    } catch { notify('Could not copy the reference.'); }
  }
  function exportRows() {
    if (!canView || loading || logsQuery.error || !logsQuery.currentData) { notify('Audit logs are not available to export.'); return; }
    if (!auditTabAvailable(tab, audits)) { notify('Exporting this event category is not available in the documented audit API.'); return; }
    const rows = selectedRows.length ? filtered.filter((row) => selectedRows.includes(row.id)) : filtered;
    if (!rows.length) { notify('No audit logs selected for export.'); return; }
    let url;
    try {
      url = URL.createObjectURL(new Blob([auditCsv(rows)], { type: 'text/csv' }));
      const link = document.createElement('a'); link.href = url; link.download = 'trukkas-audit-logs.csv'; link.click(); notify('Audit log export downloaded');
    } catch { notify('Could not export audit logs.'); }
    finally { if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }

  return <div className="audit-page">
    <PageHeader title="Audit Logs" description="Track all system activities, user actions, and changes across Trukkas." actions={<Button variant="outline" icon="download" onClick={exportRows}>Export Logs</Button>} />
    <div className="audit-stats"><StatCard icon="files" tint="blue" label="Total Logs" value={metric(summary?.totalLogs)} delta={delta('totalLogs')} direction={direction('totalLogs')} caption="vs last month" /><StatCard icon="users" tint="navy" label="Active Users" value={metric(summary?.activeUsers)} delta={delta('activeUsers')} direction={direction('activeUsers')} caption="vs last month" /><StatCard icon="shield-alert" tint="red" label="Security Events" value={metric(summary?.securityEvents)} delta={delta('securityEvents')} direction={direction('securityEvents')} caption="vs last month" /><StatCard icon="triangle-alert" tint="amber" label="Failed Actions" value={metric(summary?.failedActions)} delta={delta('failedActions')} direction={direction('failedActions')} caption="vs last month" /></div>
    <Card pad="none" style={{ minWidth: 0 }}>
      <Tabs value={tab} onChange={(value) => { if ((value === 'System Events') !== systemEvents) { setSelectedAuditId(null); setSelectedRows([]); } setTab(value); setPage(1); }} items={TABS} style={{ padding: '0 16px' }} />
      <div className="audit-filter-row">
        <MenuFilter value={draft.date} options={DATE_OPTIONS} icon="calendar-days" onChange={(date) => setDraft((old) => ({ ...old, date }))} />
        <MenuFilter value={draft.user} options={users} onChange={(user) => setDraft((old) => ({ ...old, user }))} />
        <MenuFilter value={draft.module} options={modules} onChange={(module) => setDraft((old) => ({ ...old, module }))} />
        <MenuFilter value={draft.action} options={actions} onChange={(action) => setDraft((old) => ({ ...old, action }))} />
        <MenuFilter value={draft.status} options={['All Statuses', 'Success', 'Failed']} onChange={(status) => setDraft((old) => ({ ...old, status }))} />
      </div>
      <div className="audit-search-row"><SearchField placeholder="Search audit logs..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><div /><Button variant="outline" icon="rotate-ccw" onClick={reset}>Reset</Button><Button icon="check" onClick={() => { setFilters(draft); setPage(1); notify('Filters applied'); }}>Apply</Button></div>
      {loading ? <DriverTableLoading columns={9} label="Loading audit logs" /> : error ? <EmptyState icon="triangle-alert" title="Could not load audit logs" description={getApiErrorMessage(error)} action={<Button variant="outline" onClick={() => { if (canView) logsQuery.refetch(); else notify('Only Super Admins can view audit logs.'); }}>Retry</Button>} /> : !auditTabAvailable(tab, audits) ? <EmptyState icon="scroll-text" title="—" description="—" /> : paged.length ? <><DataTable rows={paged} rowKey={(r) => r.id} selectable selected={selectedRows} onSelect={setSelectedRows} onRowClick={selectAudit} tableLayout="fixed" columns={[
        { key: 'date', header: 'Date & Time', width: 126, render: (r) => <span className="audit-cell-stack"><span>{r.date}</span><small>{r.time}</small></span> },
        { key: 'user', header: 'User', width: 175, render: (r) => <span className="audit-user-cell"><Avatar name={r.user} size={32} /><span className="audit-cell-stack"><strong>{r.user}</strong><small>{r.email}</small></span></span> },
        { key: 'action', header: 'Action', width: 94, render: (r) => <Badge tone={ACTION_TONE[r.action]}>{r.action}</Badge> },
        { key: 'module', header: 'Module', width: 112 },
        { key: 'description', header: 'Description', width: 230, render: (r) => <span className="audit-description">{r.description}</span> },
        { key: 'reference', header: 'Reference', width: 120, render: (r) => <button className="audit-reference" onClick={(event) => { event.stopPropagation(); copyReference(r.reference); }}>{r.reference}</button> },
        { key: 'status', header: 'Status', width: 92, render: (r) => <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{r.status}</Badge> },
        { key: 'actions', header: '', width: 50, render: (r) => <IconButton icon="ellipsis-vertical" aria-label={`View ${r.id}`} onClick={(event) => { event.stopPropagation(); selectAudit(r); }} /> },
      ]} /><Pagination page={page} pageCount={pageCount} pageSize={pageSize} total={filtered.length} onPage={(next) => setPage(Math.max(1, Math.min(next, pageCount)))} onPageSize={(size) => { setPageSize(size); setPage(1); }} /></> : <EmptyState icon="scroll-text" title="No audit logs found" description="Try changing your search or filters." />}
    </Card>
    <AuditDrawer audit={selectedAudit} loading={detailLoading} onClose={() => setSelectedAuditId(null)} onNavigate={navigate} onNotify={notify} onCopy={copyReference} />
    {toast && <div className="audit-toast" role="status">{toast}</div>}
  </div>;
}
