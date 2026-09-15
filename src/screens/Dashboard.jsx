"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "../router.js";
import {
  Avatar, Badge, DataTable, DonutChart, DropdownMenu,
  FilterSelect, Icon, LegendList, LineChart, PageHeader, ProgressBar, SectionCard, StatCard,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { getJobTrips } from "../domain/jobTrips.js";
import { formatNaira } from "../mock/format.js";
import { statusTone } from "./JobDetail.jsx";
import styles from "./Dashboard.module.css";

const DATE_RANGES = ["Sep 1, 2026 – Sep 30, 2026", "Last 30 days", "Last 90 days", "This year"];
const TREND_PERIODS = ["Last 6 Months", "Last 3 Months", "This Year"];
const ACTIVITY_PERIODS = ["Last 30 days", "Last 90 days", "This year"];
const REGISTRATION_TABS = ["Drivers", "Trucking Companies", "Forwarders", "Exporters"];
const compactNaira = (value) => {
  if (value >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(1)}K`;
  return formatNaira(value);
};

function MenuSelect({ id, value, options, openMenu, setOpenMenu, onChange, icon }) {
  return (
    <span className={styles.menuWrap}>
      <FilterSelect label={value} icon={icon} active={openMenu === id} onClick={() => setOpenMenu(openMenu === id ? null : id)} />
      {openMenu === id && <span className={styles.menu}><DropdownMenu width={220} items={options.map((option) => ({
        label: option, icon: option === value ? "check" : undefined, onClick: () => { onChange(option); setOpenMenu(null); },
      }))} /></span>}
    </span>
  );
}

function FlowNode({ icon, tint = "blue", value, label, note, onClick }) {
  return (
    <button type="button" className={styles.flowNode} onClick={onClick}>
      <span className={`${styles.flowIcon} ${styles[tint]}`}><Icon name={icon} size={18} /></span>
      <span><strong>{value}</strong><small>{label}</small>{note && <em>{note}</em>}</span>
    </button>
  );
}

function StarRating({ rating, reviews }) {
  const rows = [{ stars: 5, pct: 68 }, { stars: 4, pct: 22 }, { stars: 3, pct: 7 }, { stars: 2, pct: 2 }, { stars: 1, pct: 1 }];
  return (
    <div className={styles.rating}>
      <div className={styles.ratingHead}><span className={styles.starTile}><Icon name="star" size={22} /></span><span><strong>{rating.toFixed(1)} / 5</strong><small>Based on {reviews} reviews</small><em>↑ 0.2 from last month</em></span></div>
      <div className={styles.ratingRows}>{rows.map((row) => <div key={row.stars}><span>{row.stars} <Icon name="star" size={11} /></span><ProgressBar value={row.pct} color={row.stars === 5 ? "var(--tk-success)" : row.stars === 4 ? "var(--tk-teal)" : "var(--tk-warning-soft)"} height={7} /><small>{row.pct}%</small></div>)}</div>
    </div>
  );
}

const HEALTH = [
  { icon: "server", label: "Platform / API", status: "Healthy", tone: "success", route: "/settings" },
  { icon: "map-pin", label: "GPS & Tracking", status: "Healthy", tone: "success", route: "/tracking" },
  { icon: "credit-card", label: "Payments", status: "Healthy", tone: "success", route: "/transactions" },
  { icon: "bell", label: "Notifications", status: "Degraded", tone: "warning", route: "/notifications" },
  { icon: "database", label: "Database", status: "Healthy", tone: "success", route: "/settings" },
];

export function Dashboard() {
  const navigate = useNavigate();
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
      routeLabel: job.route || `${job.origin || "—"} → ${job.destination || "—"}`,
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
    const activeTrips = actualTrips.filter((trip) => ["In Transit", "At Pickup", "At Delivery", "Returning Container"].includes(trip.status)).length;
    const completed = actualTrips.filter((trip) => ["Delivered", "Completed"].includes(trip.status)).length;
    const assignedPending = actualTrips.filter((trip) => ["Assigned", "Scheduled"].includes(trip.status)).length;
    const unassignedRequested = normalized.reduce((sum, job) => sum + Math.max(0, (job.requiredTrucks || 1) - getJobTrips(job).length), 0);
    const scheduled = assignedPending + unassignedRequested;
    const cancelled = actualTrips.filter((trip) => trip.status === "Cancelled").length + normalized.filter((job) => job.status === "Rejected" && !getJobTrips(job).length).length;
    const forwarders = new Set(normalized.map((job) => job.company).filter((name) => name !== "—"));
    const exporters = new Set(normalized.filter((job) => job.requestType === "Export").map((job) => job.company));
    const routes = Object.values(normalized.reduce((acc, job) => {
      if (!acc[job.routeLabel]) acc[job.routeLabel] = { route: job.routeLabel, trips: 0 };
      acc[job.routeLabel].trips += job.requiredTrucks || 1;
      return acc;
    }, {})).sort((a, b) => b.trips - a.trips).slice(0, 5);
    const totalRouteTrips = routes.reduce((sum, route) => sum + route.trips, 0) || 1;
    const recentJobs = [...normalized].sort((a, b) => Number(b.id.match(/\d+$/)?.[0] || 0) - Number(a.id.match(/\d+$/)?.[0] || 0)).filter((job) => !query || [job.id, job.routeLabel, job.company, job.cargo].some((field) => String(field || "").toLowerCase().includes(query.toLowerCase()))).slice(0, 5);
    const ratings = drivers.map((driver) => driver.rating).filter(Number.isFinite);
    return { normalized, totalRevenue, platformFees, driverPayouts, companyPayouts, demurrage, otherCosts, activeTrips, completed, scheduled, cancelled, forwarders: forwarders.size, exporters: exporters.size, routes: routes.map((route) => ({ ...route, pct: `${((route.trips / totalRouteTrips) * 100).toFixed(1)}%` })), recentJobs, rating: ratings.reduce((sum, value) => sum + value, 0) / (ratings.length || 1), reviews: drivers.reduce((sum, driver) => sum + (driver.reviews || 0), 0) };
  }, [jobs, drivers, query]);

  const registrations = useMemo(() => {
    let rows;
    if (registrationTab === "Drivers") rows = drivers.map((driver) => ({ id: driver.id, name: driver.name, type: driver.registrationType?.includes("Company") ? "Company" : "Individual", contact: driver.phone, joined: driver.joined, status: driver.kyc === "Approved" ? "Approved" : "Pending", route: `/drivers/${driver.id}`, avatar: driver.name }));
    else if (registrationTab === "Trucking Companies") rows = companies.map((company) => ({ id: company.id, name: company.name, type: "Company", contact: company.contactPhone, joined: company.joined, status: company.verification, route: `/companies/${company.id}`, avatar: company.name }));
    else {
      const names = [...new Set(jobs.filter((job) => registrationTab === "Forwarders" || job.requestType === "Export").map((job) => job.forwarder).filter(Boolean))];
      rows = names.map((name, index) => ({ id: `PARTNER-${index + 1}`, name, type: registrationTab.slice(0, -1), contact: "Operations contact", joined: "Recent", status: "Pending", route: "/forwarders", avatar: name }));
    }
    return rows.filter((row) => !query || [row.name, row.contact, row.type].some((field) => field.toLowerCase().includes(query.toLowerCase()))).slice(0, 5);
  }, [registrationTab, drivers, companies, jobs, query]);

  const activityTotal = data.completed + data.activeTrips + data.scheduled + data.cancelled || 1;
  const activityData = [
    { label: "Completed", value: data.completed, color: "var(--tk-success)" },
    { label: "In Transit", value: data.activeTrips, color: "var(--tk-blue)" },
    { label: "Scheduled", value: data.scheduled, color: "var(--tk-purple)" },
    { label: "Cancelled", value: data.cancelled, color: "var(--tk-danger)" },
  ];
  const earnings = [
    { label: "Drivers", value: data.driverPayouts, color: "var(--tk-blue)" },
    { label: "Companies", value: data.companyPayouts, color: "var(--tk-success)" },
    { label: "Platform Fees", value: data.platformFees, color: "var(--tk-warning)" },
    { label: "Demurrage", value: data.demurrage, color: "var(--tk-purple)" },
    { label: "Other Costs", value: data.otherCosts, color: "var(--tk-ink-300)" },
  ];
  const trendScale = trendPeriod === "Last 3 Months" ? 0.72 : trendPeriod === "This Year" ? 1.35 : 1;
  const trendLabels = trendPeriod === "This Year" ? ["Jan", "Mar", "May", "Jul", "Sep", "Nov"] : ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  const trendBase = Math.max(1, data.totalRevenue / 1000000);
  const trendSeries = [
    { name: "Total Revenue", color: "var(--tk-blue)", points: [.48, .59, .68, .81, .92, 1].map((x) => Math.round(trendBase * x * trendScale)) },
    { name: "Platform Fees", color: "var(--tk-success)", points: [.03, .05, .07, .1, .12, .14].map((x) => Math.max(1, Math.round(trendBase * x * trendScale))) },
  ];

  return (
    <div className={styles.dashboard}>
      <PageHeader
        title={<>Good morning, Super Admin <span aria-hidden="true">👋</span></>}
        description={<>Here&apos;s what&apos;s happening on Trukkas for {dateRange}.</>}
        actions={<>
          <blockquote className={styles.motto}><Icon name="quote" size={20} />“Connecting People. Moving Africa Forward.”</blockquote>
          <MenuSelect id="date" value={dateRange} options={DATE_RANGES} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={setDateRange} icon="calendar-days" />
        </>}
      />
      <section className={styles.stats} aria-label="Platform summary">
        <StatCard icon="user-round" label="Total Drivers" value={drivers.length} delta="12%" caption={`${drivers.filter((d) => d.registrationType?.includes("Individual")).length} Individual`} />
        <StatCard icon="building-2" tint="green" label="Trucking Companies" value={companies.length} delta="8%" caption={`${companies.filter((c) => c.status === "Active").length} Active`} />
        <StatCard icon="users-round" tint="purple" label="Forwarders" value={data.forwarders} delta="15%" caption={`${Math.max(0, data.forwarders - 1)} Active`} />
        <StatCard icon="box" label="Exporters" value={data.exporters} delta="10%" caption={`${data.exporters} Active`} />
        <StatCard icon="truck" label="Trucks & Fleet" value={trucks.length} delta="6%" caption={`${trucks.filter((t) => ["On Trip", "Available"].includes(t.status)).length} Active`} />
        <StatCard icon="route" label="Active Trips" value={data.activeTrips} delta="14%" caption="Live operations" />
        <StatCard icon="circle-check" tint="green" label="Completed Jobs" value={data.completed} delta="18%" caption={`${Math.round((data.completed / (jobs.length || 1)) * 100)}% Success Rate`} />
        <StatCard icon="container" tint="red" label="Containers Moved" value={jobs.reduce((sum, job) => sum + (job.requiredTrucks || 1), 0)} delta="11%" caption="This month" />
      </section>

      <section className={styles.financeGrid}>
        <SectionCard title="Revenue Flow" tooltip="How order value is distributed" action={<MenuSelect id="revenue" value={revenuePeriod} options={["This Month", "Last Month", "This Year"]} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={setRevenuePeriod} />}>
          <div className={styles.flowTop}>
            <FlowNode icon="files" tint="green" value={formatNaira(data.totalRevenue)} label="Orders from Forwarders & Exporters" onClick={() => navigate("/jobs")} />
            <Icon name="arrow-right" size={18} /><FlowNode icon="coins" tint="amber" value={formatNaira(data.platformFees)} label="Platform Fees" note="(8.7%)" onClick={() => navigate("/fees")} />
            <Icon name="arrow-right" size={18} /><FlowNode icon="wallet" value={formatNaira(data.totalRevenue - data.platformFees)} label="Available for Operations" onClick={() => navigate("/wallets")} />
          </div>
          <div className={styles.flowBranches}><span /><span /><span /><span /></div>
          <div className={styles.flowBottom}>
            <FlowNode icon="truck" value={formatNaira(data.driverPayouts)} label="Paid to Drivers" note="(73.2%)" onClick={() => navigate("/payouts")} />
            <FlowNode icon="building-2" value={formatNaira(data.companyPayouts)} label="Paid to Companies" note="(18.4%)" onClick={() => navigate("/payouts")} />
            <FlowNode icon="clock-3" tint="red" value={formatNaira(data.demurrage)} label="Demurrage" note="(5.6%)" onClick={() => navigate("/demurrage")} />
            <FlowNode icon="ellipsis" tint="navy" value={formatNaira(data.otherCosts)} label="Other Costs" note="(2.8%)" onClick={() => navigate("/transactions")} />
          </div>
        </SectionCard>

        <SectionCard title="Revenue Trend" action={<MenuSelect id="trend" value={trendPeriod} options={TREND_PERIODS} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={setTrendPeriod} />}>
          <div className={styles.trendValue}><strong>{formatNaira(data.totalRevenue)}</strong><span>↑ 18% vs previous month</span></div>
          <LineChart height={170} labels={trendLabels} series={trendSeries} area />
          <div className={styles.chartLegend}><span><i className={styles.blueDot} />Total Revenue</span><span><i className={styles.greenDot} />Platform Fees</span></div>
        </SectionCard>

        <SectionCard title="Earnings Breakdown" action={<MenuSelect id="earnings" value={revenuePeriod} options={["This Month", "Last Month", "This Year"]} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={setRevenuePeriod} />}>
          <div className={styles.earnings}><DonutChart size={150} thickness={20} data={earnings} centerValue={compactNaira(data.totalRevenue)} centerLabel="Total Orders" /><LegendList items={earnings.map((item) => ({ ...item, display: compactNaira(item.value) }))} /></div>
        </SectionCard>
      </section>

      <section className={styles.insightsGrid}>
        <SectionCard title="Top Routes by Volume" action={<button className={styles.linkButton} onClick={() => navigate("/jobs")}>View all</button>} pad="none">
          <div className={styles.routeTable}><div><b>#</b><b>Route (Origin → Destination)</b><b>Trips</b><b>% of Total</b></div>{data.routes.map((route, index) => <button type="button" key={route.route} onClick={() => navigate(`/jobs?route=${encodeURIComponent(route.route)}`)}><span>{index + 1}</span><strong>{route.route}</strong><span>{route.trips}</span><span>{route.pct}</span></button>)}</div>
        </SectionCard>
        <SectionCard title="Trip Activity" action={<MenuSelect id="activity" value={activityPeriod} options={ACTIVITY_PERIODS} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={setActivityPeriod} />}>
          <div className={styles.activity}><DonutChart size={150} thickness={20} data={activityData} centerValue={activityTotal} centerLabel="Total Trips" /><LegendList items={activityData} /></div>
        </SectionCard>
        <SectionCard title="Average Rating" action={<MenuSelect id="rating" value={ratingPeriod} options={["All Time", "This Month", "This Year"]} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={setRatingPeriod} />}><StarRating rating={data.rating} reviews={data.reviews} /></SectionCard>
        <SectionCard title="System Health" action={<button className={styles.linkButton} onClick={() => navigate("/settings")}>View all</button>} pad="none">
          <div className={styles.healthList}>{HEALTH.map((item) => <button type="button" key={item.label} onClick={() => navigate(item.route)}><span className={`${styles.healthIcon} ${styles[item.tone]}`}><Icon name={item.icon} size={16} /></span><strong>{item.label}</strong><Badge tone={item.tone} dot>{item.status}</Badge></button>)}</div>
        </SectionCard>
      </section>

      <section className={styles.tablesGrid}>
        <SectionCard title="Recent Jobs" action={<button className={styles.linkButton} onClick={() => navigate("/jobs")}>View all</button>} pad="none">
          <div className={styles.compactTable}><DataTable rows={data.recentJobs} rowKey={(job) => job.id} onRowClick={(job) => navigate(`/jobs/${job.id}`)} columns={[
            { key: "id", header: "Job ID", render: (job) => <Link to={`/jobs/${job.id}`}>{job.id}</Link> },
            { key: "route", header: "Route", render: (job) => job.routeLabel },
            { key: "cargo", header: "Cargo" },
            { key: "company", header: "Forwarder / Exporter" },
            { key: "status", header: "Status", render: (job) => <Badge tone={statusTone(job.status)}>{job.status}</Badge> },
            { key: "value", header: "Value", align: "right", render: (job) => <strong>{formatNaira(job.value)}</strong> },
          ]} /></div>
        </SectionCard>
        <SectionCard title="Recent Registrations" action={<button className={styles.linkButton} onClick={() => navigate(registrationTab === "Drivers" ? "/drivers" : registrationTab === "Trucking Companies" ? "/companies" : "/forwarders")}>View all</button>} pad="none">
          <div className={styles.registrationTabs}>{REGISTRATION_TABS.map((tab) => <button type="button" key={tab} className={registrationTab === tab ? styles.activeRegTab : ""} onClick={() => setRegistrationTab(tab)}>{tab}</button>)}</div>
          <div className={styles.compactTable}><DataTable rows={registrations} rowKey={(row) => row.id} onRowClick={(row) => navigate(row.route)} columns={[
            { key: "name", header: "Name", render: (row) => <span className={styles.person}><Avatar name={row.avatar} size={24} /><strong>{row.name}</strong></span> },
            { key: "type", header: "Type", render: (row) => <Badge tone={row.type === "Company" ? "info" : "neutral"}>{row.type}</Badge> },
            { key: "contact", header: "Contact" }, { key: "joined", header: "Joined" },
            { key: "status", header: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
          ]} /></div>
        </SectionCard>
      </section>
    </div>
  );
}
