'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavigate, useParams } from '../router.js';
import {
  PageHeader, Button, Badge, Tag, Card, SectionCard, LabelValue, DataTable, DropdownMenu,
  Avatar, Icon, Skeleton,
} from '../ds.js';
import { unavailableFeeRule, useGetAdminFeeRuleQuery, useGetAdminFeeRuleHistoryQuery, editableFeeRule } from '../store/features/fees/feesApi.js';
import { useFeeOperations } from '../store/features/fees/useFeeOperations.js';
import { FeeRuleEditDialog } from './FeeRuleDialogs.jsx';
import { DriverTableLoading } from './DriversLoading.jsx';

function Fact({ icon, iconTint = 'blue', label, value }) {
  const TINT = {
    blue: ['var(--tk-blue-soft)', 'var(--tk-blue)'],
    green: ['var(--tk-success-soft)', 'var(--tk-success)'],
    amber: ['var(--tk-warning-soft)', 'var(--tk-warning)'],
    purple: ['var(--tk-purple-soft)', 'var(--tk-purple)'],
    teal: ['var(--tk-teal-soft)', 'var(--tk-teal)'],
  };
  const [bg, fg] = TINT[iconTint] || TINT.blue;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', minWidth: 0 }}>
      <span style={{ width: 34, height: 34, borderRadius: 'var(--tk-r-sm)', background: bg, color: fg,
                     display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
        <Icon name={icon} size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>{label}</span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere', font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function FeeRuleDetail() {
  const { ruleId } = useParams();
  const navigate = useNavigate();
  const search = useSearchParams(), id = search.get('id') || ruleId || '';
  const operations = useFeeOperations();
  const query = useGetAdminFeeRuleQuery({ id, owner: operations.owner }, { skip: !id || !operations.authenticated });
  const r = operations.authenticated && !query.error ? query.currentData || unavailableFeeRule : unavailableFeeRule;
  const historyQuery = useGetAdminFeeRuleHistoryQuery({ id, owner: operations.owner }, { skip: !id || !operations.authenticated || !query.currentData || Boolean(query.error) });
  const auditHistory = operations.authenticated && !query.error && !historyQuery.error ? historyQuery.currentData || [] : [];
  const loading = query.isLoading || (query.isFetching && !query.currentData);
  const value = (content) => loading ? <Skeleton as="span" width={100} height={16} /> : content;
  const confirmedMissing = !loading && query.error?.status === 404;
  const [menu, setMenu] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (confirmedMissing) {
    return (
      <Card>
        <span className="tk-body">No fee rule found with ID {id}.</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/fees')}>Back to Fee Rules</Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <PageHeader crumbs={['Finance', 'Fees & Commission', 'Fee Rules', 'View Fee Rule']} title="View Fee Rule"
        description="Detailed information about this fee rule and how it is applied."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/fees')}>Back to Fee Rules</Button>
          <Button variant="outline" icon="pencil" disabled={loading || query.isFetching || operations.busy || !operations.canManage || !editableFeeRule(r)} onClick={() => setEditOpen(true)}>Edit Fee Rule</Button>
          <span style={{ position: 'relative' }}>
            <Button variant="secondary" iconRight="ellipsis-vertical" onClick={() => setMenu((m) => !m)}>More Actions</Button>
            {menu && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setMenu(false)}>
                <DropdownMenu width={220} items={[
                  { label: 'Duplicate Fee Rule', icon: 'copy', onClick: () => { setMenu(false); operations.unavailable('Duplicating fee rules'); } },
                  { label: r.status === 'Active' ? 'Deactivate Rule' : 'Activate Rule', icon: 'circle-slash', disabled: loading || query.isFetching || operations.busy || !operations.canManage || !editableFeeRule(r), onClick: () => { setMenu(false); void operations.toggle(r); } },
                  { divider: true },
                  { label: 'Export Rule Details', icon: 'file-text', disabled: loading || !query.currentData || Boolean(query.error), onClick: () => { setMenu(false); void operations.download('rule', 'csv', r); } },
                  { divider: true },
                  { label: 'Delete Fee Rule', icon: 'trash-2', tone: 'danger', onClick: () => { setMenu(false); operations.unavailable('Deleting fee rules'); } },
                ]} />
              </span>
            )}
          </span>
        </>} />

      <Card style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ width: 56, height: 56, borderRadius: 'var(--tk-r-lg)', background: 'var(--tk-success-soft)',
                         color: 'var(--tk-success)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
            <Icon name={r.icon} size={26} />
          </span>
          <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="tk-title" style={{ fontSize: 22 }}>{value(r.name)}</h2>
              <Badge>{r.status}</Badge>
            </div>
            <span className="tk-meta">{value(r.description)}</span>
            {r.systemRule && <Tag tone="blue" style={{ justifySelf: 'start' }}>System Rule</Tag>}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid var(--tk-line)', paddingTop: 16 }}>
          {[
            { label: 'Rule ID', value: r.id },
            { label: 'Created By', value: r.createdBy },
            { label: 'Created On', value: r.createdOn },
            { label: 'Last Updated', value: r.lastUpdated },
          ].map((f, i) => (
            <div key={f.label} style={{ flex: '1 1 150px', padding: '0 18px', borderLeft: i ? '1px solid var(--tk-line)' : 'none' }}>
              <div className="tk-meta" style={{ marginBottom: 4 }}>{f.label}</div>
              <div style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{value(f.value)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Rule Details">
          <LabelValue label="Rule Name" value={value(r.name)} />
          <LabelValue label="Description" value={value(r.description)} />
          <LabelValue label="Status" value={<Badge>{r.status}</Badge>} />
          <LabelValue label="Priority" value={value(r.priority)} />
          <LabelValue label="Calculation Type" value={value(r.calcType)} />
          <LabelValue label="Rate" value={value(r.rate)} />
          <LabelValue label="Minimum Fee" value={value(r.minFee)} />
          <LabelValue label="Maximum Fee" value={value(r.maxFee)} />
          <LabelValue label="Currency" value={value(r.currency)} />
          <LabelValue label="Effective From" value={value(r.effectiveFrom)} />
          <LabelValue label="Effective To" value={value(r.effectiveTo)} />
          <LabelValue label="Applicable On" value={value(r.applicableOn)} />
          <LabelValue label="Rounding" value={value(r.rounding)} />
          <LabelValue label="Tax Inclusive" value={value(r.taxInclusive)} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Applies To" pad="none" style={{ padding: '4px var(--tk-card-pad) 8px' }}>
            <Fact icon="users" iconTint="blue" label="Applies To" value={value(r.appliesTo)} />
            <Fact icon="calendar" iconTint="amber" label="User Types" value={value(r.userTypes)} />
            <Fact icon="package" iconTint="purple" label="Job Types" value={value(r.jobTypes)} />
            <Fact icon="boxes" iconTint="teal" label="Cargo Types" value={value(r.cargoTypes)} />
            <Fact icon="map-pin" iconTint="amber" label="Locations" value={value(r.locations)} />
            <Fact icon="filter" iconTint="blue" label="Other Conditions" value={value(r.otherConditions)} />
          </SectionCard>

          <div style={{ borderRadius: 'var(--tk-r-lg)', border: '1px solid var(--tk-success-soft)',
                        background: 'var(--tk-success-soft)', padding: 'var(--tk-card-pad)',
                        display: 'grid', gap: 16 }}>
            <span style={{ font: '600 16px/22px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>Calculation Logic</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <span className="tk-meta" style={{ textTransform: 'uppercase', letterSpacing: '.4px' }}>Formula</span>
                <span style={{ font: '700 18px/24px var(--tk-font-mono)', color: 'var(--tk-ink-900)' }}>{value(r.formula)}</span>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <span className="tk-meta" style={{ textTransform: 'uppercase', letterSpacing: '.4px' }}>Example Calculation</span>
                <span style={{ font: '400 13px/20px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>
                  {r.exampleInputLabel}: {value(r.exampleJobValue)}<br />Fee: {value(r.exampleFee)}
                </span>
              </div>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8,
                           font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-success)' }}>
              <Icon name="circle-check" size={15} />{value(r.exampleNote)}
            </span>
          </div>
        </div>
      </div>

      <SectionCard title="Audit History" pad="none" action={
        <span style={{ position: 'relative' }}>
          <Button variant="outline" iconRight="chevron-down" size="sm" disabled={!operations.authenticated || !query.currentData || Boolean(query.error) || historyQuery.isFetching} onClick={() => { if (!historyQuery.isUninitialized) void historyQuery.refetch(); }}>View Full Audit Log</Button>
        </span>}>
        {historyQuery.isLoading ? <DriverTableLoading columns={4} label="Loading fee rule history" /> : <DataTable rows={auditHistory} rowKey={(row) => row.id}
          columns={[
            { key: 'date', header: 'Date & Time' },
            { key: 'action', header: 'Action', render: (row) => <Badge tone={row.action === 'Created' ? 'info' : 'warning'}>{row.action}</Badge> },
            { key: 'by', header: 'Performed By', render: (row) => (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={row.by} size={24} />{row.by}
              </span>) },
            { key: 'changes', header: 'Changes' },
          ]} />}
      </SectionCard>
      {editOpen && <FeeRuleEditDialog key={id} rule={r} canManage={operations.canManage} onClose={() => setEditOpen(false)} />}
    </>
  );
}
