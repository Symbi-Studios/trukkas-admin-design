"use client";
import { useMemo, useState } from "react";
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
} from "../ds.js";
import { ProgressBar } from "../ds/components/data/ProgressBar.jsx";
import { useCollection } from "../mock/useCollection.js";
import { createMaintenance, updateMaintenance } from "../mock/api.js";
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
    count: 5,
    title: "Repair requests",
  },
  {
    id: 2,
    icon: "wrench",
    iconTint: "amber",
    count: 4,
    title: "Preventive maintenance requests",
  },
  {
    id: 3,
    icon: "triangle-alert",
    iconTint: "red",
    count: 3,
    title: "Major repair requests",
  },
];
function csv(rows) {
  const s = [
    [
      "ID",
      "Truck",
      "Type",
      "Description",
      "Service Center",
      "Due Date",
      "Status",
      "Priority",
    ],
    ...rows.map((r) => [
      r.id,
      r.plate,
      r.type,
      r.description,
      r.serviceCenter,
      r.dueDate,
      r.status,
      r.priority,
    ]),
  ]
    .map((x) => x.join(","))
    .join("\n");
  const u = URL.createObjectURL(new Blob([s]));
  const a = document.createElement("a");
  a.href = u;
  a.download = "maintenance.csv";
  a.click();
  URL.revokeObjectURL(u);
}
export function Maintenance() {
  const navigate = useNavigate(),
    rows = useCollection("maintenance") || [],
    trucks = useCollection("trucks") || [];
  const [tab, setTab] = useState("All Maintenance"),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("All Statuses"),
    [priority, setPriority] = useState("All Priorities"),
    [type, setType] = useState("All Types"),
    [date, setDate] = useState(""),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(PAGE_SIZE),
    [schedule, setSchedule] = useState(false),
    [menu, setMenu] = useState(null),
    [form, setForm] = useState({
      plate: trucks[0]?.plate || "",
      type: "Preventive",
      description: "",
      serviceCenter: "",
      location: "",
      dueDate: "",
      priority: "Medium",
      estimatedCost: "",
      notes: "",
    }),
    [toast, setToast] = useState("");
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (tab === "All Maintenance" || r.status === tab) &&
          (status === "All Statuses" || r.status === status) &&
          (priority === "All Priorities" || r.priority === priority) &&
          (type === "All Types" || r.type === type) &&
          (!date ||
            r.dueDate.includes(
              new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            )) &&
          (!q ||
            [r.id, r.plate, r.description, r.serviceCenter].some((v) =>
              v.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [rows, tab, status, priority, type, date, q],
  );
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  function notify(s) {
    setToast(s);
    setTimeout(() => setToast(""), 1600);
  }
  async function submit() {
    if (!form.plate || !form.description || !form.dueDate) return;
    const r = await createMaintenance({
      ...form,
      dueLabel: "Scheduled",
      created: "Just now",
    });
    setSchedule(false);
    navigate("/maintenance/" + r.id);
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
              onClick={() => notify("Import template downloaded")}
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
                      onClick: () => csv(filtered),
                    },
                    {
                      label: "Service Centers",
                      icon: "building-2",
                      onClick: () => notify("Service centers opened"),
                    },
                    {
                      label: "Maintenance Rules",
                      icon: "settings",
                      onClick: () => notify("Maintenance rules opened"),
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
          value="486"
          caption="312 Trucks · 128 Trailers · 46 Others"
        />
        <StatCard
          icon="wrench"
          tint="amber"
          label="In Maintenance"
          value="36"
          caption="7.4% of total"
        />
        <StatCard
          icon="calendar-days"
          label="Due Soon"
          value="27"
          caption="Within next 7 days"
        />
        <StatCard
          icon="triangle-alert"
          tint="red"
          label="Overdue"
          value="6"
          caption="Requires immediate attention"
        />
        <StatCard
          icon="lock-keyhole"
          tint="red"
          label="Restricted Assets"
          value="14"
          caption="Not eligible for new jobs"
        />
        <StatCard
          icon="file-text"
          tint="blue"
          label="Pending Approvals"
          value="12"
          caption="Maintenance requests"
        />
      </div>
      <div className="maint-row">
        <SectionCard title="Maintenance Overview">
          <div className="maint-chart">
            <div className="maint-ring" />
            <div className="maint-legend">
              {[
                ["Scheduled", "210 (43.2%)", "var(--tk-blue)"],
                ["In Progress", "36 (7.4%)", "var(--tk-warning)"],
                ["Completed", "178 (36.6%)", "var(--tk-success)"],
                ["Overdue", "6 (12.8%)", "var(--tk-danger)"],
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
            ["Eligible for jobs", 90.1, "var(--tk-success)", 438],
            ["Under Maintenance", 7.4, "var(--tk-warning)", 36],
            ["Pending Inspection", 1.6, "var(--tk-blue)", 8],
            ["Restricted", 2.9, "var(--tk-danger)", 14],
          ].map((x) => (
            <div className="maint-type-row-reverse" key={x[0]}>
              <ProgressBar
                value={[x[1]]}
                label={x[0]}
                caption={`${x[1]}% (${x[3]})`}
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
              onClick={() => setType("All")}
            >
              View all
            </button>
          }
        >
          {[
            ["Preventive", 49.8, "var(--tk-blue)"],
            ["Repair", 34.2, "var(--tk-warning)"],
            ["Inspection", 11.9, "var(--tk-success)"],
            ["Breakdown", 4.1, "var(--tk-danger)"],
          ].map((x) => (
            <div className="maint-type-row" key={x[0]}>
              <Icon name="wrench" size={12} />

              <ProgressBar
                value={[x[1]]}
                label={x[0]}
                caption={`${x[1]}%`}
                color="var(--tk-blue-light)"
              />
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Maintenance Approvals" count={12}>
          {maintenanceApprovals.map((r) => (
            <ListRow
              key={r.id}
              icon={r.icon}
              iconTint={r.iconTint}
              title={r.title}
              value={r.count}
            />
          ))}

          <Button
            iconRight="arrow-right"
            fullWidth
            onClick={() => notify("Import template downloaded")}
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
              onChange={(e) => setDate(e.target.value)}
            />
            <Button
              variant="outline"
              icon="rotate-ccw"
              onClick={() => {
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
            <DataTable
              rows={paged}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate("/maintenance/" + r.id)}
              columns={[
                {
                  key: "id",
                  header: "Maintenance ID",
                  render: (r) => (
                    <span className="maint-cell">
                      <strong style={{ color: "var(--tk-blue)" }}>
                        {r.id}
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
                          navigate("/maintenance/" + r.id);
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
                                onClick: () => navigate("/maintenance/" + r.id),
                              },
                              {
                                label: "Start Work",
                                icon: "play",
                                onClick: () => {
                                  updateMaintenance(r.id, {
                                    status: "In Progress",
                                  });
                                  setMenu(null);
                                },
                              },
                              {
                                label: "Mark Completed",
                                icon: "circle-check",
                                onClick: () => {
                                  updateMaintenance(r.id, {
                                    status: "Completed",
                                    actualCost: r.estimatedCost,
                                  });
                                  setMenu(null);
                                },
                              },
                              {
                                label: "Cancel",
                                icon: "circle-x",
                                tone: "danger",
                                onClick: () => {
                                  updateMaintenance(r.id, {
                                    status: "Cancelled",
                                  });
                                  setMenu(null);
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
            />
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(filtered.length / pageSize))}
              pageSize={pageSize}
              total={filtered.length}
              onPage={(p) =>
                setPage(
                  Math.min(
                    Math.max(1, p),
                    Math.max(1, Math.ceil(filtered.length / pageSize)),
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
                onClick={() => setStatus("Scheduled")}
              >
                View all
              </button>
            }
          >
            {rows
              .filter((r) => r.status === "Scheduled")
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
                  onClick={() => navigate("/maintenance/" + r.id)}
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
              onClick={() => notify("Calendar view opened")}
            />
            <Action
              icon="file-text"
              title="Maintenance Reports"
              hint="Generate and export reports"
              onClick={() => {
                setTab("Completed");
                setPage(1);
              }}
            />
            <Action
              icon="building-2"
              title="Service Centers"
              hint="Manage service centers"
              onClick={() => notify("Service centers opened")}
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
              disabled={!form.plate || !form.description || !form.dueDate}
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
