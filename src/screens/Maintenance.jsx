"use client";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  Card,
  Tabs,
  SearchField,
  DataTable,
  Pagination,
  Badge,
  Icon,
  Modal,
  TextField,
  Select,
  Textarea,
  DropdownMenu,
  ListRow,
  Skeleton,
  EmptyState,
} from "../ds.js";
import { ProgressBar } from "../ds/components/data/ProgressBar.jsx";
import { DriverTableLoading } from "./DriversLoading.jsx";
import { maintenanceError, maintenanceHref, maintenanceTabs, maintenanceWindow, useGetAdminMaintenanceQuery, useGetAdminMaintenanceStatsQuery, useLazyExportAdminMaintenanceQuery, useImportAdminMaintenanceMutation, useUpdateAdminMaintenanceStatusMutation, useCreateAdminMaintenanceMutation, useGetAdminMaintenanceTruckOptionsQuery } from "../store/features/maintenance/maintenanceApi.js";
import { MaintenanceActionDialogs } from "./MaintenanceActionDialogs.jsx";
import "./Maintenance.css";
const PAGE_SIZE = 10,
  STATUSES = [
    "All Statuses",
    "Scheduled",
    "In Progress",
    "Completed",
    "Overdue",
    "Cancelled",
  ],
  PRIORITIES = ["All Priorities", "High", "Medium", "Low"],
  TYPES = ["All Types", "Preventive", "Repair", "Inspection", "Breakdown"];
const STATUS_TONE = {
    Scheduled: "info",
    "In Progress": "warning",
    Completed: "success",
    Overdue: "danger",
    Cancelled: "neutral",
  },
  TYPE_TONE = {
    Preventive: "info",
    Repair: "orange",
    Inspection: "success",
    Breakdown: "danger",
  },
  PRI_COLOR = {
    High: "var(--tk-danger)",
    Medium: "var(--tk-warning)",
    Low: "var(--tk-success)",
  };
const maintenanceApprovals = [
  {
    id: 1,
    icon: "bell",
    iconTint: "green",
    key: "repair",
    title: "Repair requests",
  },
  {
    id: 2,
    icon: "wrench",
    iconTint: "amber",
    key: "preventive",
    title: "Preventive maintenance requests",
  },
  {
    id: 3,
    icon: "triangle-alert",
    iconTint: "red",
    key: "major",
    title: "Major repair requests",
  },
];
function csv(content) {
  const u = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = u;
  a.download = "maintenance.csv";
  a.click();
  URL.revokeObjectURL(u);
}
export function Maintenance() {
  const navigate = useNavigate();
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const owner = useSelector(state => state.auth.admin?.id);
  const role = useSelector(state => state.auth.admin?.role);
  const canWrite = ["SUPER_ADMIN", "OPS_ADMIN"].includes(role);
  const busy = useRef(false);
  const [tab, setTab] = useState("All Maintenance"),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("All Statuses"),
    [priority, setPriority] = useState("All Priorities"),
    [type, setType] = useState("All Types"),
    [date, setDate] = useState(""),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(PAGE_SIZE),
    [schedule, setSchedule] = useState(false),
    [actionDialog, setActionDialog] = useState(null),
    [menu, setMenu] = useState(null),
    [form, setForm] = useState({
      plate: "",
      type: "Preventive",
      description: "",
      serviceCenter: "",
      location: "",
      dueDate: "",
      priority: "Medium",
      estimatedCost: "",
      notes: "",
    }),
    [toast, setToast] = useState(""),
    [pendingOnly, setPendingOnly] = useState(false);
  const conflicting = status !== "All Statuses" && (pendingOnly || tab !== "All Maintenance" && status !== tab);
  const args = { owner, tab: pendingOnly ? "requested" : maintenanceTabs[status !== "All Statuses" ? status : tab], search: q.trim(), priority: priority === "All Priorities" ? undefined : priority.toUpperCase(), type: type === "All Types" ? undefined : type.toUpperCase(), ...(date ? { dateFrom: `${date}T00:00:00+01:00`, dateTo: `${date}T23:59:59.999+01:00` } : {}), page, limit: pageSize };
  const list = useGetAdminMaintenanceQuery(args, { skip: !authenticated || conflicting, refetchOnMountOrArgChange: true });
  const statsQuery = useGetAdminMaintenanceStatsQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const stats = statsQuery.error ? null : statsQuery.currentData;
  const window = maintenanceWindow();
  const upcomingQuery = useGetAdminMaintenanceQuery({ owner, tab: "scheduled", ...window, page: 1, limit: 100 }, { skip: !authenticated });
  const upcomingRows = upcomingQuery.error ? [] : upcomingQuery.currentData?.rows || [];
  const fleetQuery = useGetAdminMaintenanceTruckOptionsQuery({ owner }, { skip: !authenticated || !schedule });
  const trucks = fleetQuery.error ? [] : fleetQuery.currentData || [];
  const paged = conflicting || list.error ? [] : list.currentData?.rows || [];
  const total = conflicting ? 0 : list.error ? null : list.currentData?.pagination.total;
  const pageCount = conflicting ? 1 : list.currentData?.pagination.totalPages || 1;
  const [exportMaintenance] = useLazyExportAdminMaintenanceQuery();
  const [importMaintenance] = useImportAdminMaintenanceMutation();
  const [updateStatus] = useUpdateAdminMaintenanceStatusMutation();
  const [createMaintenance, createState] = useCreateAdminMaintenanceMutation();
  const value = v => v == null ? "—" : v.toLocaleString("en-NG");
  const statValue = v => statsQuery.isFetching ? <Skeleton as="span" width={54} height={23} /> : value(v);
  const share = v => v == null ? "—" : `${v}%`;
  const overview = stats?.overview || [];
  const colors = ["var(--tk-blue)", "var(--tk-warning)", "var(--tk-success)", "var(--tk-danger)"];
  const shares = overview.map(s => s.percent);
  let ringEnd = 0;
  const ring = shares.length === 4 && shares.every(p => p != null && p <= 100) && Math.abs(shares.reduce((a, b) => a + b, 0) - 100) < 1
    ? `conic-gradient(${shares.map((p, i) => { const start = ringEnd; ringEnd += p; return `${colors[i]} ${start}% ${ringEnd}%`; }).join(",")})` : "var(--tk-viz-track)";
  useEffect(() => { if (trucks.length && !form.plate) setForm(f => ({ ...f, plate: trucks[0].plate })); }, [trucks, form.plate]);
  useEffect(() => { if (list.error) notify(maintenanceError(list.error)); }, [list.error]);
  useEffect(() => { if (fleetQuery.error) notify(maintenanceError(fleetQuery.error)); }, [fleetQuery.error]);
  useEffect(() => { if (statsQuery.error) notify(maintenanceError(statsQuery.error)); }, [statsQuery.error]);
  function notify(s) {
    setToast(s);
    setTimeout(() => setToast(""), 1600);
  }
  async function submit() {
    if (!form.plate || !form.description || !form.dueDate) return;
    if (busy.current) return;
    if (!canWrite) return notify("Your account cannot perform this maintenance operation.");
    const matching = trucks.filter(truck => truck.plate === form.plate);
    if (matching.length !== 1 || !matching[0].id) return notify("Select an available truck before scheduling maintenance.");
    busy.current = true;
    try { await createMaintenance({ truckId: matching[0].id, type: form.type.toUpperCase(), priority: form.priority.toUpperCase(), description: form.description, dueDate: form.dueDate, serviceCenterName: form.serviceCenter, serviceCenterLocation: form.location, estimatedCost: form.estimatedCost, notes: form.notes }).unwrap(); setSchedule(false); setForm({ plate: "", type: "Preventive", description: "", serviceCenter: "", location: "", dueDate: "", priority: "Medium", estimatedCost: "", notes: "" }); }
    catch (error) { notify(maintenanceError(error)); }
    finally { busy.current = false; }
  }
  async function changeStatus(r, action) {
    if (busy.current) return;
    if (!canWrite) return notify("Your account cannot perform this maintenance operation.");
    const allowed = action === "start" ? ["SCHEDULED"] : action === "cancel" ? ["REQUESTED", "SCHEDULED", "IN_PROGRESS"] : ["SCHEDULED", "IN_PROGRESS"];
    if (!allowed.includes(r.statusCode)) return notify("This action is unavailable for the current maintenance status.");
    busy.current = true;
    try { await updateStatus({ id: r.id, action }).unwrap(); setMenu(null); }
    catch (error) { notify(maintenanceError(error)); }
    finally { busy.current = false; }
  }
  async function exportRows() {
    if (busy.current) return;
    if (conflicting) return notify("The selected status filters do not match any records.");
    busy.current = true;
    try { csv(await exportMaintenance(args, false).unwrap()); setMenu(null); }
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
  return (
    <div className="maint-page">
      <PageHeader
        crumbs={["Fleet", "Fleet Management", "Maintenance"]}
        title="Maintenance"
        description="Track, manage and schedule maintenance activities for all fleet assets."
        actions={
          <>
            {/* <Button iconRight="chevron-down" onClick={() => setSchedule(true)}>
              Review Maintenance
            </Button> */}
            <Button
              variant="outline"
              icon="download"
              onClick={importFile}
            >
              Import
            </Button>
            <Button
              variant="outline"
              iconRight="chevron-down"
              onClick={() => setMenu(menu === "more" ? null : "more")}
            >
              More Actions
            </Button>
            {menu === "more" && (
              <span
                style={{
                  position: "absolute",
                  right: 20,
                  top: 120,
                  zIndex: 30,
                }}
              >
                <DropdownMenu
                  items={[
                    {
                      label: "Export Maintenance",
                      icon: "download",
                      onClick: exportRows,
                    },
                    {
                      label: "Service Centers",
                      icon: "building-2",
                      onClick: () => setActionDialog("centers"),
                    },
                    {
                      label: "Maintenance Rules",
                      icon: "settings",
                      onClick: () => setActionDialog("policies"),
                    },
                  ]}
                />
              </span>
            )}
          </>
        }
      />
      <div className="maint-stats">
        <StatCard
          icon="truck"
          label="Total Trucks"
          value={statValue(stats?.totalTrucks)}
          caption={stats?.trucksCaption || "— Trucks · — Trailers · — Others"}
        />
        <StatCard
          icon="wrench"
          tint="amber"
          label="In Maintenance"
          value={statValue(stats?.inMaintenance)}
          caption={`${share(stats?.inMaintenancePercent)} of total`}
        />
        <StatCard
          icon="calendar-days"
          label="Due Soon"
          value={statValue(stats?.dueSoon)}
          caption="Within next 7 days"
        />
        <StatCard
          icon="triangle-alert"
          tint="red"
          label="Overdue"
          value={statValue(stats?.overdue)}
          caption="Requires immediate attention"
        />
        <StatCard
          icon="lock-keyhole"
          tint="red"
          label="Restricted Assets"
          value={statValue(stats?.restrictedAssets)}
          caption="Not eligible for new jobs"
        />
        <StatCard
          icon="file-text"
          tint="blue"
          label="Pending Approvals"
          value={statValue(stats?.pendingApprovals)}
          caption="Maintenance requests"
        />
      </div>
      <div className="maint-row">
        <SectionCard title="Maintenance Overview">
          <div className="maint-chart">
            <div className="maint-ring" style={{ background: ring }} />
            <div className="maint-legend">
              {[
                ["Scheduled", `${value(overview[0]?.count)} (${share(overview[0]?.percent)})`, "var(--tk-blue)"],
                ["In Progress", `${value(overview[1]?.count)} (${share(overview[1]?.percent)})`, "var(--tk-warning)"],
                ["Completed", `${value(overview[2]?.count)} (${share(overview[2]?.percent)})`, "var(--tk-success)"],
                ["Overdue", `${value(overview[3]?.count)} (${share(overview[3]?.percent)})`, "var(--tk-danger)"],
              ].map((x) => (
                <span key={x[0]}>
                  <i style={{ color: x[2] }}>● {x[0]}</i>
                  <b>{x[1]}</b>
                </span>
              ))}
            </div>
          </div>
        </SectionCard>
        <SectionCard
          title="Asset Eligibility for Jobs"
          tooltip="Assets that are currently restricted or in maintenance will not be eligible for new jobs."
        >
          {[
            ["Eligible for jobs", stats?.eligibility[0]?.percent, "var(--tk-success)", stats?.eligibility[0]?.count],
            ["Under Maintenance", stats?.eligibility[1]?.percent, "var(--tk-warning)", stats?.eligibility[1]?.count],
            ["Pending Inspection", stats?.eligibility[2]?.percent, "var(--tk-blue)", stats?.eligibility[2]?.count],
            ["Restricted", stats?.eligibility[3]?.percent, "var(--tk-danger)", stats?.eligibility[3]?.count],
          ].map((x) => (
            <div className="maint-type-row-reverse" key={x[0]}>
              <ProgressBar
                value={x[1] ?? 0}
                label={x[0]}
                caption={`${share(x[1])} (${value(x[3])})`}
                color={x[2]}
              />
            </div>
          ))}
        </SectionCard>
        <SectionCard
          title="Maintenance by Type"
          action={
            <button
              style={{
                border: 0,
                background: "none",
                color: "var(--tk-blue)",
              }}
              onClick={() => { setType("All Types"); setPage(1); }}
            >
              View all
            </button>
          }
        >
          {[
            ["Preventive", stats?.byType[0], "var(--tk-blue)"],
            ["Repair", stats?.byType[1], "var(--tk-warning)"],
            ["Inspection", stats?.byType[2], "var(--tk-success)"],
            ["Breakdown", stats?.byType[3], "var(--tk-danger)"],
          ].map((x) => (
            <div className="maint-type-row" key={x[0]}>
              <Icon name="wrench" size={12} />

              <ProgressBar
                value={x[1] ?? 0}
                label={x[0]}
                caption={share(x[1])}
                color="var(--tk-blue-light)"
              />
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Maintenance Approvals" count={value(stats?.approvals.total)}>
          {maintenanceApprovals.map((r) => (
            <ListRow
              key={r.id}
              icon={r.icon}
              iconTint={r.iconTint}
              title={r.title}
              value={value(stats?.approvals[r.key])}
            />
          ))}

          <Button
            iconRight="arrow-right"
            fullWidth
            onClick={() => { setPendingOnly(true); setTab("All Maintenance"); setStatus("All Statuses"); setPage(1); }}
          >
            View Pending Approvals
          </Button>
        </SectionCard>
      </div>
      <div>
        <Card pad="none">
          <div className="maint-toolbar">
            <SearchField
              className="search"
              style={{ flex: 1 }}
              placeholder="Search by company, asset, maintenance ID, or description..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <select
              className="maint-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {STATUSES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              className="maint-select"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
            >
              {PRIORITIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              className="maint-select"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              {TYPES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input
              className="maint-select"
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setPage(1); }}
            />
            <Button
              variant="outline"
              icon="rotate-ccw"
              onClick={() => {
                setPendingOnly(false);
                setQ("");
                setStatus("All Statuses");
                setPriority("All Priorities");
                setType("All Types");
                setDate("");
                setPage(1);
              }}
            >
              Reset
            </Button>
          </div>
        </Card>
      </div>
      <div className="maint-layout">
        <div className="maint-main">
          <SectionCard title="" pad="none">
            <Tabs
              value={tab}
              onChange={(v) => {
                setPendingOnly(false);
                setTab(v);
                setPage(1);
              }}
              items={[
                "All Maintenance",
                "Scheduled",
                "In Progress",
                "Completed",
                "Overdue",
                "Cancelled",
              ]}
              style={{ padding: "0 16px" }}
            />
            {list.isFetching && !conflicting ? <DriverTableLoading columns={10} label="Loading maintenance" /> : list.error ? <EmptyState icon="wrench" title={maintenanceError(list.error)} /> : <DataTable
              rows={paged}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(maintenanceHref(r.id))}
              columns={[
                {
                  key: "id",
                  header: "Maintenance ID",
                  render: (r) => (
                    <span className="maint-cell">
                      <strong style={{ color: "var(--tk-blue)" }}>
                        {r.reference}
                      </strong>
                      <small>{r.created}</small>
                    </span>
                  ),
                },
                {
                  key: "company",
                  header: "Company",
                  render: (r) => (
                    <span className="maint-cell">{r.company}</span>
                  ),
                },
                {
                  key: "plate",
                  header: "Truck / Plate No.",
                  render: (r) => (
                    <span className="maint-truck">
                      <span className="maint-truck-pic">
                        <Icon name="truck" size={18} />
                      </span>
                      <span className="maint-cell">
                        <strong>{r.plate}</strong>
                        <small>{r.truckType}</small>
                      </span>
                    </span>
                  ),
                },
                {
                  key: "type",
                  header: "Type",
                  render: (r) => (
                    <Badge tone={TYPE_TONE[r.type]}>{r.type}</Badge>
                  ),
                },
                {
                  key: "description",
                  header: "Description",
                  render: (r) => (
                    <span style={{ fontSize: 12 }}>{r.description}</span>
                  ),
                },
                {
                  key: "serviceCenter",
                  header: "Service Center",
                  render: (r) => (
                    <span className="maint-cell">
                      <strong>{r.serviceCenter}</strong>
                      <small>{r.location}</small>
                    </span>
                  ),
                },
                {
                  key: "dueDate",
                  header: "Due Date",
                  render: (r) => (
                    <span className="maint-cell">
                      <strong
                        style={{
                          color:
                            r.status === "Overdue"
                              ? "var(--tk-danger)"
                              : undefined,
                        }}
                      >
                        {r.dueDate}
                      </strong>
                      <small style={{ color: "var(--tk-danger)" }}>
                        ({r.dueLabel})
                      </small>
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  ),
                },
                {
                  key: "priority",
                  header: "Priority",
                  render: (r) => (
                    <span style={{ whiteSpace: "nowrap", fontSize: 10 }}>
                      <i
                        style={{
                          display: "inline-block",
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: PRI_COLOR[r.priority],
                          marginRight: 6,
                        }}
                      />
                      {r.priority}
                    </span>
                  ),
                },
                {
                  key: "x",
                  header: "Actions",
                  render: (r) => (
                    <span style={{ display: "flex", gap: 4 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        icon="eye"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(maintenanceHref(r.id));
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        icon="ellipsis-vertical"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenu(menu === r.id ? null : r.id);
                        }}
                      />
                      {menu === r.id && (
                        <span
                          style={{
                            position: "absolute",
                            right: 40,
                            zIndex: 30,
                          }}
                        >
                          <DropdownMenu
                            items={[
                              {
                                label: "View Maintenance",
                                icon: "eye",
                                onClick: () => navigate(maintenanceHref(r.id)),
                              },
                              {
                                label: "Start Work",
                                icon: "play",
                                onClick: () => {
                                  changeStatus(r, "start");
                                },
                              },
                              {
                                label: "Mark Completed",
                                icon: "circle-check",
                                onClick: () => {
                                  changeStatus(r, "complete");
                                },
                              },
                              {
                                label: "Cancel",
                                icon: "circle-x",
                                tone: "danger",
                                onClick: () => {
                                  changeStatus(r, "cancel");
                                },
                              },
                            ]}
                          />
                        </span>
                      )}
                    </span>
                  ),
                },
              ]}
            />}
            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              total={total ?? undefined}
              onPage={(p) =>
                setPage(
                  Math.min(
                    Math.max(1, p),
                    Math.max(1, pageCount),
                  ),
                )
              }
              onPageSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </SectionCard>
        </div>
        <div className="maint-rail">
          <SectionCard
            title="Upcoming Maintenance (Next 7 Days)"
            action={
              <button
                style={{
                  border: 0,
                  background: "none",
                  color: "var(--tk-blue)",
                }}
                onClick={() => { setPendingOnly(false); setTab("All Maintenance"); setStatus("Scheduled"); setPage(1); }}
              >
                View all
              </button>
            }
          >
            {upcomingRows
              .slice(0, 3)
              .map((r) => (
                <button
                  className="maint-upcoming"
                  style={{
                    width: "100%",
                    borderLeft: 0,
                    borderRight: 0,
                    borderTop: 0,
                    background: "transparent",
                    textAlign: "left",
                  }}
                  key={r.id}
                  onClick={() => navigate(maintenanceHref(r.id))}
                >
                  <span className="ico">
                    <Icon name="truck" size={13} />
                  </span>
                  <span>
                    <strong>
                      {r.plate} ({r.truckType})
                    </strong>
                    <small>
                      {r.company} · {r.description}
                    </small>
                  </span>
                  <span style={{ fontSize: 10, textAlign: "right" }}>
                    {r.dueDate}
                    <small>{r.dueLabel}</small>
                  </span>
                </button>
              ))}
          </SectionCard>
          <SectionCard title="Quick Actions">
            <Action
              icon="building"
              title="Platform Maintenance Policies"
              hint="View and manage maintenance requirements"
              onClick={() => setSchedule(true)}
            />
            <Action
              icon="calendar"
              title="Maintenance Calendar"
              hint="View calendar and due dates"
              onClick={() => setActionDialog("calendar")}
            />
            <Action
              icon="file-text"
              title="Maintenance Reports"
              hint="Generate and export reports"
              onClick={() => {
                setPendingOnly(false);
                setStatus("All Statuses");
                setTab("Completed");
                setPage(1);
              }}
            />
            <Action
              icon="building-2"
              title="Service Centers"
              hint="Manage service centers"
              onClick={() => setActionDialog("centers")}
            />
          </SectionCard>
        </div>
      </div>
      <Modal
        open={schedule}
        onClose={() => setSchedule(false)}
        title="Schedule Maintenance"
        width={620}
        footer={
          <>
            <Button variant="outline" onClick={() => setSchedule(false)}>
              Cancel
            </Button>
            <Button
              disabled={createState.isLoading || !form.plate || !form.description || !form.dueDate}
              onClick={submit}
            >
              Schedule Maintenance
            </Button>
          </>
        }
      >
        <div className="maint-form">
          <div className="maint-form-grid">
            <Select
              label="Truck"
              options={trucks.map((t) => t.plate)}
              value={form.plate}
              onChange={(e) => setForm({ ...form, plate: e.target.value })}
            />
            <Select
              label="Maintenance Type"
              options={TYPES.slice(1)}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            />
          </div>
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="maint-form-grid">
            <TextField
              label="Service Center"
              value={form.serviceCenter}
              onChange={(e) =>
                setForm({ ...form, serviceCenter: e.target.value })
              }
            />
            <TextField
              label="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div className="maint-form-grid">
            <TextField
              label="Due Date"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
            <Select
              label="Priority"
              options={PRIORITIES.slice(1)}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
          </div>
          <TextField
            label="Estimated Cost"
            type="number"
            value={form.estimatedCost}
            onChange={(e) =>
              setForm({ ...form, estimatedCost: e.target.value })
            }
          />
          <Textarea
            label="Notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </Modal>
      {actionDialog && <MaintenanceActionDialogs kind={actionDialog} owner={owner} role={role} onClose={() => setActionDialog(null)} />}
      {toast && <div className="maint-toast">{toast}</div>}
    </div>
  );
}
function Action({ icon, title, hint, onClick }) {
  return (
    <button className="maint-action" onClick={onClick}>
      <span className="ico">
        <Icon name={icon} size={13} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
      <Icon name="chevron-right" size={13} />
    </button>
  );
}
