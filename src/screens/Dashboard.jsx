"use client";


import { useMemo } from "react";
import { useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DonutChart,
  Icon,
  LegendList,
  PageHeader,
  SectionCard,
  Skeleton,
  StatCard,
  TK_STATUS,
  StatsPanel,
} from "../ds.js";
import { formatNaira } from "../mock/format.js";
import { formatNairaShort } from "../lib/money.js";
import { statusTone } from "../domain/jobStatus";
import { useGetAdminOverviewQuery } from "../store/features/overview/overviewApi.js";
import styles from "./Dashboard.module.css";

const compactNaira = (value) => formatNaira(value);

const numberFormat = new Intl.NumberFormat("en-NG");
const formatCount = (value) => (Number.isFinite(value) ? numberFormat.format(value) : "—");

/** "Apapa → Kano", "Apapa - Kano", "Apapa to Kano" → ["Apapa", "Kano"]. */
function splitRoute(label) {
  const text = String(label ?? "").trim();
  const parts = text.split(/\s*(?:→|->|⇒|–|—|\s-\s|\bto\b)\s*/i).filter(Boolean);
  return parts.length >= 2 ? [parts[0], parts.slice(1).join(" → ")] : [text || "—", null];
}

function RouteLabel({ route, className }) {
  const [from, to] = splitRoute(route);
  return (
    <span className={`${styles.routeLabel}${className ? ` ${className}` : ""}`}>
      <span>{from}</span>
      {to && (
        <>
          <Icon name="arrow-right" size={12} aria-hidden="true" />
          <span>{to}</span>
        </>
      )}
    </span>
  );
}

function TopRoutes({ routes, onSelect }) {
  if (!routes.length) {
    return (
      <div className={styles.sectionEmpty}>
        <Icon name="route" size={20} />
        <strong>No route volume yet</strong>
        <span>Routes rank here once trips are completed.</span>
      </div>
    );
  }
  const max = Math.max(...routes.map((route) => route.trips ?? 0), 1);
  return (
    <div className={styles.routes}>
      <ol className={styles.routeList}>
        {routes.map((route, index) => {
          const width = route.trips == null ? 0 : Math.max((route.trips / max) * 100, 2);
          return (
            <li key={route.route}>
              <button
                type="button"
                onClick={() => onSelect(route)}
                title={`${route.route} · ${formatCount(route.trips)} ${route.trips === 1 ? "trip" : "trips"} · ${route.pct} of total`}
              >
                <span className={`${styles.rank} ${index < 3 ? styles.rankTop : ""}`}>{index + 1}</span>
                <span className={styles.routeBody}>
                  <span className={styles.routeHead}>
                    <RouteLabel route={route.route} />
                    <span className={styles.routeStats}>
                      <span className={styles.routeTrips}>
                        {formatCount(route.trips)} {route.trips === 1 ? "trip" : "trips"}
                      </span>
                      <strong className={styles.routeShare}>{route.pct}</strong>
                    </span>
                  </span>
                  <span className={styles.routeBar} aria-hidden="true">
                    <span
                      className={index === 0 ? styles.routeBarLead : undefined}
                      style={{ width: `${width}%` }}
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const STAR_PATH =
  "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z";

function StarRow({ value, size = 18 }) {
  const fill = Number.isFinite(value) ? Math.min(Math.max(value / 5, 0), 1) * 100 : 0;
  const row = (className) => (
    <span className={className}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path d={STAR_PATH} fill="currentColor" />
        </svg>
      ))}
    </span>
  );
  return (
    <span
      className={styles.starRow}
      role="img"
      aria-label={Number.isFinite(value) ? `${value.toFixed(1)} out of 5 stars` : "No rating"}
    >
      {row(styles.starBase)}
      <span className={styles.starFill} style={{ width: `${fill}%` }}>
        {row(styles.starFillRow)}
      </span>
    </span>
  );
}

function StarRating({ rating, reviews, trend, breakdown }) {
  const rows = [5, 4, 3, 2, 1].map((stars) => ({ stars, pct: breakdown?.[stars] }));
  const known = rows.every((row) => row.pct != null);
  const maxPct = Math.max(...rows.map((row) => row.pct ?? 0), 1);
  const positive = known ? rows[0].pct + rows[1].pct : null;
  const trendTone = !Number.isFinite(trend) ? null : trend < 0 ? styles.trendDown : styles.trendUp;

  return (
    <div className={styles.rating}>
      <div className={styles.ratingHero}>
        <strong className={styles.ratingScore}>
          {Number.isFinite(rating) ? rating.toFixed(1) : "—"}
          <small>/ 5</small>
        </strong>
        <span className={styles.ratingMeta}>
          <StarRow value={rating} />
          <span>{formatCount(reviews)} reviews</span>
        </span>
        {trendTone && (
          <span className={`${styles.trendPill} ${trendTone}`} title="Change vs last month">
            <Icon name={trend < 0 ? "trending-down" : "trending-up"} size={13} />
            {trend > 0 ? "+" : ""}
            {trend}
          </span>
        )}
      </div>

      <div className={styles.ratingRows}>
        {rows.map((row) => (
          <div key={row.stars} title={`${row.stars}-star: ${row.pct == null ? "—" : `${row.pct}%`}`}>
            <span className={styles.ratingStarLabel}>
              {row.stars}
              <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
                <path d={STAR_PATH} fill="currentColor" />
              </svg>
            </span>
            <span className={styles.ratingTrack}>
              <span style={{ width: `${((row.pct ?? 0) / maxPct) * 100}%` }} />
            </span>
            <small>{row.pct == null ? "—" : `${row.pct}%`}</small>
          </div>
        ))}
      </div>

      {positive != null && (
        <p className={styles.ratingFootnote}>
          <Icon name="thumbs-up" size={14} />
          <span>
            <strong>{Number(positive.toFixed(1))}%</strong> of reviews are 4★ or higher
          </span>
        </p>
      )}
    </div>
  );
}

const HEALTH_RANK = { danger: 3, warning: 2, neutral: 1, success: 0 };

function SystemHealth({ items, onSelect }) {
  const known = items.filter((item) => item.status !== "—");
  const healthy = items.filter((item) => item.tone === "success").length;
  const issues = items.filter((item) => item.tone === "warning" || item.tone === "danger");
  const worst = items.reduce(
    (acc, item) => (HEALTH_RANK[item.tone] > HEALTH_RANK[acc] ? item.tone : acc),
    "success",
  );
  const summary = !known.length
    ? { tone: "neutral", icon: "help-circle", title: "Status unavailable", sub: "Health checks haven't reported yet" }
    : issues.length
      ? {
          tone: worst === "danger" ? "danger" : "warning",
          icon: "triangle-alert",
          title: `${issues.length} ${issues.length === 1 ? "service needs" : "services need"} attention`,
          sub: `${healthy} of ${items.length} services healthy`,
        }
      : {
          tone: "success",
          icon: "shield-check",
          title: "All systems operational",
          sub: `${healthy} of ${items.length} services healthy`,
        };
  const sorted = [...items].sort((a, b) => HEALTH_RANK[b.tone] - HEALTH_RANK[a.tone]);

  return (
    <div className={styles.health}>
      <div className={`${styles.healthSummary} ${styles[`tone_${summary.tone}`]}`}>
        <span className={styles.healthSummaryIcon}>
          <Icon name={summary.icon} size={18} />
        </span>
        <span>
          <strong>{summary.title}</strong>
          <small>{summary.sub}</small>
        </span>
      </div>
      <div className={styles.healthStrip} aria-hidden="true">
        {sorted.map((item) => (
          <span key={item.label} className={styles[`seg_${item.tone}`]} title={`${item.label}: ${item.status}`} />
        ))}
      </div>
      <ul className={styles.healthList}>
        {sorted.map((item) => (
          <li key={item.label}>
            <button type="button" onClick={() => onSelect(item)}>
              <span className={styles.healthIcon}>
                <Icon name={item.icon} size={15} />
              </span>
              <strong>{item.label}</strong>
              <span className={`${styles.healthStatus} ${styles[`tone_${item.tone}`]}`}>
                <i className={item.tone === "success" ? styles.pulse : undefined} />
                {item.status}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Job labels follow the Jobs screens' vocabulary; anything they don't cover
// (e.g. "Completed", "Pending") falls back to the shared design-system map.
const jobTone = (status) => {
  const tone = statusTone(status);
  return tone === "neutral" && status !== "Cancelled" ? TK_STATUS[status] || "neutral" : tone;
};
const userTone = (status) => TK_STATUS[status] || statusTone(status);

const JOB_ICON = { success: "circle-check", info: "truck", warning: "clock", danger: "circle-x", neutral: "package" };

function RecentJobs({ jobs, onSelect }) {
  if (!jobs.length) {
    return (
      <div className={styles.sectionEmpty}>
        <Icon name="package" size={20} />
        <strong>No jobs yet</strong>
        <span>New jobs will show up here as they are posted.</span>
      </div>
    );
  }
  return (
    <ul className={styles.feed}>
      {jobs.map((job) => {
        const tone = jobTone(job.status);
        const meta = [job.cargo, job.company].filter(Boolean);
        return (
          <li key={job.id}>
            <button type="button" className={styles.feedRow} onClick={() => onSelect(job)}>
              <span className={`${styles.feedIcon} ${styles[`tone_${tone}`]}`}>
                <Icon name={JOB_ICON[tone] || "package"} size={16} />
              </span>
              <span className={styles.feedMain}>
                <RouteLabel route={job.routeLabel} className={styles.feedTitle} />
                <span className={styles.feedMeta}>
                  <span className={styles.jobId}>{job.displayId || job.id}</span>
                  {meta.map((part) => (
                    <span key={part}>{part}</span>
                  ))}
                </span>
              </span>
              <span className={styles.feedSide}>
                {job.value != null && <strong>{formatNaira(job.value)}</strong>}
                <Badge tone={tone} dot>
                  {job.status}
                </Badge>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function joinedAgo(row) {
  if (!Number.isFinite(row.joinedTimestamp)) return row.joined;
  const days = Math.round((row.joinedTimestamp - Date.now()) / 86_400_000);
  if (days > 0 || days < -30) return row.joined;
  if (days === 0) {
    const hours = Math.round((row.joinedTimestamp - Date.now()) / 3_600_000);
    return hours === 0 ? "Just now" : relativeFormat.format(hours, "hour");
  }
  return relativeFormat.format(days, "day");
}

function RecentRegistrations({ rows, onSelect }) {
  if (!rows.length) {
    return (
      <div className={styles.sectionEmpty}>
        <Icon name="users" size={20} />
        <strong>No new registrations</strong>
        <span>New drivers, companies and forwarders appear here.</span>
      </div>
    );
  }
  return (
    <ul className={styles.feed}>
      {rows.map((row) => {
        return (
          <li key={row.id}>
            <button type="button" className={styles.feedRow} onClick={() => onSelect(row)}>
              <span className={styles.avatarWrap}>
                <Avatar name={row.avatar} size={32} />
              </span>
              <span className={styles.feedMain}>
                <span className={styles.feedTitle}>
                  <span className={styles.personName}>{row.name}</span>
                  <span className={styles.feedType}>{row.type}</span>
                </span>
                <span className={styles.feedMeta}>
                  <span>{row.contact}</span>
                </span>
              </span>
              <span className={styles.feedSide}>
                <small title={row.joined}>{joinedAgo(row)}</small>
                <Badge tone={userTone(row.status)} dot>
                  {row.status}
                </Badge>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
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

const DAY_FORMAT = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

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
  const routes = (overview?.topRoutesByVolume || []).slice(0, 5).map((route) => ({
    ...route,
    pct: route.percentOfTotal == null ? "—" : `${Number(route.percentOfTotal.toFixed(1))}%`,
  }));
  const routeShare = routes.length && routes.every((route) => route.percentOfTotal != null)
    ? routes.reduce((sum, route) => sum + route.percentOfTotal, 0)
    : null;
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
        title="Dashboard"
        description={`${DAY_FORMAT.format(new Date())} · Platform-wide activity across Trukkas.`}
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
          icon="briefcase"
          label="Active Jobs"
          value={overview?.jobs.active ?? "—"}
          delta={overview?.jobs.activeTrendPercent != null ? `${Math.abs(overview.jobs.activeTrendPercent)}%` : undefined}
          direction={(overview?.jobs.activeTrendPercent ?? 0) < 0 ? "down" : "up"}
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
          description={
            routeShare != null && routes.length > 1
              ? `These ${routes.length} routes carry ${Number(Math.min(routeShare, 100).toFixed(1))}% of all trips`
              : undefined
          }
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
          <TopRoutes
            routes={routes}
            onSelect={(route) => navigate(`/jobs?route=${encodeURIComponent(route.route)}`)}
          />
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
              centerValue={formatNairaShort(earningsOverview?.earningsBreakdown.totalOrders)}
              centerLabel="Total earned"
            />
            <LegendList
              style={{ width: "100%" }}
              items={earnings.map((item) => ({
                ...item,
                shareDisplay: item.percent == null ? "—" : `(${item.percent}%)`,
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
          <SystemHealth items={systemHealth} onSelect={(item) => navigate(item.route)} />
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
          <RecentJobs
            jobs={recentJobs}
            onSelect={(job) => navigate(`/jobs/detail?id=${encodeURIComponent(job.id)}`)}
          />
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
          <RecentRegistrations rows={registrations} onSelect={(row) => navigate(row.route)} />
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
    ["briefcase", "Active Jobs"],
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
      </div>

      <div className={`${styles.loadingNotice} tk-sr-only`} role="status" aria-live="polite">
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
