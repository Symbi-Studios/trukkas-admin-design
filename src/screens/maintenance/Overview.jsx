"use client";
import { useNavigate } from "../../router.js";
import { Badge, Icon, ProgressBar, RankBarList, SectionCard, Skeleton, StatCard, StatsPanel } from "../../ds.js";
import {
  maintenanceHref, maintenanceWindow, useGetAdminMaintenanceComplianceQuery, useGetAdminMaintenanceQuery, useGetAdminMaintenanceStatsQuery,
} from "../../store/features/maintenance/maintenanceApi.js";
import { ReadState, count } from "./shared.jsx";

const share = (v) => (v == null ? "—" : `${v}%`);

/** Platform-wide picture: how much of the fleet can work today, and what needs an admin next. */
export function Overview({ owner, authenticated, go }) {
  const navigate = useNavigate();
  const statsQuery = useGetAdminMaintenanceStatsQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const stats = statsQuery.error ? null : statsQuery.currentData;
  const compliance = useGetAdminMaintenanceComplianceQuery(owner, { skip: !authenticated });
  const report = compliance.error ? null : compliance.currentData;
  const overdue = useGetAdminMaintenanceQuery({ owner, tab: "overdue", page: 1, limit: 5 }, { skip: !authenticated });
  const upcoming = useGetAdminMaintenanceQuery({ owner, tab: "scheduled", ...maintenanceWindow(), page: 1, limit: 5 }, { skip: !authenticated });
  const stat = (v) => (statsQuery.isFetching ? <Skeleton as="span" width={54} height={23} /> : count(v));
  const eligible = stats?.eligibility?.[0];
  const reviewTotal = stats?.approvals?.total;

  return (
    <>
      <StatsPanel fixedLabel="Current" fixedHint="Live counts. “Due soon” means within the next 7 days.">
        <StatCard icon="truck" label="Total Trucks" value={stat(stats?.totalTrucks)} caption={stats?.trucksCaption || "—"} />
        <StatCard icon="circle-check" tint="green" label="Eligible for Jobs" value={stat(eligible?.count)} caption={`${share(eligible?.percent)} of fleet`} />
        <StatCard icon="calendar-days" tint="amber" label="Due Soon" value={stat(stats?.dueSoon)} caption="Within the next 7 days" />
        <StatCard icon="triangle-alert" tint="red" label="Overdue" value={stat(stats?.overdue)} caption="Past the due date" />
        <StatCard icon="wrench" tint="blue" label="Under Maintenance" value={stat(stats?.inMaintenance)} caption={`${share(stats?.inMaintenancePercent)} of fleet`} />
        <StatCard icon="lock-keyhole" tint="red" label="Blocked from Jobs" value={stat(stats?.restrictedAssets)} caption="Cannot receive new assignments" />
      </StatsPanel>

      <div className="maint-layout">
        <div className="maint-main">
          <div className="maint-row maint-row-2">
            <SectionCard title="Fleet Readiness" tooltip="Restricted trucks and trucks in maintenance cannot bid or be assigned. Pending inspection is informational.">
              {[
                ["Eligible for jobs", stats?.eligibility?.[0], "var(--tk-success)"],
                ["Under maintenance", stats?.eligibility?.[1], "var(--tk-warning)"],
                ["Pending inspection", stats?.eligibility?.[2], "var(--tk-blue)"],
                ["Blocked (restricted)", stats?.eligibility?.[3], "var(--tk-danger)"],
              ].map(([label, item, color]) => (
                <div className="maint-type-row-reverse" key={label}>
                  <ProgressBar value={item?.percent ?? 0} label={label} caption={`${share(item?.percent)} (${count(item?.count)})`} color={color} />
                </div>
              ))}
            </SectionCard>
            <SectionCard title="Compliance" tooltip="Share of trucks with no overdue mandatory maintenance, and job assignments the system rejected for maintenance in the last 30 days.">
              {compliance.error ? <ReadState error={compliance.error} title="Compliance reporting is coming" /> : (
                <div className="maint-compliance">
                  <div className="maint-compliance-figures">
                    <span><strong>{share(report?.complianceRate)}</strong><small>Compliance rate</small></span>
                    <span><strong>{count(report?.assignmentRejections)}</strong><small>Assignments rejected (30 days)</small></span>
                  </div>
                  {report?.byCompany?.length ? (
                    <RankBarList
                      items={report.byCompany.slice().sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101)).slice(0, 5).map((c) => ({ label: c.name, value: c.rate ?? 0, display: share(c.rate) }))}
                      max={100}
                    />
                  ) : null}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Overdue Maintenance"
            count={overdue.currentData?.pagination.total ?? undefined}
            action={<button className="maint-link" onClick={() => go("records", { status: "Overdue" })}>View all</button>}
          >
            {overdue.error ? <ReadState error={overdue.error} /> : overdue.isFetching ? <Skeleton height={120} /> : !overdue.currentData?.rows.length ? (
              <div className="maint-clear"><Icon name="circle-check" size={16} color="var(--tk-success)" /> No overdue maintenance across the platform.</div>
            ) : overdue.currentData.rows.map((r) => (
              <button className="maint-upcoming" key={r.id} onClick={() => navigate(maintenanceHref(r.id))}>
                <span className="ico danger"><Icon name="triangle-alert" size={13} /></span>
                <span><strong>{r.plate} · {r.company}</strong><small>{r.description}</small></span>
                <span className="maint-upcoming-due"><Badge tone="danger">{r.dueLabel}</Badge></span>
              </button>
            ))}
          </SectionCard>
        </div>

        <div className="maint-rail">
          <SectionCard title="Needs an Admin">
            <Action icon="clipboard-check" title="Reviews" hint="Service requests and completions to check" value={count(reviewTotal)} onClick={() => go("reviews")} />
            <Action icon="lock-keyhole" title="Blocked trucks" hint="Restrictions, clears and overrides" value={count(stats?.restrictedAssets)} onClick={() => go("exceptions")} />
            <Action icon="sliders-horizontal" title="Maintenance rules" hint="Intervals, warnings and enforcement" onClick={() => go("rules")} />
          </SectionCard>
          <SectionCard title="Due in the Next 7 Days" action={<button className="maint-link" onClick={() => go("records", { status: "Scheduled" })}>View all</button>}>
            {upcoming.error ? <ReadState error={upcoming.error} /> : upcoming.isFetching ? <Skeleton height={120} /> : !upcoming.currentData?.rows.length ? (
              <div className="maint-clear">Nothing scheduled this week.</div>
            ) : upcoming.currentData.rows.map((r) => (
              <button className="maint-upcoming" key={r.id} onClick={() => navigate(maintenanceHref(r.id))}>
                <span className="ico"><Icon name="truck" size={13} /></span>
                <span><strong>{r.plate}</strong><small>{r.company} · {r.description}</small></span>
                <span className="maint-upcoming-due">{r.dueDate}<small>{r.dueLabel}</small></span>
              </button>
            ))}
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function Action({ icon, title, hint, value, onClick }) {
  return (
    <button className="maint-action" onClick={onClick}>
      <span className="ico"><Icon name={icon} size={13} /></span>
      <span><strong>{title}</strong><small>{hint}</small></span>
      {value != null && value !== "—" ? <b className="maint-action-count">{value}</b> : null}
      <Icon name="chevron-right" size={13} />
    </button>
  );
}
