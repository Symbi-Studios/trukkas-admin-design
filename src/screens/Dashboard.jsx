"use client";
import { usePageSearchState } from '../components/PageSearch.jsx';


import { useMemo, useState } from "react";
import { Link, useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DonutChart,
  DropdownMenu,
  FilterSelect,
  Icon,
  LegendList,
  PageHeader,
  ProgressBar,
  SectionCard,
  Skeleton,
  StatCard,
  StatsPanel,
} from "../ds.js";
import { DEFAULT_STATS_PERIOD, STATS_PERIODS, statsPeriod, statsPeriodDates } from '../domain/statsPeriod.js';
import { formatNaira } from "../mock/format.js";
import { statusTone } from "./JobDetail.jsx";
import { useGetAdminOverviewQuery } from "../store/features/overview/overviewApi.js";
import styles from "./Dashboard.module.css";

const DASHBOARD_STATS_PERIODS = STATS_PERIODS.filter((period) => period.key !== '1d');
const ACTIVITY_PERIODS = ["Last 30 days", "Last 90 days", "This year"];
function dashboardDates(value) {
  if (value === 'All Time') return undefined;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const field = (key) => Number(parts.find((part) => part.type === key).value);
  const today = new Date(Date.UTC(field('year'), field('month') - 1, field('day')));
  const end = new Date(today);
  const start = new Date(today);
  if (value === 'Last 30 days') start.setUTCDate(start.getUTCDate() - 29);
  else if (value === 'Last 90 days') start.setUTCDate(start.getUTCDate() - 89);
  else if (value === 'This year' || value === 'This Year') start.setUTCMonth(0, 1);
  else if (value === 'This Month') start.setUTCDate(1);
  else if (value === 'Last Month') { start.setUTCDate(1); end.setTime(start.getTime() - 86400000); start.setTime(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)); }
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
const REGISTRATION_TABS = [
  "Drivers",
  "Trucking Companies",
  "Forwarders",
  "Exporters",
];
const REGISTRATION_API_GROUP = {
  Drivers: "drivers",
  "Trucking Companies": "truckingCompanies",
  Forwarders: "forwarders",
  Exporters: "exporters",
};
const compactNaira = (value) => formatNaira(value);

function MenuSelect({
  id,
  value,
  options,
  openMenu,
  setOpenMenu,
  onChange,
  icon,
}) {
  return (
    <span className={`${styles.menuWrap} ${id === 'date' ? styles.dateMenu : ''}`}>
      <FilterSelect
        label={value}
        icon={icon}
        active={openMenu === id}
        onClick={() => setOpenMenu(openMenu === id ? null : id)}
        style={id === 'date' ? { maxWidth: '100%', width: '100%', justifyContent: 'center' } : undefined}
      />
      {openMenu === id && (
        <span className={styles.menu}>
          <DropdownMenu
            width={220}
            items={options.map((option) => ({
              label: option,
              icon: option === value ? "check" : undefined,
              onClick: () => {
                onChange(option);
                setOpenMenu(null);
              },
            }))}
          />
        </span>
      )}
    </span>
  );
}

function StarRating({ rating, reviews, trend, breakdown, allTime }) {
  const rows = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    pct: breakdown?.[stars],
  }));
  const trendLabel = Number.isFinite(trend)
    ? `${trend < 0 ? "↓" : "↑"} ${Math.abs(trend)} from ${allTime ? "last month" : "previous period"}`
    : null;
  return (
    <div className={styles.rating}>
      <div className={styles.ratingHead}>
        <span className={styles.starTile}>
          <Icon name="star" size={22} />
        </span>
        <span>
          <strong>{Number.isFinite(rating) ? `${rating.toFixed(1)} / 5` : "—"}</strong>
          <small>Based on {reviews ?? "—"} reviews</small>
          {trendLabel && <em>{trendLabel}</em>}
        </span>
      </div>
      <div className={styles.ratingRows}>
        {rows.map((row) => (
          <div key={row.stars}>
            <span>
              {row.stars} <Icon name="star" size={11} />
            </span>
            <ProgressBar
              value={row.pct ?? 0}
              color={
                row.stars === 5
                  ? "var(--tk-success)"
                  : row.stars === 4
                    ? "var(--tk-teal)"
                    : "var(--tk-warning)"
              }
              height={16}
            />
            <small>{row.pct == null ? "—" : `${row.pct}%`}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

const HEALTH = [
  {
    apiKey: "platformApi",
    icon: "server",
    label: "Platform",
    route: "/settings",
  },
  {
    apiKey: "gpsTracking",
    icon: "map-pin",
    label: "GPS & Tracking",
    route: "/trips?view=map",
  },
  {
    apiKey: "payments",
    icon: "credit-card",
    label: "Payments",
    route: "/transactions",
  },
  {
    apiKey: "notifications",
    icon: "bell",
    label: "Notifications",
    route: "/notifications",
  },
  {
    apiKey: "database",
    icon: "database",
    label: "Database",
    route: "/settings",
  },
];

export function Dashboard() {
  const navigate = useNavigate();
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const dateRange = statsPeriod(statsPeriodKey).summary;
  const statsDates = useMemo(() => statsPeriodDates(statsPeriodKey), [statsPeriodKey]);
  const [activityPeriod, setActivityPeriod] = useState(null);
  const [revenuePeriod, setRevenuePeriod] = useState(null);
  const [ratingPeriod, setRatingPeriod] = useState(null);
  const {
    currentData: overview,
    isLoading: isOverviewLoading,
    isFetching: isOverviewFetching,
    isUninitialized: isOverviewUninitialized,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useGetAdminOverviewQuery(statsDates.from ? statsDates : undefined, { refetchOnMountOrArgChange: true });
  const earningsQuery = useGetAdminOverviewQuery(dashboardDates(revenuePeriod), { skip: revenuePeriod == null, refetchOnMountOrArgChange: true });
  const activityQuery = useGetAdminOverviewQuery(dashboardDates(activityPeriod), { skip: activityPeriod == null, refetchOnMountOrArgChange: true });
  const ratingQuery = useGetAdminOverviewQuery(dashboardDates(ratingPeriod), { skip: ratingPeriod == null, refetchOnMountOrArgChange: true });
  const [registrationTab, setRegistrationTab] = useState("Drivers");
  const [openMenu, setOpenMenu] = useState(null);
  const [query, setQuery] = usePageSearchState("");


  const registrations = useMemo(() => {
    const rows = overview?.recentRegistrations?.[REGISTRATION_API_GROUP[registrationTab]] || [];
    return rows.filter((row) => !query || [row.name, row.contact, row.type].some((field) =>
      String(field || "").toLowerCase().includes(query.toLowerCase()),
    )).slice(0, 5);
  }, [overview, registrationTab, query]);

  const earningsOverview = revenuePeriod == null ? overview : earningsQuery.currentData;
  const activityOverview = activityPeriod == null ? overview : activityQuery.currentData;
  const ratingOverview = ratingPeriod == null ? overview : ratingQuery.currentData;
  const apiTripActivity = activityOverview?.tripActivity;
  const activityTotal = apiTripActivity?.totalTrips;
  const recentJobs = useMemo(() => {
    const rows = overview?.recentJobs || [];
    if (!query) return rows;
    const normalizedQuery = query.toLowerCase();
    return rows.filter((job) =>
      [job.displayId, job.id, job.routeLabel, job.company, job.cargo, job.truckerName].some((field) =>
        String(field || "").toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [overview, query]);
  const activityData = [
    { label: "Completed", value: apiTripActivity?.completed, color: "var(--tk-success)" },
    { label: "In Transit", value: apiTripActivity?.inTransit, color: "var(--tk-blue)" },
    { label: "Scheduled", value: apiTripActivity?.scheduled, color: "var(--tk-purple)" },
    { label: "Cancelled", value: apiTripActivity?.cancelled, color: "var(--tk-danger)" },
  ];
  const activityKnown = activityData.every((item) => item.value != null);
  const earnings = [
    { key: "drivers", label: "Drivers", color: "var(--tk-blue)" },
    { key: "companies", label: "Companies", color: "var(--tk-success)" },
    { key: "platformFees", label: "Platform Fees", color: "var(--tk-warning)" },
    { key: "demurrage", label: "Demurrage", color: "var(--tk-purple)" },
    { key: "otherCosts", label: "Other Costs", color: "var(--tk-ink-300)" },
  ].map((item) => {
    const part = earningsOverview?.earningsBreakdown[item.key];
    return { ...item, value: part?.amount, amount: part?.amount, percent: part?.percent };
  });
  const earningsKnown = earnings.every((item) => item.value != null);
  const routes = (overview?.topRoutesByVolume || []).slice(0, 10).map((route) => ({
    ...route,
    pct: route.percentOfTotal == null ? "—" : `${Number(route.percentOfTotal.toFixed(1))}%`,
  }));
  const rating = ratingOverview?.averageRating.average;
  const reviewCount = ratingOverview?.averageRating.totalReviews;
  const ratingTrend = ratingOverview?.averageRating.trendVsLastMonth;
  const ratingBreakdown = ratingOverview?.averageRating.breakdown;
  const systemHealth = HEALTH.map((item) => ({
    ...item,
    ...(overview?.systemHealth[item.apiKey] || { status: "—", tone: "neutral" }),
  }));

  if (!overview && (isOverviewLoading || isOverviewFetching || isOverviewUninitialized)) {
    return <DashboardLoading />;
  }

  if (!overview && isOverviewError) {
    return <DashboardLoadError onRetry={refetchOverview} />;
  }

  return (
    <div className={styles.dashboard}>
      <PageHeader
        title={
          <>
            Good morning, Super Admin <span aria-hidden="true">👋</span>
          </>
        }
        description={
          <>Here&apos;s what&apos;s happening on Trukkas{statsPeriodKey === 'all' ? ' overall' : ` in the ${dateRange.toLowerCase()}`}.</>
        }
        actions={
          <>
            <blockquote className={styles.motto}>
              <Icon name="quote" size={20} />
              “Connecting People. Moving Africa Forward.”
            </blockquote>
          </>
        }
      />
      <StatsPanel periods={DASHBOARD_STATS_PERIODS} period={statsPeriodKey} onPeriodChange={(key) => { setStatsPeriodKey(key); setRevenuePeriod(null); setActivityPeriod(null); setRatingPeriod(null); }}>
        <StatCard
          icon="user-round"
          label="Total Drivers"
          value={overview?.users.drivers.total ?? "—"}
          delta={overview?.range?.registrations.drivers != null ? String(overview.range.registrations.drivers) : undefined}
          direction="up"
          caption={overview?.range?.registrations.drivers != null ? "New in selected period" : undefined}
        />
        <StatCard
          icon="building-2"
          tint="green"
          label="Trucking Companies"
          value={overview?.users.truckers.total ?? "—"}
          delta={overview?.range?.registrations.truckers != null ? String(overview.range.registrations.truckers) : undefined}
          direction="up"
          caption={overview?.range?.registrations.truckers != null ? "New in selected period" : "—"}
        />
        <StatCard
          icon="users-round"
          tint="purple"
          label="Forwarders"
          value={overview?.users.forwarders.total ?? "—"}
          delta={overview?.range?.registrations.forwarders != null ? String(overview.range.registrations.forwarders) : undefined}
          direction="up"
          caption={overview?.range?.registrations.forwarders != null ? "New in selected period" : undefined}
        />
        <StatCard
          icon="box"
          label="Exporters"
          value={overview?.users.forwarders.exporterCount ?? "—"}
          delta={overview?.range?.registrations.exporters != null ? String(overview.range.registrations.exporters) : undefined}
          caption={overview?.range?.registrations.exporters != null ? "New in selected period" : undefined}
        />
        <StatCard
          icon="truck"
          label="Trucks & Fleet"
          value={overview?.fleet.trucksTotal ?? "—"}
          caption={overview?.fleet.trucksActive != null ? `${overview.fleet.trucksActive} Active` : undefined}
        />
        <StatCard
          icon="route"
          label="Active Trips"
          value={overview?.trips.activeTrips ?? "—"}
          caption="Live operations"
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Completed Jobs"
          value={(statsPeriodKey === 'all' ? overview?.jobs.completed : overview?.range?.jobs.completed) ?? "—"}
          delta={overview?.range?.jobs.completedTrendPercent != null ? `${Math.abs(overview.range.jobs.completedTrendPercent)}%` : undefined}
          direction={(overview?.range?.jobs.completedTrendPercent ?? 0) < 0 ? "down" : "up"}
          caption={overview?.range?.jobs.completedTrendPercent != null ? "Compared with previous period" : undefined}
        />
        <StatCard
          icon="container"
          tint="red"
          label="Containers Moved"
          value={overview?.range?.jobs.containersMoved ?? "—"}
          delta={overview?.range?.jobs.containersMovedTrendPercent != null ? `${Math.abs(overview.range.jobs.containersMovedTrendPercent)}%` : undefined}
          direction={(overview?.range?.jobs.containersMovedTrendPercent ?? 0) < 0 ? "down" : "up"}
          caption="Selected period"
        />
      </StatsPanel>

      <section className={styles.financeGrid}>
        <SectionCard
          title="Top Routes by Volume"
          action={
            <button
              className={styles.linkButton}
              onClick={() => navigate("/jobs")}
            >
              View all
            </button>
          }
          pad="none"
        >
          <div className={styles.routeTable}>
            <div>
              <b>#</b>
              <b>Route (Origin → Destination)</b>
              <b>Trips</b>
              <b>% of Total</b>
            </div>
            {routes.map((route, index) => (
              <button
                type="button"
                key={route.route}
                onClick={() =>
                  navigate(`/jobs?route=${encodeURIComponent(route.route)}`)
                }
              >
                <span>{index + 1}</span>
                <strong>{route.route}</strong>
                <span>{route.trips ?? "—"}</span>
                <span>{route.pct}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Earnings Breakdown"
          action={
            <MenuSelect
              id="earnings"
              value={revenuePeriod ?? (statsPeriodKey === "all" ? "This Month" : dateRange)}
              options={["This Month", "Last Month", "This Year"]}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onChange={setRevenuePeriod}
            />
          }
        >
          {revenuePeriod != null && !earningsOverview ? (earningsQuery.isError ? <span className="tk-meta">—</span> : <Skeleton height={150} />) : <div className={styles.earnings}>
            <DonutChart
              size={150}
              thickness={20}
              data={earningsKnown ? earnings : []}
              centerValue={earningsOverview?.earningsBreakdown.totalOrders == null ? "—" : compactNaira(earningsOverview.earningsBreakdown.totalOrders)}
              centerLabel="Total Orders"
            />
            <LegendList
              style={{ width: "100%" }}
              showShare={earnings.every((item) => item.percent != null)}
              items={earnings.map((item) => ({
                ...item,
                display: item.amount == null ? "—" : compactNaira(item.amount),
              }))}
            />
          </div>}
        </SectionCard>
      </section>

      <section className={styles.insightsGrid}>
        <SectionCard
          title="Trip Activity"
          action={
            <MenuSelect
              id="activity"
              value={activityPeriod ?? (statsPeriodKey === "all" ? "Last 30 days" : dateRange)}
              options={ACTIVITY_PERIODS}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onChange={setActivityPeriod}
            />
          }
        >
          {activityPeriod != null && !activityOverview ? (activityQuery.isError ? <span className="tk-meta">—</span> : <Skeleton height={150} />) : <div className={styles.activity}>
            <DonutChart
              size={150}
              thickness={20}
              data={activityKnown ? activityData : []}
              centerValue={activityTotal ?? "—"}
              centerLabel="Total Trips"
            />
            <LegendList style={{ width: "100%" }} showShare={activityKnown} items={activityData.map((item) => ({ ...item, display: item.value ?? "—" }))} />
          </div>}
        </SectionCard>
        <SectionCard
          title="Average Rating"
          action={
            <MenuSelect
              id="rating"
              value={ratingPeriod ?? (statsPeriodKey === "all" ? "All Time" : dateRange)}
              options={["All Time", "This Month", "This Year"]}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onChange={setRatingPeriod}
            />
          }
        >
          {ratingPeriod != null && !ratingOverview ? (ratingQuery.isError ? <span className="tk-meta">—</span> : <Skeleton height={150} />) : <StarRating
            rating={rating}
            reviews={reviewCount}
            trend={ratingTrend}
            breakdown={ratingBreakdown}
            allTime={ratingPeriod === "All Time" || ratingPeriod == null && statsPeriodKey === "all"}
          />}
        </SectionCard>
        <SectionCard
          title="System Health"
          action={
            <button
              className={styles.linkButton}
              onClick={() => navigate("/settings")}
            >
              View all
            </button>
          }
          pad="none"
        >
          <div className={styles.healthList}>
            {systemHealth.map((item) => (
              <button
                type="button"
                key={item.label}
                onClick={() => navigate(item.route)}
              >
                <span className={`${styles.healthIcon} ${styles[item.tone]}`}>
                  <Icon name={item.icon} size={16} />
                </span>
                <strong>{item.label}</strong>
                <Badge tone={item.tone} dot>
                  {item.status}
                </Badge>
              </button>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className={styles.tablesGrid}>
        <SectionCard
          title="Recent Jobs"
          action={
            <button
              className={styles.linkButton}
              onClick={() => navigate("/jobs")}
            >
              View all
            </button>
          }
          pad="none"
        >
          <div className={styles.compactTable}>
            <DataTable
              rows={recentJobs}
              rowKey={(job) => job.id}
              onRowClick={(job) => navigate(`/jobs/detail?id=${encodeURIComponent(job.id)}`)}
              columns={[
                {
                  key: "id",
                  header: "Job ID",
                  render: (job) => <Link to={`/jobs/detail?id=${encodeURIComponent(job.id)}`}>{job.displayId || job.id}</Link>,
                },
                {
                  key: "route",
                  header: "Route",
                  render: (job) => job.routeLabel,
                },
                { key: "cargo", header: "Cargo", render: (job) => job.cargo || "—" },
                { key: "company", header: "Forwarder / Exporter", render: (job) => job.company || "—" },
                {
                  key: "status",
                  header: "Status",
                  render: (job) => (
                    <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                  ),
                },
                {
                  key: "value",
                  header: "Value",
                  align: "right",
                  render: (job) => <strong>{job.value == null ? "—" : formatNaira(job.value)}</strong>,
                },
              ]}
            />
          </div>
        </SectionCard>
        <SectionCard
          title="Recent Registrations"
          action={
            <button
              className={styles.linkButton}
              onClick={() =>
                navigate(
                  registrationTab === "Drivers"
                    ? "/drivers"
                    : registrationTab === "Trucking Companies"
                      ? "/companies"
                      : "/forwarders",
                )
              }
            >
              View all
            </button>
          }
          pad="none"
        >
          <div className={styles.registrationTabs}>
            {REGISTRATION_TABS.map((tab) => (
              <button
                type="button"
                key={tab}
                className={registrationTab === tab ? styles.activeRegTab : ""}
                onClick={() => setRegistrationTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className={styles.compactTable}>
            <DataTable
              rows={registrations}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(row.route)}
              columns={[
                {
                  key: "name",
                  header: "Name",
                  render: (row) => (
                    <span className={styles.person}>
                      <Avatar name={row.avatar} size={24} />
                      <strong>{row.name}</strong>
                    </span>
                  ),
                },
                {
                  key: "type",
                  header: "Type",
                  render: (row) => (
                    <Badge tone={row.type === "Company" ? "info" : "neutral"}>
                      {row.type}
                    </Badge>
                  ),
                },
                { key: "contact", header: "Contact" },
                { key: "joined", header: "Joined" },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                  ),
                },
              ]}
            />
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function DashboardLoadingTable({ columns = 4, rows = 5 }) {
  const widths = ["42%", "76%", "58%", "64%", "50%"];

  return (
    <div className={styles.loadingTableRows} aria-hidden="true">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          className={styles.loadingTableRow}
          key={rowIndex}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              height={11}
              width={widths[(rowIndex + columnIndex) % widths.length]}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function DashboardLoading() {
  const statCards = [
    ["user-round", "Total Drivers"],
    ["building-2", "Trucking Companies"],
    ["users-round", "Forwarders"],
    ["box", "Exporters"],
    ["truck", "Trucks & Fleet"],
    ["route", "Active Trips"],
    ["circle-check", "Completed Jobs"],
    ["container", "Containers Moved"],
  ];

  return (
    <div className={styles.dashboard} aria-busy="true">
      <div className={styles.loadingHeader}>
        <div className={styles.loadingHeaderTitle} aria-hidden="true">
          <Skeleton width={250} height={28} />
          <Skeleton width={330} height={14} />
        </div>
        <div className={styles.loadingHeaderControls} aria-hidden="true">
          <Skeleton width={220} height={42} radius={10} />
          <Skeleton width={150} height={42} radius={10} />
        </div>
      </div>

      <div className={styles.loadingNotice} role="status" aria-live="polite">
        <span className={styles.loadingNoticeDot} aria-hidden="true" />
        Loading dashboard data…
      </div>

      <section className={styles.stats} aria-label="Loading platform summary">
        {statCards.map(([icon, label]) => (
          <StatCard
            key={label}
            icon={icon}
            label={label}
            value={<Skeleton as="span" width={54} height={23} />}
            caption={<Skeleton as="span" width={96} height={11} />}
          />
        ))}
      </section>

      <section className={styles.financeGrid} aria-hidden="true">
        <SectionCard title="Top Routes by Volume" pad="none">
          <DashboardLoadingTable columns={4} />
        </SectionCard>
        <SectionCard title="Earnings Breakdown">
          <div className={styles.loadingChart}>
            <Skeleton width={150} height={150} radius={75} />
            <DashboardLoadingTable columns={2} rows={4} />
          </div>
        </SectionCard>
      </section>

      <section className={styles.insightsGrid} aria-hidden="true">
        <SectionCard title="Trip Activity">
          <div className={styles.loadingChart}>
            <Skeleton width={142} height={142} radius={71} />
            <DashboardLoadingTable columns={2} rows={4} />
          </div>
        </SectionCard>
        <SectionCard title="Average Rating">
          <div className={styles.loadingRating}>
            <Skeleton width={72} height={28} />
            <DashboardLoadingTable columns={2} rows={5} />
          </div>
        </SectionCard>
        <SectionCard title="System Health" pad="none">
          <DashboardLoadingTable columns={3} rows={5} />
        </SectionCard>
      </section>

      <section className={styles.tablesGrid} aria-hidden="true">
        <SectionCard title="Recent Jobs" pad="none">
          <DashboardLoadingTable columns={6} />
        </SectionCard>
        <SectionCard title="Recent Registrations" pad="none">
          <div className={styles.loadingTabs}>
            <Skeleton width={72} height={28} radius={8} />
            <Skeleton width={116} height={28} radius={8} />
            <Skeleton width={82} height={28} radius={8} />
            <Skeleton width={72} height={28} radius={8} />
          </div>
          <DashboardLoadingTable columns={5} />
        </SectionCard>
      </section>
    </div>
  );
}

function DashboardLoadError({ onRetry }) {
  return (
    <div className={styles.dashboard}>
      <Card className={styles.loadError}>
        <span className={styles.loadErrorIcon} aria-hidden="true">!</span>
        <h1>Dashboard data couldn’t be loaded</h1>
        <p>Check your connection and try loading the overview again.</p>
        <Button onClick={onRetry}>Try again</Button>
      </Card>
    </div>
  );
}
