'use client';

import { useMemo, useState } from 'react';
import { Link, useNavigate } from '../router.js';
import {
  PageHeader, Button, StatCard, SectionCard, Tabs, TableToolbar, SearchField, FilterSelect,
  DataTable, Pagination, Badge, CopyableId, Avatar, DropdownMenu, IconButton, Icon,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { verificationSummary } from '../mock/fixtures/verifications.js';

const STATUS_ICON = { Pending: 'clock', 'In Review': 'eye', Verified: 'shield-check', Rejected: 'shield-x' };
const STATUS_TONE = { Pending: 'warning', 'In Review': 'info', Verified: 'success', Rejected: 'danger' };
const RISK_TONE = { Low: 'success', Medium: 'warning', High: 'danger' };
const ENTITY_TYPES = ['Forwarder', 'Exporter', 'Truck Company'];
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
  const navigate = useNavigate();
  const verifications = useCollection('verifications') || [];
  const [tab, setTab] = useState('All Verifications');
  const [q, setQ] = useState('');
  const [entityType, setEntityType] = useState('All Types');
  const [verType, setVerType] = useState('All Types');
  const [status, setStatus] = useState('All Statuses');
  const [riskLevel, setRiskLevel] = useState('All Levels');
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState(null);

  const filtered = useMemo(() => verifications.filter((v) => (
    (tab === 'All Verifications' || v.status === tab) &&
    (entityType === 'All Types' || v.entityType === entityType) &&
    (verType === 'All Types' || v.type === verType) &&
    (status === 'All Statuses' || v.status === status) &&
    (riskLevel === 'All Levels' || v.riskLevel === riskLevel) &&
    (!q || [v.id, v.entityName, v.regNo].some((s) => s && s.toLowerCase().includes(q.toLowerCase())))
  )), [verifications, tab, entityType, verType, status, riskLevel, q]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetFilters() {
    setEntityType('All Types'); setVerType('All Types'); setStatus('All Statuses');
    setRiskLevel('All Levels'); setQ(''); setPage(1);
  }

  return (
    <>
      <PageHeader crumbs={['Compliance', 'Verification', 'All Verifications']} title="All Verifications"
        description="Monitor and manage all verification requests across entities."
        actions={<>
          <Button variant="outline" icon="download">Export Report</Button>
          <Button icon="plus">New Verification</Button>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="clipboard-list" tint="blue" label="Total Verifications" value={verificationSummary.total} caption={verificationSummary.totalCaption} />
        <StatCard icon="clock" tint="amber" label="Pending" value={verificationSummary.pending} caption={verificationSummary.pendingShare} />
        <StatCard icon="eye" tint="blue" label="In Review" value={verificationSummary.inReview} caption={verificationSummary.inReviewShare} />
        <StatCard icon="shield-check" tint="green" label="Verified" value={verificationSummary.verified} caption={verificationSummary.verifiedShare} />
        <StatCard icon="shield-x" tint="red" label="Rejected" value={verificationSummary.rejected} caption={verificationSummary.rejectedShare} />
        <StatCard icon="calendar-clock" tint="amber" label="Expiring Soon" value={verificationSummary.expiringSoon} caption={verificationSummary.expiringSoonCaption} />
      </div>

      <SectionCard title="" pad="none" style={{ paddingTop: 4 }}>
        <TableToolbar
          search={<SearchField placeholder="Search by company, entity, verification ID..." value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
          filters={<>
            <FilterButton value={entityType} options={['All Types', ...ENTITY_TYPES]} active={entityType !== 'All Types'}
              onChange={(v) => { setEntityType(v); setPage(1); }} />
            <FilterButton value={verType} options={['All Types', ...VERIFICATION_TYPES]} active={verType !== 'All Types'}
              onChange={(v) => { setVerType(v); setPage(1); }} />
            <FilterButton value={status} options={['All Statuses', ...STATUSES]} active={status !== 'All Statuses'}
              onChange={(v) => { setStatus(v); setPage(1); }} />
            <FilterButton value={riskLevel} options={['All Levels', ...RISK_LEVELS]} active={riskLevel !== 'All Levels'}
              onChange={(v) => { setRiskLevel(v); setPage(1); }} />
            <FilterSelect label="Date Range" icon="calendar" />
            <Button variant="outline" icon="list-filter">Filters</Button>
          </>}
          onClear={resetFilters} />

        <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} style={{ padding: '0 var(--tk-card-pad)' }}
          items={['All Verifications',
            { value: 'Pending', label: 'Pending', count: verificationSummary.pending },
            { value: 'In Review', label: 'In Review', count: verificationSummary.inReview },
            { value: 'Verified', label: 'Verified', count: verificationSummary.verified },
            { value: 'Rejected', label: 'Rejected', count: verificationSummary.rejected },
            { value: 'Expiring Soon', label: 'Expiring Soon', count: verificationSummary.expiringSoon }]} />

        <DataTable rows={paged} rowKey={(r) => r.id}
          columns={[
            { key: 'id', header: 'Verification ID', render: (r) => <CopyableId id={r.id} size="sm" /> },
            { key: 'entity', header: 'Entity / Company', render: (r) => (
              <span style={{ display: 'grid', gap: 2 }}>
                <Link to={'/verification/' + r.id} style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.entityName}</Link>
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
                <Icon name={STATUS_ICON[r.status]} size={11} />{r.status}
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
                <Button variant="outline" size="sm" icon="eye" onClick={() => navigate('/verification/' + r.id)}>View</Button>
                <span style={{ position: 'relative' }}>
                  <IconButton icon="ellipsis-vertical" onClick={() => setMenuFor(menuFor === r.id ? null : r.id)} />
                  {menuFor === r.id && (
                    <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }} onMouseLeave={() => setMenuFor(null)}>
                      <DropdownMenu width={210} items={[
                        { label: 'View Verification', icon: 'eye', onClick: () => { setMenuFor(null); navigate('/verification/' + r.id); } },
                        { label: 'Reassign', icon: 'users' },
                        { label: 'Download Documents', icon: 'download' },
                      ]} />
                    </span>
                  )}
                </span>
              </span>) },
          ]} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length}
          pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
          onPage={setPage} onPageSize={() => {}} />
      </SectionCard>
    </>
  );
}
