"use client";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "../../router.js";
import { Badge, Button, DataTable, DropdownMenu, Icon, Pagination, SearchField, SectionCard, TableToolbar, ViewToggle } from "../../ds.js";
import { CustomSelect } from "../../ds/components/forms/Select.jsx";
import { DateRangeFilter, EMPTY_RANGE, rangeParams } from "../../components/DateRangeFilter.jsx";
import { usePageSearchState } from "../../components/PageSearch.jsx";
import { BOARD_LAYOUTS } from "../../domain/boardLayouts.js";
import { DriverTableLoading } from "../DriversLoading.jsx";
import {
  maintenanceError, maintenanceHref, maintenanceTabs,
  useGetAdminMaintenanceQuery, useImportAdminMaintenanceMutation, useLazyExportAdminMaintenanceQuery, useUpdateAdminMaintenanceStatusMutation,
} from "../../store/features/maintenance/maintenanceApi.js";
import { RECORD_TONE, ReadState, urlParam } from "./shared.jsx";

const PAGE_SIZE = 10;
const STATUSES = ["All Statuses", "Requested", "Scheduled", "In Progress", "Awaiting Verification", "Overdue", "Completed", "Rejected", "Cancelled"];
const PRIORITIES = ["All Priorities", "High", "Medium", "Low"];
const TYPES = ["All Types", "Preventive", "Repair", "Inspection", "Breakdown"];
const TYPE_TONE = { Preventive: "info", Repair: "orange", Inspection: "success", Breakdown: "danger" };
const PRI_COLOR = { High: "var(--tk-danger)", Medium: "var(--tk-warning)", Low: "var(--tk-success)" };

function csv(content) {
  const u = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = u;
  a.download = "maintenance.csv";
  a.click();
  URL.revokeObjectURL(u);
}

/** Every service record across the platform. Admins oversee these; companies create and complete them. */
export function ServiceRecords({ owner, authenticated, canWrite, notify }) {
  const navigate = useNavigate();
  const busy = useRef(false);
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [tableView, setTableView] = useState("list");
  const [q, setQ] = usePageSearchState("", () => setPage(1));
  const [status, setStatus] = useState(() => (STATUSES.includes(urlParam("status")) ? urlParam("status") : "All Statuses"));
  const [truckId, setTruckId] = useState(() => urlParam("truckId"));
  const [priority, setPriority] = useState("All Priorities");
  const [type, setType] = useState("All Types");
  const [date, setDate] = useState(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [menu, setMenu] = useState(null);

  const args = {
    owner, tab: status === "All Statuses" ? "all" : maintenanceTabs[status], search: q.trim(), truckId: truckId || undefined,
    priority: priority === "All Priorities" ? undefined : priority.toUpperCase(), type: type === "All Types" ? undefined : type.toUpperCase(),
    ...rangeParams(date), page, limit: pageSize,
  };
  const list = useGetAdminMaintenanceQuery(args, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const rows = list.error ? [] : list.currentData?.rows || [];
  const total = list.error ? null : list.currentData?.pagination.total;
  const pageCount = list.currentData?.pagination.totalPages || 1;
  const truckPlate = truckId ? rows[0]?.plate : null;
  const [exportMaintenance] = useLazyExportAdminMaintenanceQuery();
  const [importMaintenance] = useImportAdminMaintenanceMutation();
  const [updateStatus] = useUpdateAdminMaintenanceStatusMutation();

  useEffect(() => { if (list.error) notify(maintenanceError(list.error)); }, [list.error]);

  async function cancel(r) {
    if (busy.current) return;
    if (!canWrite) return notify("Your account cannot perform this maintenance operation.");
    if (!["REQUESTED", "SCHEDULED", "IN_PROGRESS"].includes(r.statusCode)) return notify("Only open maintenance can be cancelled.");
    busy.current = true;
    try { await updateStatus({ id: r.id, action: "cancel" }).unwrap(); setMenu(null); notify(`${r.reference} cancelled.`); }
    catch (error) { notify(maintenanceError(error)); }
    finally { busy.current = false; }
  }
  async function exportRows() {
    if (busy.current) return;
    busy.current = true;
    try { csv(await exportMaintenance(args, false).unwrap()); }
    catch (error) { notify(maintenanceError(error)); }
    finally { busy.current = false; }
  }
  function importFile() {
    if (busy.current) return;
    if (!canWrite) return notify("Your account cannot import maintenance records.");
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".csv,text/csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || busy.current) return;
      if (file.size > 2 * 1024 * 1024) return notify("The CSV must be no larger than 2 MB.");
      busy.current = true;
      try { const result = await importMaintenance(file).unwrap(); notify(`${result.created} created; ${result.failed} failed.${result.errors.length ? ` ${result.errors.join(" ")}` : ""}`); }
      catch (error) { notify(maintenanceError(error)); }
      finally { busy.current = false; }
    };
    input.click();
  }
  function reset() {
    setQ(""); setStatus("All Statuses"); setPriority("All Priorities"); setType("All Types"); setDate(EMPTY_RANGE); setTruckId(null); setPage(1);
  }
  const select = (value, setter, options) => (
    <CustomSelect className="maint-select" value={value} onChange={(e) => { setter(e.target.value); setPage(1); }}>
      {options.map((x) => <option key={x}>{x}</option>)}
    </CustomSelect>
  );

  return (
    <SectionCard title="" pad="none">
      <TableToolbar
        search={<SearchField className="search" style={{ flex: 1 }} placeholder="Search by company, plate, maintenance ID, or description..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
        filters={<>
          {select(status, setStatus, STATUSES)}
          {select(priority, setPriority, PRIORITIES)}
          {select(type, setType, TYPES)}
          <DateRangeFilter name="Due" value={date} onChange={(next) => { setDate(next); setPage(1); }} />
          {truckId && <Button variant="outline" iconRight="x" onClick={() => { setTruckId(null); setPage(1); }}>Truck: {truckPlate || "selected"}</Button>}
          <Button variant="outline" icon="rotate-ccw" onClick={reset}>Reset</Button>
        </>}
        viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
        trailing={<span style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" icon="download" onClick={exportRows}>Export</Button>
          {canWrite && <Button variant="outline" icon="upload" onClick={importFile}>Import</Button>}
        </span>}
      />
      {list.isFetching ? <DriverTableLoading columns={9} label="Loading maintenance" /> : list.error ? <ReadState error={list.error} retry={list.refetch} /> : (
        <DataTable
          boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.maintenance} view={tableView} boardGroupBy={(row) => row.status}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(maintenanceHref(r.id))}
          columns={[
            { key: "id", header: "Maintenance ID", render: (r) => <span className="maint-cell"><strong style={{ color: "var(--tk-blue)" }}>{r.reference}</strong><small>{r.created}</small></span> },
            { key: "company", header: "Company", render: (r) => <span className="maint-cell">{r.company}</span> },
            { key: "plate", header: "Truck / Plate No.", render: (r) => (
              <span className="maint-truck">
                <span className="maint-truck-pic"><Icon name="truck" size={18} /></span>
                <span className="maint-cell"><strong>{r.plate}</strong><small>{r.truckType}</small></span>
              </span>
            ) },
            { key: "type", header: "Type", render: (r) => <Badge tone={TYPE_TONE[r.type]}>{r.type}</Badge> },
            { key: "description", header: "Description", render: (r) => <span style={{ fontSize: 12 }}>{r.description}</span> },
            { key: "serviceCenter", header: "Workshop", render: (r) => <span className="maint-cell"><strong>{r.serviceCenter}</strong><small>{r.location}</small></span> },
            { key: "dueDate", header: "Due Date", render: (r) => (
              <span className="maint-cell">
                <strong style={{ color: r.status === "Overdue" ? "var(--tk-danger)" : undefined }}>{r.dueDate}</strong>
                <small style={{ color: r.status === "Overdue" ? "var(--tk-danger)" : undefined }}>{r.dueLabel}</small>
              </span>
            ) },
            { key: "status", header: "Status", render: (r) => <Badge tone={RECORD_TONE[r.status]}>{r.status}</Badge> },
            { key: "priority", header: "Priority", render: (r) => (
              <span style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                <i style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: PRI_COLOR[r.priority], marginRight: 6 }} />
                {r.priority}
              </span>
            ) },
            { key: "x", header: "", render: (r) => (
              <span style={{ display: "flex", gap: 4, position: "relative" }}>
                <Button variant="outline" size="sm" icon="ellipsis-vertical" aria-label={`Actions for ${r.reference}`} onClick={(e) => { e.stopPropagation(); setMenu(menu === r.id ? null : r.id); }} />
                {menu === r.id && (
                  <span style={{ position: "absolute", right: 0, top: 34, zIndex: 30 }} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      width={210}
                      items={[
                        { label: "View record", icon: "eye", onClick: () => navigate(maintenanceHref(r.id)) },
                        { label: "Truck's records", icon: "truck", onClick: () => { setMenu(null); setTruckId(r.truckId); setPage(1); } },
                        ...(canWrite && ["REQUESTED", "SCHEDULED", "IN_PROGRESS"].includes(r.statusCode) ? [{ divider: true }, { label: "Cancel maintenance", icon: "circle-x", tone: "danger", onClick: () => cancel(r) }] : []),
                      ]}
                    />
                  </span>
                )}
              </span>
            ) },
          ]}
        />
      )}
      <Pagination
        page={page} pageCount={pageCount} pageSize={pageSize} total={total ?? undefined}
        onPage={(p) => setPage(Math.min(Math.max(1, p), Math.max(1, pageCount)))}
        onPageSize={(n) => { setPageSize(n); setPage(1); }}
      />
    </SectionCard>
  );
}
