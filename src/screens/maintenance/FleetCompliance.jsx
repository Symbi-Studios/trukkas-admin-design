"use client";
import { useState } from "react";
import { useNavigate } from "../../router.js";
import { Button, DataTable, Icon, Pagination, SearchField, SectionCard, TableToolbar } from "../../ds.js";
import { CustomSelect } from "../../ds/components/forms/Select.jsx";
import { usePageSearchState } from "../../components/PageSearch.jsx";
import { DriverTableLoading } from "../DriversLoading.jsx";
import { COMPLIANCE, VEHICLE_CLASSES } from "../../domain/maintenanceRules.js";
import { useGetAdminMaintenanceFleetQuery } from "../../store/features/maintenance/maintenanceApi.js";
import { ComplianceBadge, ReadState, RestrictedBadge, km, remainingLabel } from "./shared.jsx";

const STATUS_OPTIONS = [["", "All statuses"], ...Object.entries(COMPLIANCE).map(([value, meta]) => [value, meta.label])];
const CLASS_OPTIONS = [["", "All vehicle classes"], ...VEHICLE_CLASSES.map((item) => [item.value, item.label])];

/** One row per truck: where it stands against every rule that applies to it, most urgent first. */
export function FleetCompliance({ owner, authenticated, go }) {
  const navigate = useNavigate();
  const [q, setQ] = usePageSearchState("", () => setPage(1));
  const [status, setStatus] = useState("");
  const [vehicleClass, setVehicleClass] = useState("");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const query = useGetAdminMaintenanceFleetQuery(
    { owner, search: q.trim() || undefined, status: status || undefined, vehicleClass: vehicleClass || undefined, restricted: blockedOnly ? "true" : undefined, page, limit: pageSize },
    { skip: !authenticated, refetchOnMountOrArgChange: true },
  );
  const data = query.error ? null : query.currentData;
  const counts = data?.counts || {};
  const chips = [["", "All", null], ["OVERDUE", "Overdue", counts.OVERDUE], ["DUE", "Due", counts.DUE], ["DUE_SOON", "Due soon", counts.DUE_SOON], ["UNDER_MAINTENANCE", "In service", counts.UNDER_MAINTENANCE]];

  return (
    <SectionCard title="" pad="none">
      <div className="maint-chips" role="tablist" aria-label="Compliance status">
        {chips.map(([value, label, n]) => (
          <button key={label} role="tab" aria-selected={status === value} className={`maint-chip${status === value ? " on" : ""}`} onClick={() => { setStatus(value); setPage(1); }}>
            {label}{n != null ? <b>{n}</b> : null}
          </button>
        ))}
        <button role="tab" aria-selected={blockedOnly} className={`maint-chip danger${blockedOnly ? " on" : ""}`} onClick={() => { setBlockedOnly(!blockedOnly); setPage(1); }}>
          <Icon name="lock-keyhole" size={12} /> Blocked only
        </button>
      </div>
      <TableToolbar
        search={<SearchField className="search" style={{ flex: 1 }} placeholder="Search plate or company..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
        filters={<>
          <CustomSelect className="maint-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
          </CustomSelect>
          <CustomSelect className="maint-select" value={vehicleClass} onChange={(e) => { setVehicleClass(e.target.value); setPage(1); }}>
            {CLASS_OPTIONS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
          </CustomSelect>
        </>}
      />
      {query.isFetching ? <DriverTableLoading columns={7} label="Loading fleet compliance" /> : query.error ? <ReadState error={query.error} retry={query.refetch} title="Truck-by-truck compliance is coming" /> : (
        <DataTable
          rows={data?.rows || []}
          rowKey={(row) => row.id}
          onRowClick={(row) => go("records", { truckId: row.id })}
          columns={[
            { key: "truck", header: "Truck", render: (row) => (
              <span className="maint-truck">
                <span className="maint-truck-pic"><Icon name="truck" size={18} /></span>
                <span className="maint-cell"><strong>{row.plate}</strong><small>{row.truckType}</small></span>
              </span>
            ) },
            { key: "company", header: "Company", render: (row) => <span className="maint-cell">{row.company}</span> },
            { key: "odometer", header: "Odometer", render: (row) => <span className="maint-cell"><strong>{km(row.odometer)}</strong><small>{row.odometerUpdated}{row.odometerSource ? ` · ${row.odometerSource === "TELEMATICS" ? "GPS" : "manual"}` : ""}</small></span> },
            { key: "next", header: "Next requirement", render: (row) => <span className="maint-cell"><strong>{row.next?.ruleName || "—"}</strong><small>{row.next ? remainingLabel(row.next) : "No rule applies"}</small></span> },
            { key: "status", header: "Compliance", render: (row) => <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><ComplianceBadge status={row.complianceStatus} />{row.restriction && <RestrictedBadge title={row.restriction.reason} />}</span> },
            { key: "trip", header: "On trip", render: (row) => row.activeTripId ? <Button size="sm" variant="outline" icon="route" onClick={(e) => { e.stopPropagation(); navigate(`/trips/detail?id=${encodeURIComponent(row.activeTripId)}`); }}>Trip</Button> : <span className="tk-meta">—</span> },
            { key: "go", header: "", render: () => <Icon name="chevron-right" size={14} color="var(--tk-ink-300)" /> },
          ]}
        />
      )}
      {!query.error && <Pagination page={page} pageCount={data?.pagination.totalPages || 1} pageSize={pageSize} total={data?.pagination.total ?? undefined} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}
    </SectionCard>
  );
}
