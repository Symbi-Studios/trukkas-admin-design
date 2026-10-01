import { Card, Skeleton, StatCard } from '../ds.js';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import './TruckingCompanies.css';

export function CompaniesLoading() {
  return <div className="tc-page" aria-busy="true">
    <div style={{ display: 'grid', gap: 12 }} aria-hidden="true"><Skeleton width={240} height={28} /><Skeleton width="55%" height={14} /></div>
    <DriverLoadingNotice>Loading companies…</DriverLoadingNotice>
    <div className="tc-stat-grid tc-stat-grid-primary">{['Total Companies', 'Active Companies', 'Verified Companies', 'Pending Review', 'Suspended Companies'].map((label) => <StatCard key={label} icon="building-2" label={label} value={<Skeleton as="span" width={54} height={23} />} caption={<Skeleton as="span" width={86} height={11} />} />)}</div>
    <div className="tc-stat-grid tc-stat-grid-secondary">{['Total Trucks', 'Total Drivers', 'Active Trucks', 'Paid Out Amount'].map((label) => <StatCard key={label} icon="truck" label={label} value={<Skeleton as="span" width={70} height={23} />} />)}</div>
    <Card aria-hidden="true"><Skeleton height={38} /></Card>
    <div className="tc-content-grid"><Card pad="none"><DriverTableLoading columns={9} label="Loading companies" /></Card><aside className="tc-rail">{[0, 1, 2].map((item) => <Card key={item}><Skeleton width="60%" height={18} /><div style={{ marginTop: 20 }}><Skeleton height={140} /></div></Card>)}</aside></div>
  </div>;
}

export function CompanyDetailLoading() {
  return <div className="company-page" aria-busy="true"><Skeleton width={230} height={28} /><DriverLoadingNotice>Loading company details…</DriverLoadingNotice><Card><Skeleton height={110} /></Card><Card><Skeleton height={36} /></Card><div className="company-stats company-stats-five">{[0, 1, 2, 3, 4].map((item) => <Card key={item}><Skeleton height={70} /></Card>)}</div><Card><DriverTableLoading columns={5} label="Loading company details" /></Card></div>;
}
