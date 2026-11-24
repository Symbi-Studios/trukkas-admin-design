"use client";

import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  BarChart,
  Button,
  Card,
  DonutChart,
  Icon,
  LegendList,
  ListRow,
  PageHeader,
  ProgressBar,
  SectionCard,
  Skeleton,
  StatCard,
  StatsPanel,
  TK_STATUS,
} from "../ds.js";
import { formatNaira } from "../mock/format.js";
import { useGetAdminOverviewQuery } from "../store/features/overview/overviewApi.js";
import { useGetAdminDriverStatsQuery } from "../store/features/drivers/driversApi.js";
import { useGetAdminCompanyStatsQuery } from "../store/features/companies/companiesApi.js";
import { useGetAdminForwarderStatsQuery } from "../store/features/forwarders/forwardersApi.js";
import styles from "./UsersOverview.module.css";

const numberFormat = new Intl.NumberFormat("en-NG");
const isNum = (value) => typeof value === "number" && Number.isFinite(value);
const fmt = (value) => (isNum(value) ? numberFormat.format(value) : "—");
/** Sum only when every part is known, so a missing figure never reads as zero. */
const sum = (...values) => (values.every(isNum) ? values.reduce((a, b) => a + b, 0) : null);
const pct = (value) => (isNum(value) ? `${Number(value.toFixed(1))}%` : "—");

const TYPES = [
  { key: "drivers", label: "Drivers", growthLabel: "Drivers", icon: "user-round", tint: "blue", color: "var(--tk-blue)", route: "/drivers" },
  { key: "truckers", label: "Truck Companies", growthLabel: "Truckers", icon: "building-2", tint: "green", color: "var(--tk-success)", route: "/companies" },
  { key: "forwarders", label: "Forwarders", growthLabel: "Forwarders", icon: "users-round", tint: "purple", color: "var(--tk-purple)", route: "/forwarders" },
];

const TYPE_TONE = { Driver: "info", Company: "teal", Individual: "success", Forwarder: "purple", Exporter: "orange" };
const EXTRA_STATUS_TONE = { "Pending Review": "warning", "Pending Profile": "warning", Suspended: "danger", Rejected: "danger", Banned: "danger" };
const statusTone = (status) => TK_STATUS[status] || EXTRA_STATUS_TONE[status] || "neutral";

function statusRows(rows) {
  const known = rows.filter((row) => isNum(row.value));
  return known.length === rows.length ? rows : null;
}

export function UsersOverview() {
  const navigate = useNavigate();
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const owner = useSelector((state) => state.auth.admin?.id);

  const overviewQuery = useGetAdminOverviewQuery(undefined, { refetchOnMountOrArgChange: true });
  const driverQuery = useGetAdminDriverStatsQuery(undefined, { skip: !authenticated });
  const companyQuery = useGetAdminCompanyStatsQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const forwarderQuery = useGetAdminForwarderStatsQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });

  const overview = overviewQuery.currentData;
  const drivers = driverQuery.currentData;
  const companies = companyQuery.currentData;
  const forwarders = forwarderQuery.currentData;
  const users = overview?.users;

  const registrations = useMemo(() => {
    const records = Object.values(overview?.recentRegistrations || {}).flat();
    return [...new Map(records.map((row) => [row.id, row])).values()]
      .sort((a, b) => (b.joinedTimestamp ?? -Infinity) - (a.joinedTimestamp ?? -Infinity))
      .slice(0, 6);
  }, [overview]);

  const anyLoading = [overviewQuery, driverQuery, companyQuery, forwarderQuery].some(
    (query) => !query.currentData && !query.isError && (query.isLoading || query.isFetching || query.isUninitialized),
  );
  if (!overview && anyLoading) return <UsersOverviewLoading />;
  if (!overview && overviewQuery.isError) {
    return (
      <div className={styles.page}>
        <Card className={styles.loadError}>
          <span className={styles.loadErrorIcon} aria-hidden="true">!</span>
          <h1>User analytics couldn’t be loaded</h1>
          <p>Check your connection and try loading the overview again.</p>
          <Button onClick={overviewQuery.refetch}>Try again</Button>
        </Card>
      </div>
    );
  }

  // Per-type stats endpoints back each list page, so these totals match what admins see on click-through.
  // (/admin/overview counts "truckers" including individual truckers, so it isn't used for totals.)
  const typeStats = { drivers, truckers: companies, forwarders };
  const totals = TYPES.map((type) => ({ ...type, value: typeStats[type.key]?.total ?? null }));
  const totalUsers = sum(...totals.map((type) => type.value));
  const newThisMonth = sum(...TYPES.map((type) => users?.[type.key]?.monthDelta));
  const newThisWeek = sum(...TYPES.map((type) => users?.[type.key]?.weekDelta));
  const pendingReview = sum(drivers?.pendingReview, companies?.pending, forwarders?.pending);
  const mixKnown = totals.every((type) => isNum(type.value));

  const growthPeriods = [
    ["todayDelta", "Today"],
    ["weekDelta", "This week"],
    ["monthDelta", "This month"],
  ];
  const growthKnown = TYPES.every((type) => growthPeriods.every(([key]) => isNum(users?.[type.key]?.[key])));

  const driverStatus = statusRows([
    { label: "Active", value: drivers?.active, color: "var(--tk-success)" },
    { label: "On Trip", value: drivers?.onTrip, color: "var(--tk-blue)" },
    { label: "Pending Review", value: drivers?.pendingReview, color: "var(--tk-warning)" },
    { label: "Inactive", value: drivers?.inactive, color: "var(--tk-ink-300)" },
    { label: "Suspended", value: drivers?.suspended, color: "var(--tk-danger)" },
    { label: "Rejected", value: drivers?.rejected, color: "var(--tk-orange)" },
    { label: "Banned", value: drivers?.banned, color: "var(--tk-purple)" },
  ]);
  const companyStatus = statusRows([
    { label: "Active", value: companies?.active, color: "var(--tk-success)" },
    { label: "Pending Review", value: companies?.pending, color: "var(--tk-warning)" },
    { label: "Suspended", value: companies?.suspended, color: "var(--tk-danger)" },
    { label: "Rejected", value: companies?.rejected, color: "var(--tk-ink-300)" },
  ]);
  const forwarderPalette = { Active: "var(--tk-success)", Pending: "var(--tk-warning)", Suspended: "var(--tk-danger)", Inactive: "var(--tk-ink-300)", Banned: "var(--tk-purple)" };
  const forwarderStatus = forwarders?.overview?.length
    ? statusRows(forwarders.overview.map((row) => ({ label: row.label, value: row.value, color: forwarderPalette[row.label] })))
    : null;

  const docs = drivers?.documentsExpiring;
  const attention = [
    { icon: "user-round", tint: "amber", title: "Drivers awaiting review", subtitle: "Licence and profile checks", value: drivers?.pendingReview, route: "/drivers" },
    { icon: "building-2", tint: "amber", title: "Companies awaiting review", subtitle: "CAC and business documents", value: companies?.pending, route: "/companies" },
    { icon: "users-round", tint: "amber", title: "Forwarders awaiting verification", subtitle: "KYC and exporter licences", value: forwarders?.pending, route: "/forwarders" },
    { icon: "file-warning", tint: "red", title: "Expired driver licences", subtitle: "Drivers can’t be dispatched", value: docs?.expired, route: "/drivers" },
    { icon: "calendar-clock", tint: "amber", title: "Licences expiring soon", subtitle: isNum(docs?.withinDays) ? `Within ${docs.withinDays} days` : "Upcoming renewals", value: docs?.expiringSoon, route: "/drivers" },
    { icon: "file-x", tint: "neutral", title: "No licence on file", subtitle: "Drivers missing a licence upload", value: docs?.noLicenseOnFile, route: "/drivers" },
  ];
  const attentionTotal = sum(...attention.map((row) => row.value));

  const market = overview?.marketplaceHealth;

  return (
    <div className={styles.page}>
      <PageHeader
        crumbs={["Users", "Overview"]}
        title="Users Overview"
        description="Growth, verification and activity across drivers, truck companies and forwarders."
        actions={
          <>
            <Button variant="outline" icon="user-round" onClick={() => navigate("/drivers")}>Drivers</Button>
            <Button variant="outline" icon="building-2" onClick={() => navigate("/companies")}>Companies</Button>
            <Button variant="outline" icon="users-round" onClick={() => navigate("/forwarders")}>Forwarders</Button>
          </>
        }
      />

      <StatsPanel fixedLabel="All time" fixedHint="Totals cover all time; new-user counts cover this week and this month.">
        <StatCard layout="stack" icon="users" tint="navy" label="Total Users" value={fmt(totalUsers)} caption={isNum(newThisWeek) ? `+${fmt(newThisWeek)} this week` : undefined} />
        {totals.map((type) => (
          <StatCard
            layout="stack"
            key={type.key}
            icon={type.icon}
            tint={type.tint}
            label={type.label}
            value={fmt(type.value)}
            caption={isNum(typeStats[type.key]?.active) ? `${fmt(typeStats[type.key].active)} active` : undefined}
          />
        ))}
        <StatCard layout="stack" icon="user-plus" tint="teal" label="New This Month" value={fmt(newThisMonth)} caption="Across all user types" />
        <StatCard layout="stack" icon="shield-alert" tint="amber" label="Pending Review" value={fmt(pendingReview)} caption="Awaiting verification" />
      </StatsPanel>

      <section className={styles.gridTwo}>
        <SectionCard title="User Mix" description="Share of registered users by type">
          <div className={styles.donutRow}>
            <DonutChart size={160} thickness={22} data={mixKnown ? totals : []} centerValue={fmt(totalUsers)} centerLabel="Total Users" />
            <LegendList
              style={{ width: "100%" }}
              showShare={mixKnown}
              items={totals.map((type) => ({ label: type.label, value: type.value ?? undefined, color: type.color, display: fmt(type.value) }))}
            />
          </div>
          {isNum(forwarders?.exporters) && forwarders.exporters > 0 && (
            <p className={styles.footnote}>
              <Icon name="box" size={14} />
              {fmt(forwarders.exporters)} forwarders also hold an exporter licence.
            </p>
          )}
        </SectionCard>

        <SectionCard title="New Registrations" description="Sign-ups by user type · Truckers include individual truck owners">
          {growthKnown ? (
            <>
              <BarChart
                height={210}
                labels={growthPeriods.map(([, label]) => label)}
                format={(value) => (Number.isInteger(value) ? numberFormat.format(value) : "")}
                series={TYPES.map((type) => ({ name: type.growthLabel, color: type.color, points: growthPeriods.map(([key]) => users[type.key][key]) }))}
              />
              <div className={styles.chartLegend}>
                {TYPES.map((type) => (
                  <span key={type.key}><i style={{ background: type.color }} />{type.growthLabel}</span>
                ))}
              </div>
            </>
          ) : (
            <Empty icon="chart-column" title="Registration trend unavailable" text="Sign-up counts by period haven’t been returned yet." />
          )}
        </SectionCard>
      </section>

      <section className={styles.gridThree}>
        <StatusCard
          title="Drivers by Status"
          total={drivers?.total}
          totalLabel="Drivers"
          rows={driverStatus}
          error={driverQuery.isError}
          onView={() => navigate("/drivers")}
          facts={[
            ["Individual", fmt(drivers?.individual)],
            ["Company-employed", fmt(drivers?.company)],
            ["Avg. rating", isNum(drivers?.averageRating?.average) ? `${drivers.averageRating.average.toFixed(1)} ★` : "—"],
          ]}
        />
        <StatusCard
          title="Truck Companies by Status"
          total={companies?.total}
          totalLabel="Companies"
          rows={companyStatus}
          error={companyQuery.isError}
          onView={() => navigate("/companies")}
          facts={[
            ["Verified", fmt(companies?.verified)],
            ["Trucks", isNum(companies?.trucks) ? `${fmt(companies.activeTrucks)} / ${fmt(companies.trucks)} active` : "—"],
            ["Drivers employed", fmt(companies?.drivers)],
          ]}
        />
        <StatusCard
          title="Forwarders by Status"
          total={forwarders?.total}
          totalLabel="Forwarders"
          rows={forwarderStatus}
          error={forwarderQuery.isError}
          onView={() => navigate("/forwarders")}
          facts={[
            ["Exporters", fmt(forwarders?.exporters)],
            ["Total spend", isNum(forwarders?.totalSpend) ? formatNaira(forwarders.totalSpend) : "—"],
          ]}
        />
      </section>

      <section className={styles.gridThree}>
        <SectionCard title="Needs Attention" count={isNum(attentionTotal) && attentionTotal > 0 ? attentionTotal : undefined} pad="none">
          <div className={styles.list}>
            {attention.map((row) => (
              <ListRow
                key={row.title}
                icon={row.icon}
                iconTint={row.tint}
                title={row.title}
                subtitle={row.subtitle}
                value={fmt(row.value)}
                valueTone={isNum(row.value) && row.value > 0 ? (row.tint === "red" ? "var(--tk-danger)" : "var(--tk-ink-900)") : "var(--tk-ink-400)"}
                chevron
                onClick={() => navigate(row.route)}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Marketplace Engagement" description="How actively users trade on Trukkas">
          <div className={styles.engagement}>
            <div className={styles.engagementCounts}>
              <div><strong>{fmt(market?.activeForwarders)}</strong><span>Active forwarders</span></div>
              <div><strong>{fmt(market?.activeTruckOwners)}</strong><span>Active truck owners</span></div>
            </div>
            <ProgressBar
              label="Trucker acceptance rate"
              caption={pct(market?.truckerAcceptanceRate)}
              value={isNum(market?.truckerAcceptanceRate) ? market.truckerAcceptanceRate : 0}
              color="var(--tk-success)"
            />
            <ProgressBar
              label="Forwarder repeat rate"
              caption={pct(market?.forwarderRepeatRate)}
              value={isNum(market?.forwarderRepeatRate) ? market.forwarderRepeatRate : 0}
              color="var(--tk-blue)"
            />
            <div className={styles.engagementFoot}>
              <span>Disputes per 100 jobs</span>
              <strong>{isNum(market?.disputesPer100Jobs) ? market.disputesPer100Jobs.toFixed(1) : "—"}</strong>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Recent Registrations" pad="none">
          {registrations.length ? (
            <ul className={styles.feed}>
              {registrations.map((row) => (
                <li key={row.id}>
                  <button type="button" className={styles.feedRow} onClick={() => navigate(row.route)}>
                    <Avatar name={row.avatar} size={32} />
                    <span className={styles.feedMain}>
                      <span className={styles.feedName}>{row.name}</span>
                      <span className={styles.feedMeta}>{row.joined}</span>
                    </span>
                    <span className={styles.feedSide}>
                      <Badge tone={TYPE_TONE[row.type] || "neutral"}>{row.type}</Badge>
                      <Badge tone={statusTone(row.status)} dot>{row.status}</Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="users" title="No new registrations" text="New drivers, companies and forwarders appear here." />
          )}
        </SectionCard>
      </section>
    </div>
  );
}

function StatusCard({ title, total, totalLabel, rows, error, facts, onView }) {
  return (
    <SectionCard
      title={title}
      action={<button type="button" className={styles.linkButton} onClick={onView}>View all</button>}
    >
      {rows ? (
        <div className={styles.donutRow}>
          <DonutChart size={124} thickness={18} data={rows} centerValue={fmt(total)} centerLabel={totalLabel} />
          <LegendList style={{ width: "100%" }} items={rows.map((row) => ({ ...row, display: fmt(row.value) }))} />
        </div>
      ) : (
        <Empty
          icon="chart-pie"
          title={error ? "Status breakdown couldn’t be loaded" : "Status breakdown unavailable"}
          text={error ? "Try refreshing the page." : "Counts by status haven’t been returned yet."}
        />
      )}
      <dl className={styles.facts}>
        {facts.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </SectionCard>
  );
}

function Empty({ icon, title, text }) {
  return (
    <div className={styles.empty}>
      <Icon name={icon} size={20} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function UsersOverviewLoading() {
  const cards = [
    ["users", "Total Users"],
    ["user-round", "Drivers"],
    ["building-2", "Truck Companies"],
    ["users-round", "Forwarders"],
    ["user-plus", "New This Month"],
    ["shield-alert", "Pending Review"],
  ];
  return (
    <div className={styles.page} aria-busy="true">
      <PageHeader crumbs={["Users", "Overview"]} title="Users Overview" description="Growth, verification and activity across drivers, truck companies and forwarders." />
      <div className={styles.loadingNotice} role="status" aria-live="polite">
        <span className={styles.loadingNoticeDot} aria-hidden="true" />
        Loading user analytics…
      </div>
      <StatsPanel fixedLabel="All time">
        {cards.map(([icon, label]) => (
          <StatCard key={label} icon={icon} label={label} value={<Skeleton as="span" width={54} height={23} />} caption={<Skeleton as="span" width={96} height={11} />} />
        ))}
      </StatsPanel>
      <section className={styles.gridTwo} aria-hidden="true">
        <SectionCard title="User Mix">
          <div className={styles.donutRow}><Skeleton width={160} height={160} radius={80} /><LoadingLines /></div>
        </SectionCard>
        <SectionCard title="New Registrations"><Skeleton height={210} radius={10} /></SectionCard>
      </section>
      <section className={styles.gridThree} aria-hidden="true">
        {["Drivers by Status", "Truck Companies by Status", "Forwarders by Status"].map((title) => (
          <SectionCard key={title} title={title}>
            <div className={styles.donutRow}><Skeleton width={124} height={124} radius={62} /><LoadingLines /></div>
          </SectionCard>
        ))}
      </section>
    </div>
  );
}

function LoadingLines({ rows = 4 }) {
  return (
    <div className={styles.loadingLines}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={11} width={["80%", "64%", "72%", "56%"][index % 4]} />
      ))}
    </div>
  );
}
