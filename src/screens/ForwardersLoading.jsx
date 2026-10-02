import { Card, Skeleton, StatCard } from '../ds.js';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import './ForwarderDetail.css';
export function ForwardersLoading() {
  return <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }} aria-busy="true">
    <Skeleton width={250} height={28} /><Skeleton width="60%" height={14} /><DriverLoadingNotice>Loading forwarders…</DriverLoadingNotice>
    <div className="fw-stats">{['Total Forwarders', 'Active Forwarders', 'Exporters', 'Pending Verification', 'Suspended', 'Total Spend (₦)'].map((label) => <StatCard key={label} icon="users" label={label} value={<Skeleton as="span" width={60} height={23} />} caption={<Skeleton as="span" width={85} height={11} />} />)}</div>
    <Card><Skeleton height={38} /></Card><div className="fw-layout"><Card pad="none"><DriverTableLoading columns={10} label="Loading forwarders" /></Card><div style={{ display: 'grid', gap: 20 }}>{[0, 1, 2].map((item) => <Card key={item}><Skeleton width="60%" height={18} /><Skeleton height={140} style={{ marginTop: 20 }} /></Card>)}</div></div>
  </div>;
}
export function ForwarderDetailLoading() {
  return <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }} aria-busy="true"><Skeleton width={230} height={28} /><DriverLoadingNotice>Loading forwarder details…</DriverLoadingNotice><Card><Skeleton height={120} /></Card><Card><Skeleton height={36} /></Card><div className="fd-main">{[0, 1, 2].map((item) => <Card key={item}><Skeleton height={200} /></Card>)}</div></div>;
}
