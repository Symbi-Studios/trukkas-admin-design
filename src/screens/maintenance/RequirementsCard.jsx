"use client";
import { Badge, ProgressBar, SectionCard, Skeleton } from "../../ds.js";
import { categoryLabel } from "../../domain/maintenanceRules.js";
import { useGetAdminMaintenanceRequirementsQuery } from "../../store/features/maintenance/maintenanceApi.js";
import { ComplianceBadge, ReadState, remainingLabel } from "./shared.jsx";

const BAR = { OVERDUE: "var(--tk-danger)", MAINTENANCE_REQUIRED: "var(--tk-danger)", DUE: "var(--tk-orange)", DUE_SOON: "var(--tk-warning)" };

/** Where this truck stands against each rule that applies to it. */
export function RequirementsCard({ truckId, owner, authenticated }) {
  const query = useGetAdminMaintenanceRequirementsQuery({ truckId, owner }, { skip: !authenticated || !truckId, refetchOnMountOrArgChange: true });
  const rows = query.error ? [] : query.currentData || [];
  return (
    <SectionCard title="Requirements" tooltip="Generated from the platform's maintenance rules. Mandatory requirements block new jobs once overdue.">
      {query.isFetching ? <Skeleton height={120} /> : query.error ? <ReadState error={query.error} title="Per-rule requirements are coming" /> : !rows.length ? (
        <div className="maint-clear">No rules apply to this truck.</div>
      ) : rows.map((req) => {
        const used = req.intervalKm && req.remainingKm != null ? (req.intervalKm - req.remainingKm) / req.intervalKm * 100
          : req.intervalDays && req.remainingDays != null ? (req.intervalDays - req.remainingDays) / req.intervalDays * 100 : null;
        return (
          <div className="mdet-req" key={req.ruleId}>
            <div className="mdet-req-head">
              <strong>{req.ruleName}</strong>
              <span style={{ display: "flex", gap: 6 }}>{req.mandatory && <Badge tone="neutral">Mandatory</Badge>}<ComplianceBadge status={req.status} /></span>
            </div>
            {used != null && <ProgressBar value={Math.max(0, Math.min(100, used))} color={BAR[req.status] || "var(--tk-blue)"} />}
            <small>{categoryLabel(req.category)} · {remainingLabel(req)} · last done {req.lastServiceDate}</small>
          </div>
        );
      })}
    </SectionCard>
  );
}
