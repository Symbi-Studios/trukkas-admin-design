'use client';
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';

import { ViewToggle } from '../ds.js';

import { usePageSearchState } from '../components/PageSearch.jsx';


import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { DateRangeFilter, EMPTY_RANGE } from '../components/DateRangeFilter.jsx';
import { verificationDateParams } from '../store/features/verification/verificationDates.js';
import { Link, useNavigate } from '../router.js';
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  TableToolbar,
  SearchField,
  FilterSelect,
  DataTable,
  Pagination,
  Badge,
  CopyableId,
  Avatar,
  DropdownMenu,
  IconButton,
  Icon,
  Skeleton,
  EmptyState,
  StatsPanel,
} from '../ds.js';
import { DEFAULT_STATS_PERIOD, statsPeriod, statsPeriodRange } from '../domain/statsPeriod.js';
import { useGetAdminVerificationDirectoryQuery, useGetAdminVerificationSummaryQuery, verificationSummary, verificationDetailUrl, verificationFilterValue } from '../store/features/verification/verificationApi.js';
import { VerificationActionDialog } from './VerificationActionDialog.jsx';
import { useVerificationOperations } from '../store/features/verification/useVerificationOperations.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { DriverTableLoading } from './DriversLoading.jsx';

const EMPTY_ROWS = [];

const STATUS_ICON = { Pending: 'clock', 'In Review': 'eye', Verified: 'shield-check', Rejected: 'shield-x' };
const STATUS_TONE = { Pending: 'warning', 'In Review': 'info', Verified: 'success', Rejected: 'danger' };
const RISK_TONE = { Low: 'success', Medium: 'warning', High: 'danger' };
const ENTITY_TYPES = ['Forwarder', 'Exporter', 'Truck Company', 'Driver', 'Individual Trucker', 'Truck'];
const VERIFICATION_TYPES = ['Business Verification', 'License Verification', 'Company Address Verification',
  'Fleet Verification', 'Tax Identification (TIN)', 'Insurance Verification', 'Export License', 'Vehicle Documents'];
const STATUSES = ['Pending', 'In Review', 'Verified', 'Rejected'];
const RISK_LEVELS = ['Low', 'Medium', 'High'];
const PAGE_SIZE = 8;

function FilterButton({ value, options, active, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <FilterSelect label={value} active={active} onClick={() => setOpen((o) => !o)} />
      {open && (
        <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setOpen(false)}>
          <DropdownMenu width={210} items={options.map((o) => ({
            label: o, icon: o === value ? 'check' : undefined,
            onClick: () => { onChange(o); setOpen(false); },
          }))} />
        </span>
      )}
    </span>
  );
}

export function Verification() {
  const scope = useSelector(state => [state.auth.admin?.id, state.auth.admin?.role, Boolean(state.auth.accessToken)].join(':'));
  return <VerificationScreen key={scope} />;
}

function VerificationScreen() {
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [tableView, setTableView] = useState('list');
  const navigate = useNavigate();
  const operations = useVerificationOperations();
  const [range, setRange] = useState(null);
  const [entityType, setEntityType] = useState('All Types');
  const [verType, setVerType] = useState('All Types');
  const allTime = useGetAdminVerificationSummaryQuery({ owner: operations.owner, role: operations.role }, { skip: !operations.authenticated, refetchOnMountOrArgChange: true });
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsRange = useMemo(() => statsPeriodRange(statsPeriodKey), [statsPeriodKey]);
  const periodSummaryQuery = useGetAdminVerificationSummaryQuery({ owner: operations.owner, role: operations.role, ...statsRange }, { skip: !operations.authenticated, refetchOnMountOrArgChange: true });
  const query = useGetAdminVerificationDirectoryQuery({ owner: operations.owner, role: operations.role, entityType: verificationFilterValue('entityType', entityType), verificationType: verificationFilterValue('verificationType', verType), ...(range ? { range } : {}) }, { skip: !operations.authenticated, refetchOnMountOrArgChange: true });
  const [dialog, setDialog] = useState(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => { setDialog(null); }, [operations.owner]);
  function openDialog(action, model) {
    setMenuFor(null);
    if (!operations.canManage) { window.alert('Your account cannot manage verifications.'); return; }
    setDialog({ action, model });
  }
  const verifications = !operations.authenticated || query.error ? EMPTY_ROWS : query.currentData || EMPTY_ROWS;
  const summary = !operations.authenticated || allTime.error ? verificationSummary(null) : allTime.currentData || verificationSummary(null);
  const loading = query.isLoading || (query.isFetching && !query.currentData);
  const statValue = (value) => periodSummaryQuery.isLoading || (periodSummaryQuery.isFetching && !periodSummaryQuery.currentData) ? <Skeleton as="span" width={54} height={23} /> : value;
  const cards = !operations.authenticated || periodSummaryQuery.error ? verificationSummary(null) : periodSummaryQuery.currentData || verificationSummary(null);
  const unavailable = (action) => window.alert(`${action} is not available for this verification.`);
  const [tab, setTab] = useState('All Verifications');
  const [q, setQ] = usePageSearchState('', () => setPage(1));
  const [status, setStatus] = useState('All Statuses');
  const [riskLevel, setRiskLevel] = useState('All Levels');
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState(null);

  const filtered = useMemo(() => verifications.filter((v) => (
    (tab === 'All Verifications' || (tab === 'Expiring Soon' ? v.expiringSoon === true : v.status === tab)) &&
    (status === 'All Statuses' || v.status === status) &&
    (riskLevel === 'All Levels' || v.riskLevel === riskLevel) &&
    (!q || [v.id, v.reviewId, v.entityName, v.regNo].some((s) => s && s.toLowerCase().includes(q.toLowerCase())))
  )), [verifications, tab, status, riskLevel, q]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage((current) => Math.min(current, Math.max(1, Math.ceil(filtered.length / pageSize)))), [filtered.length, pageSize]);

  function exportReport() {
    const entity = verificationFilterValue('entityType', entityType), type = verificationFilterValue('verificationType', verType);
    if (entity === undefined || type === undefined || (STATUSES.includes(tab) && status !== 'All Statuses' && status !== tab)) { unavailable('Export with these filters'); return; }
    const params = range ? { ...verificationDateParams(range) } : {};
    if (q.trim()) params.search = q.trim();
    if (entity) params.entityType = entity;
    if (type) params.verificationType = type;
    const selectedStatus = STATUSES.includes(tab) ? tab : status;
    if (STATUSES.includes(selectedStatus)) params.status = selectedStatus.toUpperCase().replaceAll(' ', '_');
    if (riskLevel !== 'All Levels') params.riskLevel = riskLevel.toUpperCase();
    if (tab === 'Expiring Soon') params.expiringSoon = true;
    operations.download(null, 'report', params);
  }

  function resetFilters() {
    setTab('All Verifications'); setEntityType('All Types'); setVerType('All Types'); setStatus('All Statuses');
    setRiskLevel('All Levels'); setQ(''); setRange(null); setPage(1);
  }

  return (
    <>
      <PageHeader crumbs={['Compliance', 'Verification', 'All Verifications']} title="All Verifications"
        description="Monitor and manage all verification requests across entities."
        actions={<Button icon="plus" onClick={() => openDialog('create')}>New Verification</Button>} />

      <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey}>
        <StatCard icon="clipboard-list" tint="blue" label="Total Verifications" value={statValue(cards.total)} caption={statsPeriod(statsPeriodKey).summary} />
        <StatCard icon="clock" tint="amber" label="Pending" value={statValue(cards.pending)} caption={cards.pendingShare} />
        <StatCard icon="eye" tint="blue" label="In Review" value={statValue(cards.inReview)} caption={cards.inReviewShare} />
        <StatCard icon="shield-check" tint="green" label="Verified" value={statValue(cards.verified)} caption={cards.verifiedShare} />
        <StatCard icon="shield-x" tint="red" label="Rejected" value={statValue(cards.rejected)} caption={cards.rejectedShare} />
        <StatCard icon="calendar-clock" tint="amber" label="Expiring Soon" value={statValue(cards.expiringSoon)} caption={cards.expiringSoonCaption} />
      </StatsPanel>

      <SectionCard title="" pad="none" style={{ paddingTop: 4 }}>
        <TableToolbar viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
          search={<SearchField placeholder="Search by company, entity, verification ID..." value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
          filters={<>
            <FilterButton value={entityType} options={['All Types', ...ENTITY_TYPES]} active={entityType !== 'All Types'}
              onChange={(v) => { if (verificationFilterValue('entityType', v) === undefined) { unavailable(v); return; } setEntityType(v); setPage(1); }} />
            <FilterButton value={verType} options={['All Types', ...VERIFICATION_TYPES]} active={verType !== 'All Types'}
              onChange={(v) => { if (verificationFilterValue('verificationType', v) === undefined) { unavailable(v); return; } setVerType(v); setPage(1); }} />
            <FilterButton value={tab === 'Expiring Soon' ? tab : status} options={['All Statuses', ...STATUSES, 'Expiring Soon']} active={status !== 'All Statuses' || tab === 'Expiring Soon'}
              onChange={(v) => { setStatus(v === 'Expiring Soon' ? 'All Statuses' : v); setTab(v === 'Expiring Soon' ? v : 'All Verifications'); setPage(1); }} />
            <FilterButton value={riskLevel} options={['All Levels', ...RISK_LEVELS]} active={riskLevel !== 'All Levels'}
              onChange={(v) => { setRiskLevel(v); setPage(1); }} />
            <DateRangeFilter value={range || EMPTY_RANGE} onChange={next => { setRange(next.from && next.to ? next : null); setPage(1); setMenuFor(null); }} />
          </>}
          trailing={<Button variant="outline" icon="download" onClick={exportReport}>Export</Button>}
          onClear={resetFilters} />



        <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.verification} boardOnRowClick={(row) => navigate(verificationDetailUrl(row))} view={tableView} boardGroupBy={(row) => row.status} rows={loading ? EMPTY_ROWS : paged} rowKey={(r) => r.key}
          columns={[
            { key: 'id', header: 'Verification ID', render: (r) => <CopyableId id={r.id} size="sm" onCopy={() => { if (r.id !== '—') navigator.clipboard?.writeText(r.id).catch(() => unavailable('Copy verification ID')); }} /> },
            { key: 'entity', header: 'Entity / Company', render: (r) => (
              <span style={{ display: 'grid', gap: 2 }}>
                <Link to={verificationDetailUrl(r)} style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.entityName}</Link>
                <span className="tk-meta">{r.regNo}</span>
              </span>) },
            { key: 'entityType', header: 'Entity Type', render: (r) => <Badge tone="neutral">{r.entityType}</Badge> },
            { key: 'type', header: 'Verification Type' },
            { key: 'submittedOn', header: 'Submitted On', render: (r) => (
              <span style={{ display: 'grid', gap: 2 }}>
                <span>{r.submittedOn.split(' ').slice(0, 3).join(' ')}</span>
                <span className="tk-meta">{r.submittedOn.split(' ').slice(3).join(' ')}</span>
              </span>) },
            { key: 'status', header: 'Status', render: (r) => (
              <Badge tone={STATUS_TONE[r.status]}>
                <Icon name={STATUS_ICON[r.status] || 'minus'} size={11} />{r.status}
              </Badge>) },
            { key: 'riskLevel', header: 'Risk Level', render: (r) => <Badge tone={RISK_TONE[r.riskLevel]}>{r.riskLevel}</Badge> },
            { key: 'dueDate', header: 'Due Date', render: (r) => (
              <span style={{ color: r.dueDate !== '—' ? 'var(--tk-danger)' : 'var(--tk-ink-500)',
                             font: r.dueDate !== '—' ? '500 13px/18px var(--tk-font-sans)' : undefined }}>
                {r.dueDate}
              </span>) },
            { key: 'assignedTo', header: 'Assigned To', render: (r) => (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={r.assignedTo} size={28} />
                <span style={{ display: 'grid', gap: 1 }}>
                  <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.assignedTo}</span>
                  <span className="tk-meta">{r.assignedRole}</span>
                </span>
              </span>) },
            { key: 'actions', header: 'Actions', width: 110, render: (r) => (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Button variant="outline" size="sm" icon="eye" onClick={() => navigate(verificationDetailUrl(r))}>View</Button>
                <span style={{ position: 'relative' }}>
                  <IconButton icon="ellipsis-vertical" onClick={() => setMenuFor(menuFor === r.key ? null : r.key)} />
                  {menuFor === r.key && (
                    <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }} onMouseLeave={() => setMenuFor(null)}>
                      <DropdownMenu width={210} items={[
                        { label: 'View Verification', icon: 'eye', onClick: () => { setMenuFor(null); navigate(verificationDetailUrl(r)); } },
                        { label: 'Reassign', icon: 'users', onClick: () => { openDialog('reassign', r); } },
                        { label: 'Download Documents', icon: 'download', onClick: () => { setMenuFor(null); operations.download(r.id, 'documents'); } },
                      ]} />
                    </span>
                  )}
                </span>
              </span>) },
          ]} />
        {loading ? <DriverTableLoading columns={10} label="Loading verifications" /> : query.error ? <EmptyState icon="triangle-alert" title="Could not load verifications" description={getApiErrorMessage(query.error)} action={<Button variant="outline" onClick={query.refetch}>Retry</Button>} /> : !paged.length ? <EmptyState icon="shield-check" title={['Verified', 'Rejected', 'Expiring Soon'].includes(tab) || ['Verified', 'Rejected'].includes(status) ? '—' : 'No verifications found'} description={['Verified', 'Rejected', 'Expiring Soon'].includes(tab) || ['Verified', 'Rejected'].includes(status) ? '—' : undefined} /> : null}
        <Pagination page={page} pageSize={pageSize} total={!operations.authenticated || query.error || loading || !query.currentData ? '—' : filtered.length}
          pageCount={Math.max(1, Math.ceil(filtered.length / pageSize))}
          onPage={(next) => setPage(Math.max(1, Math.min(next, Math.max(1, Math.ceil(filtered.length / pageSize)))))} onPageSize={(size) => { if (Number.isInteger(size) && size > 0) { setPageSize(size); setPage(1); } }} />
      </SectionCard>
      {dialog && <VerificationActionDialog key={operations.owner + dialog.action + (dialog.model?.id || '')} {...dialog} canManage={operations.canManage} onClose={() => setDialog(null)} />}
    </>
  );
}
