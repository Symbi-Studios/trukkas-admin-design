import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "../router.js";
import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  DropdownMenu,
  Icon,
  Modal,
  Pagination,
  Select,
  TextField,
} from "../ds.js";
import "./Operations.css";

const initialRows = [
  [
    "JOB-29821",
    "Container",
    "Goodwill Forwarding Ltd.",
    "Lagos, Nigeria",
    "Import (Container)",
    "Apapa Port",
    "Ikeja Warehouse",
    "₦1,450,000",
    "Pending Approval",
    "May 30, 2026",
    "09:42 AM",
    2,
  ],
  [
    "JOB-29820",
    "Container",
    "CargoLink Logistics",
    "Lagos, Nigeria",
    "Export",
    "Tin Can Port",
    "Onne Port",
    "₦2,230,000",
    "Bidding",
    "May 30, 2026",
    "09:37 AM",
  ],
  [
    "JOB-29819",
    "Container",
    "ABC Forwarders Ltd.",
    "Lagos, Nigeria",
    "Transfer / Value Chain",
    "Apapa Port",
    "Ibeju Lekki → Ogun",
    "₦3,120,000",
    "Assigned",
    "May 30, 2026",
    "09:22 AM",
  ],
  [
    "JOB-29818",
    "Container",
    "DCL Shipping Services",
    "Port Harcourt, Nigeria",
    "Import (Container)",
    "Port Harcourt",
    "Aba Depot",
    "₦980,000",
    "In Transit",
    "May 30, 2026",
    "08:58 AM",
  ],
  [
    "JOB-29817",
    "Break-Bulk",
    "Nigerian Bulk Consortia",
    "Lagos, Nigeria",
    "Break-Bulk",
    "Apapa Port",
    "Ibadan Dry Port",
    "₦4,860,000",
    "Delivered",
    "May 30, 2026",
    "08:15 AM",
  ],
  [
    "JOB-29816",
    "Container",
    "Transglobal Logistics",
    "Lagos, Nigeria",
    "Import (Container)",
    "Tin Can Port",
    "Lagos Island",
    "₦1,250,000",
    "Container Return",
    "May 30, 2026",
    "07:48 AM",
  ],
  [
    "JOB-29815",
    "Container",
    "Maersk Line Nigeria",
    "Lagos, Nigeria",
    "Export",
    "Ikeja Warehouse",
    "Apapa Port",
    "₦1,780,000",
    "Awaiting Confirmation",
    "May 30, 2026",
    "07:12 AM",
  ],
  [
    "JOB-29814",
    "Break-Bulk",
    "BuildMax Materials",
    "Lagos, Nigeria",
    "Break-Bulk",
    "Lagos Port",
    "Multiple Sites",
    "₦9,450,000",
    "Completed",
    "May 30, 2026",
    "05:32 AM",
  ],
  [
    "JOB-29813",
    "Container",
    "Prime Container Services",
    "Lagos, Nigeria",
    "Transfer / Value Chain",
    "Lekki Terminal",
    "Ibadan → Ilorin",
    "₦2,950,000",
    "Delayed",
    "May 29, 2026",
    "11:45 PM",
  ],
  [
    "JOB-29812",
    "Container",
    "Westafrica Forwarders",
    "Lagos, Nigeria",
    "Import (Container)",
    "Apapa Port",
    "Mainland Depot",
    "₦1,080,000",
    "Cancelled",
    "May 29, 2026",
    "10:15 PM",
  ],
].map((r) => ({
  id: r[0],
  kind: r[1],
  customer: r[2],
  location: r[3],
  type: r[4],
  origin: r[5],
  destination: r[6],
  value: r[7],
  status: r[8],
  date: r[9],
  time: r[10],
  trucks: r[11] || 1,
}));

const ALL_STATUSES = [
  "Pending Approval",
  "Bidding",
  "Assigned",
  "In Transit",
  "Delivered",
  "Container Return",
  "Awaiting Confirmation",
  "Completed",
  "Delayed",
  "Cancelled",
];
const TRIP_TYPES = [
  "Port-to-Destination",
  "Port-to-Port",
  "Break-Bulk",
  "Hijack",
];
const statusTone = (s) =>
  ({
    "Pending Approval": "warning",
    Bidding: "purple",
    Assigned: "info",
    "In Transit": "success",
    Delivered: "teal",
    "Container Return": "info",
    "Awaiting Confirmation": "warning",
    Completed: "success",
    Delayed: "danger",
    Cancelled: "neutral",
  })[s] || "neutral";
const NAV_ITEMS = [
  ["All Jobs", "1,248"],
  ["Pending Approval", "17"],
  ["Bidding", "42"],
  ["Assigned", "36"],
  ["In Transit", "186"],
  ["Delivered", "51"],
  ["Container Return", "34"],
  ["Awaiting Confirmation", "11"],
  ["Completed", "942"],
  ["Cancelled", "23"],
  ["Flagged", "15"],
];
const TRIP_NAV_ITEMS = [
  ["All Trips", "1,586"],
  ["In Transit", "186"],
  ["At Pickup", "28"],
  ["At Delivery", "51"],
  ["Returning Container", "34"],
  ["Delayed", "28"],
  ["GPS Offline", "6"],
  ["Completed Today", "94"],
];
const EMPTY_FORM = {
  customer: "",
  location: "",
  type: "Import (Container)",
  origin: "",
  destination: "",
  value: "",
};
const PAGE_SIZE = 10;

function NavLink({ label, count, active, onClick }) {
  return (
    <div
      className={"jobs-nav-link " + (active ? "active" : "")}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <span>{label}</span>
      <b>{count}</b>
    </div>
  );
}

export function JobsTrips() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All Jobs");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [originFilter, setOriginFilter] = useState("All Locations");
  const [destFilter, setDestFilter] = useState("All Locations");
  const [openFilter, setOpenFilter] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, originFilter, destFilter]);

  const origins = useMemo(
    () => [...new Set(rows.map((r) => r.origin))],
    [rows],
  );
  const destinations = useMemo(
    () => [...new Set(rows.map((r) => r.destination))],
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (statusFilter === "All Jobs" || r.status === statusFilter) &&
          (typeFilter === "All Types" || r.type === typeFilter) &&
          (originFilter === "All Locations" || r.origin === originFilter) &&
          (destFilter === "All Locations" || r.destination === destFilter),
      ),
    [rows, statusFilter, typeFilter, originFilter, destFilter],
  );

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateStatus(id, status) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    setMenuFor(null);
    setToast({ tone: "success", title: `${id} marked as ${status}` });
  }
  function resetFilters() {
    setStatusFilter("All Jobs");
    setTypeFilter("All Types");
    setOriginFilter("All Locations");
    setDestFilter("All Locations");
    setSelected([]);
    setOpenFilter(null);
    setPage(1);
  }
  function bulkCancel() {
    setRows((rs) =>
      rs.map((r) =>
        selected.includes(r.id) ? { ...r, status: "Cancelled" } : r,
      ),
    );
    setToast({
      tone: "warning",
      title: `${selected.length} job${selected.length === 1 ? "" : "s"} cancelled`,
    });
    setSelected([]);
  }
  function exportRows(list) {
    setToast({
      tone: "info",
      title: `Exporting ${list.length} job${list.length === 1 ? "" : "s"}…`,
    });
  }
  function handleCreate() {
    if (!form.customer || !form.origin || !form.destination) return;
    const id = "JOB-" + Math.floor(Math.random() * 9000 + 20000);
    setRows((rs) => [
      {
        id,
        kind: "Container",
        customer: form.customer,
        location: form.location || "Lagos, Nigeria",
        type: form.type,
        origin: form.origin,
        destination: form.destination,
        value: form.value || "₦0",
        status: "Pending Approval",
        date: "Just now",
        time: "",
        trucks: 1,
      },
      ...rs,
    ]);
    setCreateOpen(false);
    setForm(EMPTY_FORM);
    setToast({ tone: "success", title: `${id} created` });
  }

  const columns = [
    {
      key: "id",
      header: "Job ID",
      render: (r) => (
        <span className="cell-two">
          <strong>
            <Link to={"/jobs/" + r.id}>{r.id}</Link>
          </strong>
          <small>{r.kind}{r.trucks > 1 ? ` · ${r.trucks} Trucks` : ""}</small>
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer / Forwarder",
      render: (r) => (
        <span className="cell-two">
          <strong>{r.customer}</strong>
          <small>{r.location}</small>
        </span>
      ),
    },
    {
      key: "type",
      header: "Trip Type",
      render: (r) => (
        <Badge
          tone={r.type === "Export" ? "success" : "purple"}
          style={{ fontSize: 10 }}
        >
          {r.type}
        </Badge>
      ),
    },
    {
      key: "route",
      header: "Route",
      render: (r) => (
        <span className="route-cell">
          {r.origin}　→　{r.destination}
        </span>
      ),
    },
    { key: "value", header: "Value (₦)" },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge tone={statusTone(r.status)} dot>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "date",
      header: "Created At",
      render: (r) => (
        <span className="cell-two">
          <strong>{r.date}</strong>
          <small>{r.time}</small>
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <span style={{ position: "relative" }}>
          <button
            className="row-actions"
            onClick={(e) => {
              e.stopPropagation();
              setMenuFor(menuFor === r.id ? null : r.id);
            }}
          >
            •••
          </button>
          {menuFor === r.id && (
            <span
              style={{ position: "absolute", right: 0, top: 34, zIndex: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu
                width={210}
                items={[
                  {
                    label: "View Job Details",
                    icon: "eye",
                    onClick: () => {
                      setMenuFor(null);
                      navigate("/jobs/" + r.id);
                    },
                  },
                  { divider: true },
                  ...ALL_STATUSES.filter((s) => s !== r.status)
                    .slice(0, 4)
                    .map((s) => ({
                      label: "Mark as " + s,
                      icon: "circle-check",
                      onClick: () => updateStatus(r.id, s),
                    })),
                  { divider: true },
                  { label: "Flag for Review", icon: "flag" },
                  {
                    label: "Export Job Sheet",
                    icon: "download",
                    onClick: () => {
                      setMenuFor(null);
                      exportRows([r]);
                    },
                  },
                  {
                    label: "Cancel Job",
                    icon: "ban",
                    tone: "danger",
                    onClick: () => updateStatus(r.id, "Cancelled"),
                  },
                ]}
              />
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="operations-screen">
      <div className="screen-head">
        <div>
          <h1>Jobs</h1>
          <p>View, manage and monitor all jobs.</p>
        </div>
      </div>

      {toast && <Banner tone={toast.tone} title={toast.title} />}

      <div className="jobs-master">
        <Card className="jobs-nav-card">
          <h3>Jobs</h3>
          <p>Manage all logistics jobs from creation to completion.</p>
          <div className="jobs-nav-group">
            {NAV_ITEMS.map(([label, count]) => (
              <NavLink
                key={label}
                label={label}
                count={count}
                active={statusFilter === label}
                onClick={() => setStatusFilter(label)}
              />
            ))}
          </div>
          {/* <div className="jobs-nav-group">
            <div className="jobs-nav-title">
              <i>
                <Icon name="truck" size={17} />
              </i>
              <span>
                <strong>Trips & Segments</strong>
                <small>Track all active trips and their segments.</small>
              </span>
            </div>
            {TRIP_NAV_ITEMS.map(([label, count]) => (
              <NavLink
                key={label}
                label={label}
                count={count}
                onClick={() => navigate("/trips")}
              />
            ))}
          </div> */}
        </Card>

        <div className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>
                All Jobs <small>({filtered.length})</small>
              </h3>
              <p>Overview of all jobs across Trukkas.</p>
            </div>
            <Button
              variant="outline"
              icon="download"
              onClick={() => exportRows(filtered)}
            >
              Export
            </Button>
            {/* <Button icon="plus" onClick={() => setCreateOpen(true)}>
              Create New Job
            </Button> */}
          </div>

          <div className="jobs-filters">
            <span style={{ position: "relative" }}>
              <button
                className={
                  "jobs-filter" + (statusFilter !== "All Jobs" ? " active" : "")
                }
                onClick={() =>
                  setOpenFilter(openFilter === "status" ? null : "status")
                }
              >
                <span>Job Status</span>
                {statusFilter}
              </button>
              {openFilter === "status" && (
                <span
                  style={{ position: "absolute", left: 0, top: 52, zIndex: 30 }}
                >
                  <DropdownMenu
                    width={200}
                    items={["All Jobs", ...ALL_STATUSES].map((s) => ({
                      label: s,
                      icon: s === statusFilter ? "check" : undefined,
                      onClick: () => {
                        setStatusFilter(s);
                        setOpenFilter(null);
                      },
                    }))}
                  />
                </span>
              )}
            </span>
            <span style={{ position: "relative" }}>
              <button
                className={
                  "jobs-filter" + (typeFilter !== "All Types" ? " active" : "")
                }
                onClick={() =>
                  setOpenFilter(openFilter === "type" ? null : "type")
                }
              >
                <span>Trip Type</span>
                {typeFilter}
              </button>
              {openFilter === "type" && (
                <span
                  style={{ position: "absolute", left: 0, top: 52, zIndex: 30 }}
                >
                  <DropdownMenu
                    width={200}
                    items={["All Types", ...TRIP_TYPES].map((s) => ({
                      label: s,
                      icon: s === typeFilter ? "check" : undefined,
                      onClick: () => {
                        setTypeFilter(s);
                        setOpenFilter(null);
                      },
                    }))}
                  />
                </span>
              )}
            </span>
            <span style={{ position: "relative" }}>
              <button
                className={
                  "jobs-filter" +
                  (originFilter !== "All Locations" ? " active" : "")
                }
                onClick={() =>
                  setOpenFilter(openFilter === "origin" ? null : "origin")
                }
              >
                <span>Origin</span>
                {originFilter}
              </button>
              {openFilter === "origin" && (
                <span
                  style={{ position: "absolute", left: 0, top: 52, zIndex: 30 }}
                >
                  <DropdownMenu
                    width={200}
                    items={["All Locations", ...origins].map((s) => ({
                      label: s,
                      icon: s === originFilter ? "check" : undefined,
                      onClick: () => {
                        setOriginFilter(s);
                        setOpenFilter(null);
                      },
                    }))}
                  />
                </span>
              )}
            </span>
            <span style={{ position: "relative" }}>
              <button
                className={
                  "jobs-filter" +
                  (destFilter !== "All Locations" ? " active" : "")
                }
                onClick={() =>
                  setOpenFilter(openFilter === "dest" ? null : "dest")
                }
              >
                <span>Destination</span>
                {destFilter}
              </button>
              {openFilter === "dest" && (
                <span
                  style={{ position: "absolute", left: 0, top: 52, zIndex: 30 }}
                >
                  <DropdownMenu
                    width={200}
                    items={["All Locations", ...destinations].map((s) => ({
                      label: s,
                      icon: s === destFilter ? "check" : undefined,
                      onClick: () => {
                        setDestFilter(s);
                        setOpenFilter(null);
                      },
                    }))}
                  />
                </span>
              )}
            </span>
            <button className="jobs-filter">
              <span>Date Range</span>May 24 – May 30, 2026
            </button>
            <span style={{ position: "relative" }}>
              <Button
                variant="outline"
                icon="list-filter"
                onClick={() =>
                  setOpenFilter(openFilter === "quick" ? null : "quick")
                }
              >
                Filters
              </Button>
              {openFilter === "quick" && (
                <span
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 44,
                    zIndex: 30,
                  }}
                >
                  <DropdownMenu
                    width={210}
                    items={[
                      { section: "QUICK FILTERS" },
                      {
                        label: "Delayed Jobs Only",
                        icon: "clock",
                        onClick: () => {
                          setStatusFilter("Delayed");
                          setOpenFilter(null);
                        },
                      },
                      {
                        label: "Pending My Approval",
                        icon: "hourglass",
                        onClick: () => {
                          setStatusFilter("Pending Approval");
                          setOpenFilter(null);
                        },
                      },
                      {
                        label: "High Value Exports",
                        icon: "trending-up",
                        onClick: () => {
                          setTypeFilter("Export");
                          setOpenFilter(null);
                        },
                      },
                    ]}
                  />
                </span>
              )}
            </span>
            <Button variant="outline" icon="rotate-cw" onClick={resetFilters}>
              Reset
            </Button>
          </div>

          {selected.length > 0 && (
            <div className="bulk-bar">
              <Icon name="check-check" size={15} />
              <strong>{selected.length} selected</strong>
              <span style={{ flex: 1 }} />
              <Button
                size="sm"
                variant="outline"
                icon="download"
                onClick={() =>
                  exportRows(rows.filter((r) => selected.includes(r.id)))
                }
              >
                Export Selected
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon="ban"
                onClick={bulkCancel}
              >
                Cancel Selected
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          )}

          <DataTable
            selectable
            rows={paged}
            columns={columns}
            selected={selected}
            onSelect={setSelected}
            onRowClick={(r) => navigate("/jobs/" + r.id)}
          />
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
            total={filtered.length}
            onPage={setPage}
            onPageSize={() => {}}
          />
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Job"
        description="Publish a new logistics job."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.customer || !form.origin || !form.destination}
              onClick={handleCreate}
            >
              Create Job
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <TextField
            label="Customer / Forwarder"
            required
            placeholder="e.g. Goodwill Forwarding Ltd."
            value={form.customer}
            onChange={(e) =>
              setForm((f) => ({ ...f, customer: e.target.value }))
            }
          />
          <TextField
            label="Location"
            placeholder="e.g. Lagos, Nigeria"
            value={form.location}
            onChange={(e) =>
              setForm((f) => ({ ...f, location: e.target.value }))
            }
          />
          <Select
            label="Trip Type"
            options={TRIP_TYPES}
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <TextField
              label="Origin"
              required
              placeholder="e.g. Apapa Port"
              value={form.origin}
              onChange={(e) =>
                setForm((f) => ({ ...f, origin: e.target.value }))
              }
            />
            <TextField
              label="Destination"
              required
              placeholder="e.g. Ikeja Warehouse"
              value={form.destination}
              onChange={(e) =>
                setForm((f) => ({ ...f, destination: e.target.value }))
              }
            />
          </div>
          <TextField
            label="Job Value (₦)"
            placeholder="e.g. ₦1,450,000"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
