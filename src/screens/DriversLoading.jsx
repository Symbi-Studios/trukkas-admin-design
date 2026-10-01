import { Card, Skeleton, StatCard } from '../ds.js';
import styles from './DriversLoading.module.css';

export function DriverLoadingNotice({ children }) {
  return <div className={styles.notice} role="status" aria-live="polite">
    <span className={styles.dot} aria-hidden="true" />{children}
  </div>;
}

export function DriverTableLoading({ columns = 11, label = 'Loading drivers' }) {
  const widths = ['78%', '84%', '68%', '76%', '60%', '72%', '80%', '66%', '62%', '48%', '70%'];
  return <div aria-busy="true" role="status" aria-label={label} className={styles.table}>
    <div aria-hidden="true">
      {Array.from({ length: 8 }, (_, row) => <div className={styles.row} key={row} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, minWidth: columns >= 9 ? 1100 : columns * 130 }}>
        {widths.slice(0, columns).map((width, column) => <Skeleton key={column} width={width} height={11} />)}
      </div>)}
    </div>
  </div>;
}

export function DriversLoading() {
  const metrics = [
    ['users', 'Total Drivers', 'blue'], ['user', 'Individual Drivers', 'green'],
    ['building-2', 'Company Drivers', 'navy'], ['clock', 'Pending Review', 'amber'],
    ['circle-check', 'Approved / Active', 'green'],
  ];
  const secondary = [
    ['route', 'On Trip', 'blue'], ['circle-minus', 'Inactive', 'navy'],
    ['circle-x', 'Rejected', 'red'], ['triangle-alert', 'Documents Expiring', 'amber'],
    ['wallet', 'Total Driver Earnings', 'green'], ['star', 'Average Rating', 'amber'],
  ];
  const metric = ([icon, label, tint]) => <StatCard key={label} icon={icon} label={label} tint={tint}
    value={<Skeleton as="span" width={54} height={23} />}
    caption={<Skeleton as="span" width={86} height={11} />} />;

  return <div className={styles.page} aria-busy="true">
    <div className={styles.header} aria-hidden="true">
      <div className={styles.title}><Skeleton width={190} height={28} /><Skeleton width={330} height={14} /></div>
      <Skeleton width={318} height={42} radius={10} />
    </div>
    <DriverLoadingNotice>Loading drivers…</DriverLoadingNotice>
    <div className={styles.metrics} aria-label="Loading driver summary">{metrics.map(metric)}</div>
    <div className={styles.secondary} aria-hidden="true">{secondary.map(metric)}</div>
    <div className={styles.layout}>
      <Card pad="none">
        <div className={styles.tools} aria-hidden="true"><Skeleton width={280} height={38} radius={8} />{[110, 100, 130, 120].map((width, index) => <Skeleton key={index} width={width} height={38} radius={8} />)}</div>
        <div className={styles.tabs} aria-hidden="true">{[90, 130, 60, 70, 65, 70].map((width, index) => <Skeleton key={index} width={width} height={13} />)}</div>
        <DriverTableLoading />
      </Card>
      <div className={styles.rail} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <Card key={index}><Skeleton width="60%" height={18} /><div style={{ marginTop: 20 }}><Skeleton height={index === 0 ? 140 : 180} /></div></Card>)}
      </div>
    </div>
  </div>;
}

export function DriverLicenseLoading() {
  return <div className={styles.license} aria-busy="true" role="status" aria-label="Loading driver license">
    <div aria-hidden="true" className={styles.fields}>
      {Array.from({ length: 3 }, (_, index) => <div className={styles.title} key={index}><Skeleton width={110} height={12} /><Skeleton width={150} height={18} /></div>)}
    </div>
    <Skeleton width={180} height={38} radius={8} />
  </div>;
}

export function DriverDetailLoading() {
  return <div className={styles.page} aria-busy="true">
    <Card aria-hidden="true"><Skeleton width={180} height={26} /><div style={{ marginTop: 14 }}><Skeleton width="55%" height={14} /></div></Card>
    <DriverLoadingNotice>Loading driver details…</DriverLoadingNotice>
    <Card aria-hidden="true"><div className={styles.hero}><Skeleton width={64} height={64} radius={32} /><div className={styles.title}><Skeleton width={190} height={24} /><Skeleton width={140} height={12} /></div></div></Card>
    <Card aria-hidden="true"><Skeleton width={170} height={20} /><div className={styles.fields} style={{ marginTop: 24 }}>
      {Array.from({ length: 7 }, (_, index) => <div className={styles.title} key={index}><Skeleton width={100} height={12} /><Skeleton width={150} height={18} /></div>)}
    </div></Card>
    <Card><Skeleton width={150} height={20} /><div style={{ marginTop: 24 }}><DriverLicenseLoading /></div></Card>
  </div>;
}
