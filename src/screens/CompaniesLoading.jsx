import { Card, SectionCard, Skeleton, StatCard, StatsPanel } from '../ds.js';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import './TruckingCompanies.css';

export function CompaniesLoading() {
  return <div className="tc-page" aria-busy="true">
    <div style={{ display: 'grid', gap: 12 }} aria-hidden="true"><Skeleton width={240} height={28} /><Skeleton width="55%" height={14} /></div>
    <DriverLoadingNotice>Loading companies…</DriverLoadingNotice>
    <StatsPanel title="Trucking Companies" fixedLabel="All time">
      {['Total Companies', 'Pending Review', 'Verified', 'Suspended', 'Trucks'].map((label) => <StatCard key={label} icon="building-2" label={label} value={<Skeleton as="span" width={54} height={23} />} caption={<Skeleton as="span" width={86} height={11} />} />)}
    </StatsPanel>
    <SectionCard pad="none"><DriverTableLoading columns={7} label="Loading companies" /></SectionCard>
  </div>;
}

export function CompanyDetailLoading() {
  return <div className="company-page" aria-busy="true"><Skeleton width={230} height={28} /><DriverLoadingNotice>Loading company details…</DriverLoadingNotice><Card><Skeleton height={110} /></Card><Card><Skeleton height={36} /></Card><div className="company-stats company-stats-five">{[0, 1, 2, 3, 4].map((item) => <Card key={item}><Skeleton height={70} /></Card>)}</div><Card><DriverTableLoading columns={5} label="Loading company details" /></Card></div>;
}
