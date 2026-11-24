"use client";
import { useState } from "react";
import { Badge, Button, DataTable, Pagination, SectionCard, Select } from "../../ds.js";
import { CustomSelect } from "../../ds/components/forms/Select.jsx";
import { DriverTableLoading } from "../DriversLoading.jsx";
import { EXCEPTION_KINDS } from "../../domain/maintenanceRules.js";
import {
  maintenanceError, useGetAdminMaintenanceExceptionsQuery, useGetAdminMaintenanceTruckOptionsQuery,
  useLiftAdminMaintenanceRestrictionMutation, useRestrictAdminMaintenanceTruckMutation,
} from "../../store/features/maintenance/maintenanceApi.js";
import { ReadState, ReasonModal } from "./shared.jsx";

const KIND_TONE = { MANUAL_RESTRICTION: "danger", MANUAL_CLEAR: "warning", OVERDUE_ON_TRIP: "orange", RULE_OVERRIDE: "info" };

/** Every time a person, not a rule, changed whether a truck can work. All entries carry a reason. */
export function Exceptions({ owner, authenticated, canWrite, notify }) {
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const query = useGetAdminMaintenanceExceptionsQuery({ owner, kind: kind || undefined, page, limit: 10 }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const data = query.error ? null : query.currentData;
  const [lift, liftState] = useLiftAdminMaintenanceRestrictionMutation();
  const [restrict, restrictState] = useRestrictAdminMaintenanceTruckMutation();
  const [lifting, setLifting] = useState(null);
  const [restricting, setRestricting] = useState(false);
  const [truckId, setTruckId] = useState("");
  const [error, setError] = useState("");
  const trucks = useGetAdminMaintenanceTruckOptionsQuery({ owner }, { skip: !authenticated || !restricting });

  async function doLift(reason) {
    setError("");
    try {
      const result = await lift({ truckId: lifting.truckId, reason }).unwrap();
      setLifting(null);
      notify(result.eligible ? `${lifting.plate} can take jobs again.` : `Restriction lifted, but ${lifting.plate} is still unavailable: ${result.message || "see the truck record"}.`);
    } catch (err) { setError(maintenanceError(err)); }
  }
  async function doRestrict(reason) {
    setError("");
    try { await restrict({ truckId, reason }).unwrap(); setRestricting(false); setTruckId(""); notify("Truck blocked from new jobs. The company has been notified."); }
    catch (err) { setError(maintenanceError(err)); }
  }

  return (
    <SectionCard
      title="Exceptions"
      description="Manual restrictions, manual clears, overrides and trucks that went overdue mid-trip. Each is audited."
      action={canWrite ? <Button size="sm" variant="danger" icon="lock-keyhole" onClick={() => { setError(""); setRestricting(true); }}>Block a truck</Button> : null}
      pad="none"
    >
      <div className="maint-toolbar">
        <CustomSelect className="maint-select" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
          <option value="">All exceptions</option>
          {Object.entries(EXCEPTION_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </CustomSelect>
      </div>
      {query.isFetching ? <DriverTableLoading columns={6} label="Loading exceptions" /> : query.error ? <ReadState error={query.error} retry={query.refetch} title="The exceptions log is coming" /> : !data?.rows.length ? (
        <div className="maint-clear" style={{ padding: 20 }}>No exceptions recorded.</div>
      ) : (
        <DataTable
          rows={data.rows}
          rowKey={(row) => row.id}
          columns={[
            { key: "when", header: "When", render: (row) => <span className="maint-cell"><strong>{row.createdAt}</strong><small>{row.actor}</small></span> },
            { key: "kind", header: "Exception", render: (row) => <Badge tone={KIND_TONE[row.kind] || "neutral"}>{EXCEPTION_KINDS[row.kind] || "—"}</Badge> },
            { key: "truck", header: "Truck", render: (row) => <span className="maint-cell"><strong>{row.plate}</strong><small>{row.company}</small></span> },
            { key: "reason", header: "Reason", render: (row) => <span style={{ fontSize: 12 }}>{row.reason}</span> },
            { key: "state", header: "State", render: (row) => row.open ? <Badge tone="danger" dot>Active</Badge> : <Badge tone="neutral">Closed</Badge> },
            { key: "x", header: "", render: (row) => canWrite && row.open && row.truckId && ["MANUAL_RESTRICTION", "OVERDUE_ON_TRIP"].includes(row.kind) ? (
              <Button size="sm" variant="outline" icon="lock-keyhole-open" onClick={() => { setError(""); setLifting(row); }}>Lift</Button>
            ) : null },
          ]}
        />
      )}
      {!query.error && (data?.pagination.totalPages || 1) > 1 && <Pagination page={page} pageCount={data.pagination.totalPages} pageSize={10} total={data.pagination.total ?? undefined} onPage={setPage} />}

      <ReasonModal
        open={!!lifting}
        title={`Lift restriction on ${lifting?.plate || "truck"}`}
        description="Clears a manual restriction and overrides overdue-maintenance blocks for work already due. Anything that becomes overdue later blocks the truck again."
        confirmLabel="Lift restriction"
        busy={liftState.isLoading}
        error={error}
        onClose={() => setLifting(null)}
        onConfirm={doLift}
      />
      <ReasonModal
        open={restricting}
        title="Block a truck from new jobs"
        description="The truck cannot bid or be assigned until the block is lifted. Trips already under way are not interrupted."
        confirmLabel="Block truck"
        tone="danger"
        busy={restrictState.isLoading}
        confirmDisabled={!truckId}
        error={error || (trucks.error ? maintenanceError(trucks.error) : "")}
        onClose={() => setRestricting(false)}
        onConfirm={doRestrict}
      >
        <Select label="Truck" placeholder={trucks.isFetching ? "Loading trucks…" : "Select a truck"} options={(trucks.currentData || []).map((t) => ({ value: t.id, label: t.plate }))} value={truckId} onChange={(e) => setTruckId(e.target.value)} />
      </ReasonModal>
    </SectionCard>
  );
}
