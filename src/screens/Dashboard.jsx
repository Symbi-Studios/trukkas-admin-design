"use client";


import { useMemo } from "react";
import { Link, useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DonutChart,
  Icon,
  LegendList,
  PageHeader,
  ProgressBar,
  SectionCard,
  Skeleton,
  StatCard,
  StatsPanel,
} from "../ds.js";
import { formatNaira } from "../mock/format.js";
import { statusTone } from "./JobDetail.jsx";
import { useGetAdminOverviewQuery } from "../store/features/overview/overviewApi.js";
import styles from "./Dashboard.module.css";

const compactNaira = (value) => formatNaira(value);

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
  const {
    currentData: overview,
    isLoading: isOverviewLoading,
    isFetching: isOverviewFetching,
    isUninitialized: isOverviewUninitialized,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useGetAdminOverviewQuery(undefined, { refetchOnMountOrArgChange: true });
  const registrations = useMemo(() => {
    const records = Object.values(overview?.recentRegistrations || {}).flat();
    return [...new Map(records.map((row) => [row.id, row])).values()]
      .sort((a, b) => (b.joinedTimestamp ?? -Infinity) - (a.joinedTimestamp ?? -Infinity))
      .slice(0, 5);
  }, [overview]);

  const earningsOverview = overview;
  const activityOverview = overview;
  const ratingOverview = overview;
  const apiTripActivity = activityOverview?.tripActivity;
  const activityTotal = apiTripActivity?.totalTrips;
  const recentJobs = overview?.recentJobs || [];
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
          <>Here&apos;s what&apos;s happening on Trukkas overall.</>
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
      <StatsPanel>
        <StatCard
          icon="user-round"
          label="Total Drivers"
          value={overview?.users.drivers.total ?? "—"}
          direction="up"
        />
        <StatCard
          icon="building-2"
          tint="green"
          label="Trucking Companies"
          value={overview?.users.truckers.total ?? "—"}
          direction="up"
        />
        <StatCard
          icon="users-round"
          tint="purple"
          label="Forwarders"
          value={overview?.users.forwarders.total ?? "—"}
          direction="up"
        />
        <StatCard
          icon="box"
          label="Exporters"
          value={overview?.users.forwarders.exporterCount ?? "—"}
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
          value={overview?.jobs.completed ?? "—"}
        />
        <StatCard
          icon="container"
          tint="red"
          label="Containers Moved"
          value={overview?.trips.containersMovedThisMonth ?? "—"}
          delta={overview?.trips.containersMovedTrendPercent != null ? `${Math.abs(overview.trips.containersMovedTrendPercent)}%` : undefined}
          direction={(overview?.trips.containersMovedTrendPercent ?? 0) < 0 ? "down" : "up"}
          caption="This month"
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
          description="This month"
        >
          <div className={styles.earnings}>
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
          </div>
        </SectionCard>
      </section>

      <section className={styles.insightsGrid}>
        <SectionCard
          title="Trip Activity"
          description="Last 30 days"
        >
          <div className={styles.activity}>
            <DonutChart
              size={150}
              thickness={20}
              data={activityKnown ? activityData : []}
              centerValue={activityTotal ?? "—"}
              centerLabel="Total Trips"
            />
            <LegendList style={{ width: "100%" }} showShare={activityKnown} items={activityData.map((item) => ({ ...item, display: item.value ?? "—" }))} />
          </div>
        </SectionCard>
        <SectionCard
          title="Average Rating"
          description="All time"
        >
          <StarRating
            rating={rating}
            reviews={reviewCount}
            trend={ratingTrend}
            breakdown={ratingBreakdown}
            allTime
          />
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
              onClick={() => navigate("/users")}
            >
              View all
            </button>
          }
          pad="none"
        >
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
          <Skeleton width={350} height={42} radius={10} />
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
