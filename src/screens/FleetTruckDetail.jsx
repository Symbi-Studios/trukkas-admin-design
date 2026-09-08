"use client";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "../router.js";
import {
  PageHeader,
  Button,
  Card,
  SectionCard,
  Tabs,
  Badge,
  Icon,
  Avatar,
  DataTable,
  DropdownMenu,
  Modal,
  Select,
  TextField,
  Textarea,
  SearchField,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { updateTruck } from "../mock/api.js";
import "./FleetManagement.css";
import "./Maintenance.css";
const STATES = ["Available", "On Trip", "In Maintenance", "Inactive"],
  TYPES = [
    "40FT Trailer",
    "20FT Container",
    "Flatbed",
    "40FT High Cube",
    "45FT Container",
    "Tanker",
  ];
const TAB_NAMES = [
  "Overview",
  "Driver",
  "Maintenance",
  "Documents",
  "Trips & History",
  "Fuel & Expenses",
  "Compliance",
  "Tracking",
  "Notes",
];
const recentMaintenance = [
  ["Routine Service", "May 10, 2026", "Completed"],
  ["Brake Inspection", "Mar 12, 2026", "Completed"],
  ["Engine Check", "Jan 5, 2026", "Completed"],
  ["Tire Replacement", "Nov 18, 2025", "Completed"],
  ["Oil Change", "Sep 10, 2025", "Completed"],
];
const docs = [
  ["Vehicle Registration", "REG_TRK-1045.pdf", "Expires Jan 10, 2027"],
  ["Insurance Certificate", "INS_TRK-1045.pdf", "Expires Oct 05, 2026"],
  ["Road Worthiness", "RWC_TRK-1045.pdf", "Expires Dec 15, 2026"],
  ["Emission Certificate", "EMC_TRK-1045.pdf", "Expires Nov 20, 2026"],
];
const trips = [
  ["JOB-29821", "Apapa → Ikeja", "May 30, 2026"],
  ["JOB-29817", "Lagos → Kano", "May 28, 2026"],
  ["JOB-29812", "Lagos → Kaduna", "May 25, 2026"],
  ["JOB-29806", "Onne → Port Harcourt", "May 21, 2026"],
  ["JOB-28901", "Lagos → Benin", "May 18, 2026"],
];
function download(name, text = "Trukkas truck document") {
  const url = URL.createObjectURL(new Blob([text]));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function FleetTruckDetail() {
  const navigate = useNavigate(),
    { plate } = useParams(),
    trucks = useCollection("trucks") || [],
    maintenance = useCollection("maintenance") || [],
    drivers = useCollection("drivers") || [],
    truck = trucks.find((t) => t.plate === decodeURIComponent(plate)),
    [tab, setTab] = useState("Overview"),
    [menu, setMenu] = useState(false),
    [edit, setEdit] = useState(false),
    [assign, setAssign] = useState(false),
    [noteOpen, setNoteOpen] = useState(false),
    [query, setQuery] = useState(""),
    [note, setNote] = useState(""),
    [toast, setToast] = useState(""),
    [draft, setDraft] = useState(null);
  const records = useMemo(
    () => maintenance.filter((r) => r.plate === truck?.plate),
    [maintenance, truck],
  );
  if (!truck)
    return (
      <Card>
        <p>Truck not found.</p>
        <Button variant="outline" onClick={() => navigate("/fleet")}>
          Back to Fleet
        </Button>
      </Card>
    );
  const details = {
    number: truck.ref === "TRK-2026-000486" ? "TRK-1045" : truck.ref,
    model: "Mercedes-Benz Actros 2020",
    year: "2020",
    ownership: "Company Owned",
    vin: "WDB9634031L123456",
    fuel: "Diesel",
    odometer: "186,420 km",
    color: "White",
    base: "Lagos, Nigeria",
  };
  function notify(s) {
    setToast(s);
    setTimeout(() => setToast(""), 1700);
  }
  function openEdit() {
    setDraft({
      status: truck.status,
      type: truck.type,
      loc: truck.loc,
      state: truck.state,
    });
    setEdit(true);
  }
  async function saveEdit() {
    await updateTruck(truck.plate, draft);
    setEdit(false);
    notify("Truck updated successfully");
  }
  async function changeDriver(id) {
    const d = drivers.find((x) => x.id === id);
    if (!d) return;
    await updateTruck(truck.plate, { driver: d.name, dr: d.id });
    setAssign(false);
    notify("Driver assigned successfully");
  }
  return (
    <div className="fleet-page truck-record">
      <PageHeader
        crumbs={["Fleet Management", details.number]}
        title="Truck Details"
        description="View and manage truck information, documents, maintenance, and performance."
        actions={
          <>
            <Button variant="outline" icon="pencil" onClick={openEdit}>
              Edit Truck
            </Button>
            <Button
              variant="outline"
              icon="users"
              onClick={() => setAssign(true)}
            >
              Assign Driver
            </Button>
            <span className="fleet-menu-wrap">
              <Button
                variant="outline"
                icon="ellipsis"
                onClick={() => setMenu(!menu)}
              >
                More
              </Button>
              {menu && (
                <span className="fleet-dropdown">
                  <DropdownMenu
                    width={220}
                    items={[
                      {
                        label: "Schedule Maintenance",
                        icon: "wrench",
                        onClick: () => navigate("/maintenance"),
                      },
                      {
                        label: "Print Truck Profile",
                        icon: "printer",
                        onClick: () => window.print(),
                      },
                      {
                        label: "Export Truck Data",
                        icon: "download",
                        onClick: () =>
                          download(
                            details.number + ".txt",
                            JSON.stringify({ ...truck, ...details }, null, 2),
                          ),
                      },
                      { divider: true },
                      {
                        label: "Mark Inactive",
                        icon: "circle-x",
                        tone: "danger",
                        onClick: async () => {
                          await updateTruck(truck.plate, {
                            status: "Inactive",
                          });
                          setMenu(false);
                          notify("Truck marked inactive");
                        },
                      },
                    ]}
                  />
                </span>
              )}
            </span>
          </>
        }
      />
      <div className="truck-record-head">
        <Card pad="none">
          <div className="truck-record-identity">
            <div className="truck-photo">
              <Icon name="truck" size={66} />
              <Badge dot tone="success">
                Active
              </Badge>
            </div>
            <div className="truck-primary">
              <div>
                <h2>{details.number}</h2>
                <Icon name="qr-code" size={19} />
              </div>
              <p>{details.model}</p>
              <p>{truck.type} (General Cargo)</p>
              <span>
                <Badge tone="info">{details.ownership}</Badge>
                <Badge tone="success">In Service</Badge>
              </span>
              <button onClick={() => navigate("/companies/" + truck.tc)}>
                <Icon name="building-2" size={14} />
                {truck.company}
              </button>
            </div>
            <div className="truck-identifiers">
              {Fact("badge", truck.plate, true)}
              {Fact("scan-line", details.vin, true)}
              {Fact("calendar-days", "Year", false, details.year)}
              {Fact("fuel", "Fuel Type", false, details.fuel)}
              {Fact("gauge", "Last Odometer", false, details.odometer)}
              {Fact("map-pin", "Location", false, details.base)}
            </div>
          </div>
        </Card>
        <Card>
          <h3 className="truck-status-title">Operational Status</h3>
          <div className="truck-status-banner">
            <Icon name="circle-check" size={22} />
            <span>
              <strong>
                {truck.status === "Available" ? "Active" : truck.status}
              </strong>
              <small>
                {truck.status === "Available"
                  ? "Truck is available for new assignments"
                  : "Current operational state"}
              </small>
            </span>
          </div>
          <div className="truck-maint-dates">
            <span>
              <small>Last Maintenance</small>
              <strong>May 10, 2026</strong>
            </span>
            <span>
              <small>Next Maintenance</small>
              <strong>Jul 10, 2026</strong>
              <em>(in 35 days)</em>
            </span>
          </div>
        </Card>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={TAB_NAMES}
        style={{ padding: "0 14px" }}
      />
      {tab === "Overview" ? (
        <Overview
          truck={truck}
          details={details}
          records={records}
          navigate={navigate}
          openEdit={openEdit}
          setAssign={setAssign}
          notify={notify}
        />
      ) : (
        <TabContent
          tab={tab}
          truck={truck}
          details={details}
          records={records}
          query={query}
          setQuery={setQuery}
          navigate={navigate}
          notify={notify}
          openEdit={openEdit}
          setAssign={setAssign}
          note={note}
          setNote={setNote}
          setNoteOpen={setNoteOpen}
        />
      )}
      <Modal
        open={edit}
        onClose={() => setEdit(false)}
        title="Edit Truck"
        description="Update this truck’s operational information."
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="fleet-form">
          <Select
            label="Status"
            options={STATES}
            value={draft?.status || truck.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          />
          <Select
            label="Truck Type"
            options={TYPES}
            value={draft?.type || truck.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value })}
          />
          <TextField
            label="Current Location"
            value={draft?.loc || ""}
            onChange={(e) => setDraft({ ...draft, loc: e.target.value })}
          />
          <TextField
            label="State"
            value={draft?.state || ""}
            onChange={(e) => setDraft({ ...draft, state: e.target.value })}
          />
        </div>
      </Modal>
      <Modal
        open={assign}
        onClose={() => setAssign(false)}
        title="Assign Driver"
        description="Select an active driver for this truck."
        footer={
          <Button variant="outline" onClick={() => setAssign(false)}>
            Cancel
          </Button>
        }
      >
        <div className="truck-driver-options">
          {drivers.slice(0, 8).map((d) => (
            <button key={d.id} onClick={() => changeDriver(d.id)}>
              <Avatar name={d.name} size={36} />
              <span>
                <strong>{d.name}</strong>
                <small>
                  {d.id} · {d.status}
                </small>
              </span>
              <Icon name="chevron-right" size={14} />
            </button>
          ))}
        </div>
      </Modal>
      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add Truck Note"
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!note.trim()}
              onClick={() => {
                setNoteOpen(false);
                notify("Note added to truck record");
              }}
            >
              Add Note
            </Button>
          </>
        }
      >
        <Textarea
          rows={5}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Write a note about this truck..."
        />
      </Modal>
      {toast && <div className="maint-toast">{toast}</div>}
    </div>
  );
}
function Fact(icon, label, copy, value) {
  return (
    <div className="truck-id-fact">
      <Icon name={icon} size={14} />
      <span>
        {value && <small>{label}</small>}
        <strong>{value || label}</strong>
      </span>
      {copy && (
        <button onClick={() => navigator.clipboard?.writeText(label)}>
          <Icon name="copy" size={12} />
        </button>
      )}
    </div>
  );
}
function Overview({
  truck,
  details,
  records,
  navigate,
  openEdit,
  setAssign,
  notify,
}) {
  return (
    <div className="truck-overview">
      <SectionCard
        title="Key Information"
        icon="clipboard-list"
        action={
          <Button size="sm" variant="outline" icon="pencil" onClick={openEdit}>
            Edit
          </Button>
        }
      >
        <div className="truck-key-grid">
          {[
            ["Truck Number", details.number],
            ["Make & Model", details.model],
            ["Year", details.year],
            ["Truck Type", truck.type + " (General Cargo)"],
            ["Ownership", details.ownership],
            ["Plate Number", truck.plate],
            ["VIN Number", details.vin],
            ["Color", details.color],
            ["Base Location", details.base],
            ["Current Location", truck.loc],
            [
              "Status",
              <Badge dot tone="success">
                Active
              </Badge>,
            ],
          ].map((x) => (
            <span key={x[0]}>
              <small>{x[0]}</small>
              <strong>{x[1]}</strong>
            </span>
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title="Performance Summary"
        action={
          <select className="fleet-sort">
            <option>Last 6 Months</option>
            <option>Last 12 Months</option>
            <option>This Year</option>
          </select>
        }
      >
        <div className="truck-performance">
          {[
            ["route", "Total Trips", "48", "↑ 12%", "purple"],
            ["route", "Total Distance", "186,420 km", "↑ 8%", "green"],
            ["droplet", "Fuel Efficiency", "3.8 km/l", "↑ 5%", "red"],
            ["clock-3", "Uptime", "96%", "↑ 2%", "blue"],
          ].map((x) => (
            <div key={x[1]}>
              <span className={x[4]}>
                <Icon name={x[0]} size={18} />
              </span>
              <p>
                <small>{x[1]}</small>
                <strong>{x[2]}</strong>
                <em>{x[3]}</em>
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title="Driver Information"
        icon="shield-check"
        action={
          <button className="fleet-text-btn" onClick={() => setAssign(true)}>
            Change Driver
          </button>
        }
      >
        <div className="truck-driver-profile">
          <Avatar name={truck.driver} size={72} />
          <div>
            <span>
              <strong>{truck.driver}</strong>
              <Badge tone="info">{truck.dr}</Badge>
            </span>
            <p>Professional Driver · 5+ Years Experience</p>
            <p>
              <Icon name="phone" size={12} /> +234 806 987 6543
            </p>
            <p>
              <Icon name="mail" size={12} />{" "}
              {truck.driver.toLowerCase().replace(" ", ".")}@trukkas.com
            </p>
            <Badge dot tone="success">
              Active
            </Badge>
          </div>
        </div>
      </SectionCard>
      <SectionCard
        title="Recent Maintenance"
        icon="wrench"
        action={
          <button
            className="fleet-text-btn"
            onClick={() => navigate("/maintenance")}
          >
            View All
          </button>
        }
      >
        <MiniRows
          rows={
            records.length
              ? records
                  .slice(0, 5)
                  .map((r) => [r.description, r.dueDate, r.status])
              : recentMaintenance
          }
          onClick={() => navigate("/maintenance")}
        />
      </SectionCard>
      <SectionCard
        title="Documents"
        icon="file-text"
        action={
          <button
            className="fleet-text-btn"
            onClick={() => notify("All truck documents opened")}
          >
            View All
          </button>
        }
      >
        <MiniRows
          rows={docs.map((x) => [x[0], x[2], "Valid"])}
          document
          onClick={(_, i) => download(docs[i][1])}
        />
      </SectionCard>
      <SectionCard
        title="Recent Trips"
        icon="briefcase"
        action={
          <button className="fleet-text-btn" onClick={() => navigate("/trips")}>
            View All
          </button>
        }
      >
        <MiniRows
          rows={trips.map((x) => [x[0], x[1], "Completed", x[2]])}
          onClick={() => navigate("/trips")}
        />
      </SectionCard>
      <SectionCard
        title="Location & Tracking"
        icon="map-pin"
        action={
          <Badge dot tone="success">
            Online
          </Badge>
        }
        style={{ gridColumn: "1/-1" }}
      >
        <div className="truck-tracking">
          <div className="truck-map">
            <span>
              <Icon name="truck" size={18} />
            </span>
            <b>Apapa Port</b>
          </div>
          <div className="truck-track-details">
            {[
              ["map-pin", "Current Location", "Apapa Port, Lagos"],
              ["clock-3", "Last Updated", "May 30, 2026, 09:42 AM"],
              ["gauge", "Speed", "0 km/h (Parked)"],
              ["map-pin", "GPS Status", "Online"],
            ].map((x) => (
              <div key={x[1]}>
                <Icon name={x[0]} size={15} />
                <span>
                  <small>{x[1]}</small>
                  <strong>{x[2]}</strong>
                </span>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => notify("Live map opened")}
            >
              View on Map
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
function MiniRows({ rows, onClick, document }) {
  return (
    <div className="truck-mini-rows">
      {rows.map((r, i) => (
        <button key={r[0] + i} onClick={() => onClick?.(r, i)}>
          <Icon
            name={document ? "file-text" : i % 2 ? "settings" : "wrench"}
            size={13}
          />
          <span>
            <strong>{r[0]}</strong>
            {r[1] && <small>{r[1]}</small>}
          </span>
          <Badge tone="success">{r[2]}</Badge>
          {r[3] && <time>{r[3]}</time>}
        </button>
      ))}
    </div>
  );
}
function TabContent({
  tab,
  truck,
  details,
  records,
  query,
  setQuery,
  navigate,
  notify,
  openEdit,
  setAssign,
  note,
  setNote,
  setNoteOpen,
}) {
  const search = (
    <SearchField
      placeholder={`Search ${tab.toLowerCase()}...`}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
    />
  );
  if (tab === "Driver")
    return (
      <div className="truck-tab-grid">
        <SectionCard
          title="Assigned Driver"
          action={
            <Button size="sm" onClick={() => setAssign(true)}>
              Change Driver
            </Button>
          }
        >
          <div className="truck-driver-profile">
            <Avatar name={truck.driver} size={72} />
            <div>
              <strong>{truck.driver}</strong>
              <p>{truck.dr} · Professional Driver</p>
              <Badge tone="success">Active</Badge>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Driver Performance">
          {Info("Completed Trips", "148")}
          {Info("Safety Rating", "4.8 / 5.0")}
          {Info("On-time Delivery", "96%")}
          {Info("License Status", "Valid")}
        </SectionCard>
      </div>
    );
  if (tab === "Maintenance") {
    const filtered = records.filter(
      (r) =>
        !query ||
        [r.id, r.description, r.serviceCenter].some((x) =>
          x.toLowerCase().includes(query.toLowerCase()),
        ),
    );
    return (
      <SectionCard
        title="Maintenance History"
        count={filtered.length}
        action={search}
        pad="none"
      >
        <DataTable
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate("/maintenance/" + r.id)}
          columns={[
            {
              key: "id",
              header: "Maintenance ID",
              render: (r) => <span className="fleet-link">{r.id}</span>,
            },
            { key: "description", header: "Service" },
            { key: "serviceCenter", header: "Service Center" },
            { key: "dueDate", header: "Date" },
            {
              key: "status",
              header: "Status",
              render: (r) => <Badge>{r.status}</Badge>,
            },
          ]}
        />
        {!filtered.length && (
          <div className="fleet-empty">No maintenance records found.</div>
        )}
      </SectionCard>
    );
  }
  if (tab === "Documents") {
    const filtered = docs.filter((x) =>
      x.join(" ").toLowerCase().includes(query.toLowerCase()),
    );
    return (
      <SectionCard title="Truck Documents" action={search} pad="none">
        <DataTable
          rows={filtered.map((x, i) => ({
            id: i,
            name: x[0],
            file: x[1],
            expiry: x[2],
          }))}
          columns={[
            { key: "name", header: "Document" },
            { key: "file", header: "File Name" },
            { key: "expiry", header: "Validity" },
            {
              key: "status",
              header: "Status",
              render: () => <Badge tone="success">Valid</Badge>,
            },
            {
              key: "x",
              header: "Action",
              render: (r) => (
                <Button
                  size="sm"
                  variant="outline"
                  icon="download"
                  onClick={() => download(r.file)}
                >
                  Download
                </Button>
              ),
            },
          ]}
        />
      </SectionCard>
    );
  }
  if (tab === "Trips & History") {
    const filtered = trips.filter((x) =>
      x.join(" ").toLowerCase().includes(query.toLowerCase()),
    );
    return (
      <SectionCard title="Trip History" action={search} pad="none">
        <DataTable
          rows={filtered.map((x) => ({
            id: x[0],
            route: x[1],
            date: x[2],
            status: "Completed",
          }))}
          columns={[
            {
              key: "id",
              header: "Job ID",
              render: (r) => <span className="fleet-link">{r.id}</span>,
            },
            { key: "route", header: "Route" },
            { key: "date", header: "Date" },
            {
              key: "status",
              header: "Status",
              render: (r) => <Badge tone="success">{r.status}</Badge>,
            },
          ]}
        />
      </SectionCard>
    );
  }
  if (tab === "Fuel & Expenses")
    return (
      <div className="truck-tab-grid">
        <SectionCard title="Fuel Summary">
          {Info("Fuel Type", details.fuel)}
          {Info("Average Efficiency", "3.8 km/l")}
          {Info("Fuel Used This Month", "1,284 litres")}
          {Info("Fuel Cost This Month", "₦1,412,400")}
        </SectionCard>
        <SectionCard title="Operating Expenses">
          {Info("Maintenance", "₦385,000")}
          {Info("Fuel", "₦1,412,400")}
          {Info("Tolls & Permits", "₦94,500")}
          {Info("Total", "₦1,891,900")}
        </SectionCard>
      </div>
    );
  if (tab === "Compliance")
    return (
      <SectionCard title="Compliance Status">
        <div className="truck-compliance">
          {docs.map((x) => (
            <div key={x[0]}>
              <Icon name="shield-check" />
              <span>
                <strong>{x[0]}</strong>
                <small>{x[2]}</small>
              </span>
              <Badge tone="success">Compliant</Badge>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  if (tab === "Tracking")
    return (
      <SectionCard title="Live Location & Tracking">
        <div className="truck-map truck-map-large">
          <span>
            <Icon name="truck" size={24} />
          </span>
          <b>Apapa Port, Lagos</b>
        </div>
        <div className="truck-track-details">
          {Info("GPS Status", "Online")}
          {Info("Speed", "0 km/h (Parked)")}
          {Info("Last Updated", "May 30, 2026, 09:42 AM")}
        </div>
      </SectionCard>
    );
  return (
    <SectionCard
      title="Truck Notes"
      action={
        <Button size="sm" icon="plus" onClick={() => setNoteOpen(true)}>
          Add Note
        </Button>
      }
    >
      <p className="tk-meta">
        Operational notes and internal comments for this truck.
      </p>
      {note ? (
        <div className="truck-note">
          <strong>Trukkas Admin</strong>
          <p>{note}</p>
          <small>Just now</small>
        </div>
      ) : (
        <div className="fleet-empty">No notes have been added.</div>
      )}
    </SectionCard>
  );
}
function Info(label, value) {
  return (
    <div className="maint-info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
