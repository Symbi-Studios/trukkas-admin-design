"use client";

import { useEffect, useMemo, useState } from "react";
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
  LineChart,
  PageHeader,
  ProgressBar,
  SectionCard,
  Skeleton,
  StatCard,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { getJobTrips } from "../domain/jobTrips.js";
import { formatNaira } from "../mock/format.js";
import { statusTone } from "./JobDetail.jsx";
import { useGetAdminOverviewQuery } from "../store/features/overview/overviewApi.js";
import styles from "./Dashboard.module.css";

const DATE_RANGES = [
  "Sep 1, 2026 – Sep 30, 2026",
  "Last 30 days",
  "Last 90 days",
  "This year",
];
const TREND_PERIODS = ["Last 6 Months", "Last 3 Months", "This Year"];
const ACTIVITY_PERIODS = ["Last 30 days", "Last 90 days", "This year"];
const REGISTRATION_TABS = [
  "Drivers",
  "Trucking Companies",
  "Forwarders",
  "Exporters",
];
const compactNaira = (value) => {
  if (value >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(1)}K`;
  return formatNaira(value);
};

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
    <span className={styles.menuWrap}>
      <FilterSelect
        label={value}
        icon={icon}
        active={openMenu === id}
        onClick={() => setOpenMenu(openMenu === id ? null : id)}
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

function FlowNode({ icon, tint = "blue", value, label, note, onClick }) {
  return (
    <button type="button" className={styles.flowNode} onClick={onClick}>
      <span className={`${styles.flowIcon} ${styles[tint]}`}>
        <Icon name={icon} size={18} />
      </span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
        {note && <em>{note}</em>}
      </span>
    </button>
  );
}

function StarRating({ rating, reviews }) {
  const rows = [
    { stars: 5, pct: 68 },
    { stars: 4, pct: 22 },
    { stars: 3, pct: 7 },
    { stars: 2, pct: 2 },
    { stars: 1, pct: 1 },
  ];
  return (
    <div className={styles.rating}>
      <div className={styles.ratingHead}>
        <span className={styles.starTile}>
          <Icon name="star" size={22} />
        </span>
        <span>
          <strong>{rating.toFixed(1)} / 5</strong>
          <small>Based on {reviews} reviews</small>
          <em>↑ 0.2 from last month</em>
        </span>
      </div>
      <div className={styles.ratingRows}>
        {rows.map((row) => (
          <div key={row.stars}>
            <span>
              {row.stars} <Icon name="star" size={11} />
            </span>
            <ProgressBar
              value={row.pct}
              color={
                row.stars === 5
                  ? "var(--tk-success)"
                  : row.stars === 4
                    ? "var(--tk-teal)"
                    : "var(--tk-warning)"
              }
              height={16}
            />
            <small>{row.pct}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}

const HEALTH = [
  {
    icon: "server",
    label: "Platform / API",
    status: "Healthy",
    tone: "success",
    route: "/settings",
  },
  {
    icon: "map-pin",
    label: "GPS & Tracking",
    status: "Healthy",
    tone: "success",
    route: "/tracking",
  },
  {
    icon: "credit-card",
    label: "Payments",
    status: "Healthy",
    tone: "success",
    route: "/transactions",
  },
  {
    icon: "bell",
    label: "Notifications",
    status: "Degraded",
    tone: "warning",
    route: "/notifications",
  },
  {
    icon: "database",
    label: "Database",
    status: "Healthy",
    tone: "success",
    route: "/settings",
  },
];

export function Dashboard() {
  const navigate = useNavigate();
  const {
    data: overview,
    isLoading: isOverviewLoading,
    isUninitialized: isOverviewUninitialized,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useGetAdminOverviewQuery();
  const jobs = useCollection("jobs") || [];
  const drivers = useCollection("drivers") || [];
  const companies = useCollection("companies") || [];
  const trucks = useCollection("trucks") || [];
  const [dateRange, setDateRange] = useState(DATE_RANGES[0]);
  const [trendPeriod, setTrendPeriod] = useState(TREND_PERIODS[0]);
  const [activityPeriod, setActivityPeriod] = useState(ACTIVITY_PERIODS[0]);
  const [revenuePeriod, setRevenuePeriod] = useState("This Month");
  const [ratingPeriod, setRatingPeriod] = useState("All Time");
  const [registrationTab, setRegistrationTab] = useState("Drivers");
  const [openMenu, setOpenMenu] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onSearch = (event) => setQuery(event.detail || "");
    window.addEventListener("trukkas:global-search", onSearch);
    return () => window.removeEventListener("trukkas:global-search", onSearch);
  }, []);
  const data = useMemo(() => {
    const normalized = jobs.map((job) => ({
      ...job,
      value: job.jobValue ?? job.amount ?? 0,
      routeLabel:
        job.route || `${job.origin || "—"} → ${job.destination || "—"}`,
      company: job.forwarder || "—",
      created: job.createdAt || job.published || "",
    }));
    const totalRevenue = normalized.reduce((sum, job) => sum + job.value, 0);
    const platformFees = Math.round(totalRevenue * 0.087);
    const driverPayouts = Math.round(totalRevenue * 0.732);
    const companyPayouts = Math.round(totalRevenue * 0.184);
    const demurrage = Math.round(totalRevenue * 0.056);
    const otherCosts = Math.round(totalRevenue * 0.028);
    const actualTrips = normalized.flatMap((job) => getJobTrips(job));
    const activeTrips = actualTrips.filter((trip) =>
      [
        "In Transit",
        "At Pickup",
        "At Delivery",
        "Returning Container",
      ].includes(trip.status),
    ).length;
    const completed = actualTrips.filter((trip) =>
      ["Delivered", "Completed"].includes(trip.status),
    ).length;
    const assignedPending = actualTrips.filter((trip) =>
      ["Assigned", "Scheduled"].includes(trip.status),
    ).length;
    const unassignedRequested = normalized.reduce(
      (sum, job) =>
        sum + Math.max(0, (job.requiredTrucks || 1) - getJobTrips(job).length),
      0,
    );
    const scheduled = assignedPending + unassignedRequested;
    const cancelled =
      actualTrips.filter((trip) => trip.status === "Cancelled").length +
      normalized.filter(
        (job) => job.status === "Rejected" && !getJobTrips(job).length,
      ).length;
    const forwarders = new Set(
      normalized.map((job) => job.company).filter((name) => name !== "—"),
    );
    const exporters = new Set(
      normalized
        .filter((job) => job.requestType === "Export")
        .map((job) => job.company),
    );
    const routes = Object.values(
      normalized.reduce((acc, job) => {
        if (!acc[job.routeLabel])
          acc[job.routeLabel] = { route: job.routeLabel, trips: 0 };
        acc[job.routeLabel].trips += job.requiredTrucks || 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b.trips - a.trips)
      .slice(0, 5);
    const totalRouteTrips =
      routes.reduce((sum, route) => sum + route.trips, 0) || 1;
    const recentJobs = [...normalized]
      .sort(
        (a, b) =>
          Number(b.id.match(/\d+$/)?.[0] || 0) -
          Number(a.id.match(/\d+$/)?.[0] || 0),
      )
      .filter(
        (job) =>
          !query ||
          [job.id, job.routeLabel, job.company, job.cargo].some((field) =>
            String(field || "")
              .toLowerCase()
              .includes(query.toLowerCase()),
          ),
      )
      .slice(0, 5);
    const ratings = drivers
      .map((driver) => driver.rating)
      .filter(Number.isFinite);
    return {
      normalized,
      totalRevenue,
      platformFees,
      driverPayouts,
      companyPayouts,
      demurrage,
      otherCosts,
      activeTrips,
      completed,
      scheduled,
      cancelled,
      forwarders: forwarders.size,
      exporters: exporters.size,
      routes: routes.map((route) => ({
        ...route,
        pct: `${((route.trips / totalRouteTrips) * 100).toFixed(1)}%`,
      })),
      recentJobs,
      rating:
        ratings.reduce((sum, value) => sum + value, 0) / (ratings.length || 1),
      reviews: drivers.reduce((sum, driver) => sum + (driver.reviews || 0), 0),
    };
  }, [jobs, drivers, query]);

  const registrations = useMemo(() => {
    let rows;
    if (registrationTab === "Drivers")
      rows = drivers.map((driver) => ({
        id: driver.id,
        name: driver.name,
        type: driver.registrationType?.includes("Company")
          ? "Company"
          : "Individual",
        contact: driver.phone,
        joined: driver.joined,
        status: driver.kyc === "Approved" ? "Approved" : "Pending",
        route: `/drivers/${driver.id}`,
        avatar: driver.name,
      }));
    else if (registrationTab === "Trucking Companies")
      rows = companies.map((company) => ({
        id: company.id,
        name: company.name,
        type: "Company",
        contact: company.contactPhone,
        joined: company.joined,
        status: company.verification,
        route: `/companies/${company.id}`,
        avatar: company.name,
      }));
    else {
      const names = [
        ...new Set(
          jobs
            .filter(
              (job) =>
                registrationTab === "Forwarders" ||
                job.requestType === "Export",
            )
            .map((job) => job.forwarder)
            .filter(Boolean),
        ),
      ];
      rows = names.map((name, index) => ({
        id: `PARTNER-${index + 1}`,
        name,
        type: registrationTab.slice(0, -1),
        contact: "Operations contact",
        joined: "Recent",
        status: "Pending",
        route: "/forwarders",
        avatar: name,
      }));
    }
    return rows
      .filter(
        (row) =>
          !query ||
          [row.name, row.contact, row.type].some((field) =>
            field.toLowerCase().includes(query.toLowerCase()),
          ),
      )
      .slice(0, 5);
  }, [registrationTab, drivers, companies, jobs, query]);

  const activityTotal = overview
    ? overview.jobs.total ?? 0
    : data.completed + data.activeTrips + data.scheduled + data.cancelled || 1;
  const recentJobs = useMemo(() => {
    // An empty list is a valid API result. Do not replace it with fixture rows.
    const rows = overview ? overview.recentJobs : data.recentJobs;
    if (!query) return rows;
    const normalizedQuery = query.toLowerCase();
    return rows.filter((job) =>
      [job.displayId, job.id, job.routeLabel, job.company, job.cargo, job.truckerName].some((field) =>
        String(field || "").toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [overview, data.recentJobs, query]);
  const activityCompleted = overview?.jobs.completed ?? data.completed;
  const activityInTransit = overview?.jobs.active ?? data.activeTrips;
  const activityCancelled = overview?.jobs.cancelled ?? data.cancelled;
  const activityScheduled = overview
    ? Math.max(
        0,
        (overview.jobs.total ?? 0) -
          activityCompleted -
          activityInTransit -
          activityCancelled,
      )
    : data.scheduled;
  const activityData = [
    { label: "Completed", value: activityCompleted, color: "var(--tk-success)" },
    { label: "In Transit", value: activityInTransit, color: "var(--tk-blue)" },
    { label: "Scheduled", value: activityScheduled, color: "var(--tk-purple)" },
    { label: "Cancelled", value: activityCancelled, color: "var(--tk-danger)" },
  ];
  const earnings = [
    { label: "Drivers", value: data.driverPayouts, color: "var(--tk-blue)" },
    {
      label: "Companies",
      value: data.companyPayouts,
      color: "var(--tk-success)",
    },
    {
      label: "Platform Fees",
      value: data.platformFees,
      color: "var(--tk-warning)",
    },
    { label: "Demurrage", value: data.demurrage, color: "var(--tk-purple)" },
    {
      label: "Other Costs",
      value: data.otherCosts,
      color: "var(--tk-ink-300)",
    },
  ];
  const trendScale =
    trendPeriod === "Last 3 Months"
      ? 0.72
      : trendPeriod === "This Year"
        ? 1.35
        : 1;
  const trendLabels =
    trendPeriod === "This Year"
      ? ["Jan", "Mar", "May", "Jul", "Sep", "Nov"]
      : ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  const trendBase = Math.max(1, data.totalRevenue / 1000000);
  const trendSeries = [
    {
      name: "Total Revenue",
      color: "var(--tk-blue)",
      points: [0.48, 0.59, 0.68, 0.81, 0.92, 1].map((x) =>
        Math.round(trendBase * x * trendScale),
      ),
    },
    {
      name: "Platform Fees",
      color: "var(--tk-success)",
      points: [0.03, 0.05, 0.07, 0.1, 0.12, 0.14].map((x) =>
        Math.max(1, Math.round(trendBase * x * trendScale)),
      ),
    },
  ];

  if (!overview && (isOverviewLoading || isOverviewUninitialized)) {
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
          <>Here&apos;s what&apos;s happening on Trukkas for {dateRange}.</>
        }
        actions={
          <>
            <blockquote className={styles.motto}>
              <Icon name="quote" size={20} />
              “Connecting People. Moving Africa Forward.”
            </blockquote>
            <MenuSelect
              id="date"
              value={dateRange}
              options={DATE_RANGES}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onChange={setDateRange}
              icon="calendar-days"
            />
          </>
        }
      />
      <section className={styles.stats} aria-label="Platform summary">
        <StatCard
          icon="user-round"
          label="Total Drivers"
          value={overview?.users.drivers.total ?? drivers.length}
          delta={overview?.users.drivers.monthDelta != null ? String(Math.abs(overview.users.drivers.monthDelta)) : "12%"}
          direction={(overview?.users.drivers.monthDelta ?? 0) < 0 ? "down" : "up"}
          caption={overview?.users.drivers.monthDelta != null ? "New this month" : `${drivers.filter((d) => d.registrationType?.includes("Individual")).length} Individual`}
        />
        <StatCard
          icon="building-2"
          tint="green"
          label="Trucking Companies"
          value={overview ? overview.users.truckers.total ?? "—" : companies.length}
          delta={overview
            ? overview.users.truckers.monthDelta != null
              ? String(Math.abs(overview.users.truckers.monthDelta))
              : undefined
            : "8%"}
          direction={(overview?.users.truckers.monthDelta ?? 0) < 0 ? "down" : "up"}
          caption={overview
            ? overview.users.truckers.monthDelta != null
              ? "New this month"
              : "—"
            : `${companies.filter((c) => c.status === "Active").length} Active`}
        />
        <StatCard
          icon="users-round"
          tint="purple"
          label="Forwarders"
          value={overview?.users.forwarders.total ?? data.forwarders}
          delta={overview?.users.forwarders.monthDelta != null ? String(Math.abs(overview.users.forwarders.monthDelta)) : "15%"}
          direction={(overview?.users.forwarders.monthDelta ?? 0) < 0 ? "down" : "up"}
          caption={overview?.users.forwarders.monthDelta != null ? "New this month" : `${Math.max(0, data.forwarders - 1)} Active`}
        />
        <StatCard
          icon="box"
          label="Exporters"
          value={data.exporters}
          delta="10%"
          caption={`${data.exporters} Active`}
        />
        <StatCard
          icon="truck"
          label="Trucks & Fleet"
          value={trucks.length}
          delta="6%"
          caption={`${trucks.filter((t) => ["On Trip", "Available"].includes(t.status)).length} Active`}
        />
        <StatCard
          icon="route"
          label="Active Trips"
          value={overview ? overview.jobs.active ?? "—" : data.activeTrips}
          delta={overview
            ? overview.jobs.activeTrendPercent != null
              ? `${Math.abs(overview.jobs.activeTrendPercent)}%`
              : undefined
            : "14%"}
          direction={(overview?.jobs.activeTrendPercent ?? 0) < 0 ? "down" : "up"}
          caption="Live operations"
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Completed Jobs"
          value={overview?.jobs.completed ?? data.completed}
          delta={overview?.jobs.completedToday != null ? String(overview.jobs.completedToday) : "18%"}
          caption={overview?.jobs.completedToday != null ? "Completed today" : `${Math.round((data.completed / (jobs.length || 1)) * 100)}% Success Rate`}
        />
        <StatCard
          icon="container"
          tint="red"
          label="Containers Moved"
          value={jobs.reduce((sum, job) => sum + (job.requiredTrucks || 1), 0)}
          delta="11%"
          caption="This month"
        />
      </section>

      <section className={styles.financeGrid}>
        {/* <SectionCard
          title="Revenue Flow"
          tooltip="How order value is distributed"
          action={
            <MenuSelect
              id="revenue"
              value={revenuePeriod}
              options={["This Month", "Last Month", "This Year"]}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onChange={setRevenuePeriod}
            />
          }
        >
          <div className={styles.flowTop}>
            <FlowNode
              icon="files"
              tint="green"
              value={formatNaira(data.totalRevenue)}
              label="Orders from Forwarders & Exporters"
              onClick={() => navigate("/jobs")}
            />
            <Icon name="arrow-right" size={18} />
            <FlowNode
              icon="coins"
              tint="amber"
              value={formatNaira(data.platformFees)}
              label="Platform Fees"
              note="(8.7%)"
              onClick={() => navigate("/fees")}
            />
            <Icon name="arrow-right" size={18} />
            <FlowNode
              icon="wallet"
              value={formatNaira(data.totalRevenue - data.platformFees)}
              label="Available for Operations"
              onClick={() => navigate("/wallets")}
            />
          </div>
          <div className={styles.flowBranches}>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className={styles.flowBottom}>
            <FlowNode
              icon="truck"
              value={formatNaira(data.driverPayouts)}
              label="Paid to Drivers"
              note="(73.2%)"
              onClick={() => navigate("/payouts")}
            />
            <FlowNode
              icon="building-2"
              value={formatNaira(data.companyPayouts)}
              label="Paid to Companies"
              note="(18.4%)"
              onClick={() => navigate("/payouts")}
            />
            <FlowNode
              icon="clock-3"
              tint="red"
              value={formatNaira(data.demurrage)}
              label="Demurrage"
              note="(5.6%)"
              onClick={() => navigate("/demurrage")}
            />
            <FlowNode
              icon="ellipsis"
              tint="navy"
              value={formatNaira(data.otherCosts)}
              label="Other Costs"
              note="(2.8%)"
              onClick={() => navigate("/transactions")}
            />
          </div>
        </SectionCard> */}

        {/* <SectionCard
          title="Revenue Trend"
          action={
            <MenuSelect
              id="trend"
              value={trendPeriod}
              options={TREND_PERIODS}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onChange={setTrendPeriod}
            />
          }
        >
          <div className={styles.trendValue}>
            <strong>{formatNaira(data.totalRevenue)}</strong>
            <span>↑ 18% vs previous month</span>
          </div>
          <LineChart
            height={170}
            labels={trendLabels}
            series={trendSeries}
            area
          />
          <div className={styles.chartLegend}>
            <span>
              <i className={styles.blueDot} />
              Total Revenue
            </span>
            <span>
              <i className={styles.greenDot} />
              Platform Fees
            </span>
          </div>
        </SectionCard> */}

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
            {data.routes.map((route, index) => (
              <button
                type="button"
                key={route.route}
                onClick={() =>
                  navigate(`/jobs?route=${encodeURIComponent(route.route)}`)
                }
              >
                <span>{index + 1}</span>
                <strong>{route.route}</strong>
                <span>{route.trips}</span>
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
              value={revenuePeriod}
              options={["This Month", "Last Month", "This Year"]}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onChange={setRevenuePeriod}
            />
          }
        >
          <div className={styles.earnings}>
            <DonutChart
              size={150}
              thickness={20}
              data={earnings}
              centerValue={compactNaira(data.totalRevenue)}
              centerLabel="Total Orders"
            />
            <LegendList
              style={{ width: "100%" }}
              items={earnings.map((item) => ({
                ...item,
                display: compactNaira(item.value),
              }))}
            />
          </div>
        </SectionCard>
      </section>

      <section className={styles.insightsGrid}>
        <SectionCard
          title="Trip Activity"
          action={
            <MenuSelect
              id="activity"
              value={activityPeriod}
              options={ACTIVITY_PERIODS}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onChange={setActivityPeriod}
            />
          }
        >
          <div className={styles.activity}>
            <DonutChart
              size={150}
              thickness={20}
              data={activityData}
              centerValue={activityTotal}
              centerLabel="Total Jobs"
            />
            <LegendList style={{ width: "100%" }} items={activityData} />
          </div>
        </SectionCard>
        <SectionCard
          title="Average Rating"
          action={
            <MenuSelect
              id="rating"
              value={ratingPeriod}
              options={["All Time", "This Month", "This Year"]}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onChange={setRatingPeriod}
            />
          }
        >
          <StarRating rating={data.rating} reviews={data.reviews} />
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
            {HEALTH.map((item) => (
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
              onRowClick={overview ? undefined : (job) => navigate(`/jobs/${job.id}`)}
              columns={[
                {
                  key: "id",
                  header: "Job ID",
                  render: (job) => job.detailAvailable === false
                    ? (job.displayId || job.id)
                    : <Link to={`/jobs/${job.id}`}>{job.displayId || job.id}</Link>,
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
            value={<Skeleton width={54} height={23} />}
            caption={<Skeleton width={96} height={11} />}
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
