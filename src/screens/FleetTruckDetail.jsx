"use client";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "../router.js";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DropdownMenu,
  Icon,
  IconButton,
  Modal,
  Select,
  StatCard,
  Tabs,
  TextField,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { updateTruck } from "../mock/api.js";
import { getJobTrips } from "../domain/jobTrips.js";
import "./TruckDetail.css";

const tone = {
  Available: "success",
  "On Trip": "info",
  "In Maintenance": "warning",
  Inactive: "danger",
  Scheduled: "warning",
  "In Progress": "info",
  Completed: "success",
  Overdue: "danger",
  Delivered: "success",
  "In Transit": "info",
};
const documents = [
  ["Road Worthiness Certificate", "Valid until Jan 10, 2027", "Valid"],
  ["Insurance Policy", "Valid until Dec 15, 2026", "Active"],
  ["Emission Test Certificate", "Valid until Jan 10, 2027", "Valid"],
  ["Tax / Levy Payment", "Valid until Dec 31, 2026", "Paid"],
];
const activities = [
  ["map-pin", "Truck location updated", "3 hours ago"],
  ["wrench", "Maintenance record added", "1 day ago"],
  ["clock", "Trip completed", "5 days ago"],
  ["file-text", "Insurance document renewed", "2 weeks ago"],
];

export function FleetTruckDetail() {
  const navigate = useNavigate(),
    { plate } = useParams(),
    trucks = useCollection("trucks") || [],
    maintenance = useCollection("maintenance") || [],
    jobs = useCollection("jobs") || [],
    drivers = useCollection("drivers") || [];
  const truck = trucks.find((item) => item.plate === decodeURIComponent(plate));
  const [tab, setTab] = useState("Overview"),
    [menu, setMenu] = useState(false),
    [edit, setEdit] = useState(false),
    [assign, setAssign] = useState(false),
    [draft, setDraft] = useState({});
  const records = useMemo(
    () => maintenance.filter((item) => item.plate === truck?.plate),
    [maintenance, truck],
  );
  const trips = useMemo(() => {
    return jobs.flatMap((job) => getJobTrips(job)
      .filter((trip) => trip.truckPlate === truck?.plate)
      .map((trip) => ({ ...job, ...trip, id: trip.id, jobId: job.id, cargo: job.cargo })));
  }, [jobs, truck]);
  if (!truck)
    return (
      <Card>
        <p className="tk-body">Truck not found.</p>
        <Button onClick={() => navigate("/fleet")}>Back to Fleet</Button>
      </Card>
    );
  const driver = drivers.find((item) => item.id === truck.dr);
  async function save() {
    await updateTruck(truck.plate, draft);
    setEdit(false);
  }
  async function assignDriver(id) {
    const next = drivers.find((item) => item.id === id);
    if (next)
      await updateTruck(truck.plate, { driver: next.name, dr: next.id });
    setAssign(false);
  }
  const companyUrl = `/companies/${truck.tc}`;
  return (
    <div className="truck-detail-page">
      <div className="truck-detail-crumb">
        Trucking Companies <Icon name="chevron-right" size={13} />
        <button onClick={() => navigate(companyUrl)}>{truck.company}</button>
        <Icon name="chevron-right" size={13} />
        Trucks
        <Icon name="chevron-right" size={13} />
        {truck.plate}
      </div>
      <Button
        className="truck-back"
        variant="outline"
        icon="arrow-left"
        onClick={() => navigate(`${companyUrl}?tab=trucks`)}
      >
        Back to Trucks
      </Button>
      <header className="truck-detail-hero">
        <div className="truck-detail-visual">
          <Icon name="truck" size={76} />
        </div>
        <div className="truck-detail-title">
          <div>
            <h1 className="tk-display">{truck.plate}</h1>
            <Badge dot tone={tone[truck.status]}>
              {truck.status}
            </Badge>
          </div>
          <p>
            Mercedes-Benz Actros 1845 <span /> {truck.type} <span /> 2022
          </p>
          <button onClick={() => navigate(companyUrl)}>
            <Icon name="building-2" size={15} />
            {truck.company}
          </button>
        </div>
        <div className="truck-detail-actions">
          <span>
            <Button iconRight="chevron-down" onClick={() => setMenu(!menu)}>
              Actions
            </Button>
            {menu && (
              <span>
                <DropdownMenu
                  width={220}
                  items={[
                    {
                      label: "Schedule maintenance",
                      icon: "wrench",
                      onClick: () => navigate("/maintenance"),
                    },
                    { divider: true },
                    {
                      label: "Print profile",
                      icon: "printer",
                      onClick: () => window.print(),
                    },
                  ]}
                />
              </span>
            )}
          </span>
        </div>
        <div className="truck-detail-meta">
          <span>
            <Icon name="power" size={16} />
            WDB9634031L123456
          </span>
          <span>
            <Icon name="cpu" size={16} />
            OM471123456
          </span>
          <span>
            <Icon name="badge" size={16} />
            {truck.plate}
          </span>
          <span>
            <Icon name="map-pin" size={16} />
            {truck.loc}, {truck.state}
          </span>
          <span className="truck-registered">
            <small>Date Registered</small>
            <strong>Jan 10, 2022</strong>
          </span>
          <span className="truck-registered">
            <small>Last Updated</small>
            <strong>May 28, 2026</strong>
          </span>
        </div>
      </header>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          "Overview",
          { value: "Documents", label: "Documents", count: 8 },
          { value: "Maintenance", label: "Maintenance", count: records.length },
          { value: "Trips", label: "Trips", count: 28 },
          { value: "Jobs", label: "Jobs", count: 12 },
          "Insurance",
          "Activity Log",
        ]}
      />
      {tab === "Overview" ? (
        <Overview
          truck={truck}
          records={records}
          trips={trips}
          driver={driver}
          navigate={navigate}
          openEdit={() => {
            setDraft({
              status: truck.status,
              type: truck.type,
              loc: truck.loc,
              state: truck.state,
            });
            setEdit(true);
          }}
        />
      ) : (
        <TabPanel
          tab={tab}
          records={records}
          trips={trips}
          navigate={navigate}
        />
      )}
      <Modal
        open={edit}
        onClose={() => setEdit(false)}
        title="Edit truck"
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Changes</Button>
          </>
        }
      >
        <div className="truck-detail-form">
          <Select
            label="Status"
            value={draft.status || truck.status}
            options={["Available", "On Trip", "In Maintenance", "Inactive"]}
            onChange={(event) =>
              setDraft({ ...draft, status: event.target.value })
            }
          />
          <Select
            label="Truck Type"
            value={draft.type || truck.type}
            options={[
              "40FT Trailer",
              "20FT Container",
              "Flatbed",
              "40FT High Cube",
              "Tanker",
            ]}
            onChange={(event) =>
              setDraft({ ...draft, type: event.target.value })
            }
          />
          <TextField
            label="Current location"
            value={draft.loc || ""}
            onChange={(event) =>
              setDraft({ ...draft, loc: event.target.value })
            }
          />
          <TextField
            label="State"
            value={draft.state || ""}
            onChange={(event) =>
              setDraft({ ...draft, state: event.target.value })
            }
          />
        </div>
      </Modal>
      <Modal
        open={assign}
        onClose={() => setAssign(false)}
        title="Assign driver"
        description="Select a driver for this truck."
      >
        <div className="truck-driver-options">
          {drivers.map((item) => (
            <button key={item.id} onClick={() => assignDriver(item.id)}>
              <Avatar name={item.name} size={36} />
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.id} · {item.status}
                </small>
              </span>
              <Icon name="chevron-right" size={14} />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function Header({ title, action, onAction }) {
  return (
    <div className="truck-card-head">
      <h2 className="tk-section">{title}</h2>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}
function Activity() {
  return (
    <div className="truck-activity">
      {activities.map(([icon, title, time]) => (
        <div key={title}>
          <span>
            <Icon name={icon} size={16} />
          </span>
          <p>
            <strong>{title}</strong>
            <small>
              {title.includes("location")
                ? "Lagos, Nigeria"
                : "Operational record"}
            </small>
          </p>
          <time>{time}</time>
        </div>
      ))}
    </div>
  );
}
function Overview({ truck, records, trips, driver, navigate, openEdit }) {
  return (
    <div className="truck-overview-page">
      <div className="truck-stats">
        <StatCard
          icon="shield-check"
          label="Total Trips"
          value="156"
          delta="12%"
          caption="from last month"
        />
        <StatCard
          icon="gauge"
          tint="teal"
          label="Total Distance"
          value="254,360 km"
          delta="18%"
          caption="from last month"
        />
        <StatCard
          icon="trending-up"
          label="Uptime (Last 30 days)"
          value="95%"
          delta="5%"
          caption="from last month"
        />
      </div>
      <div className="truck-overview-grid">
        <div className="truck-main">
          <Card>
            <Header
              title="Truck Information"
              action="Edit"
              onAction={openEdit}
            />
            <div className="truck-info-grid">
              {[
                ["Plate Number", truck.plate],
                ["Fuel Type", "Diesel"],
                ["VIN Number", "WDB9634031L123456"],
                ["Load Capacity", "40,000 kg"],
                ["Engine Number", "OM471123456"],
                ["Body Color", "White"],
                ["Make", "Mercedes-Benz"],
                ["Chassis Number", "MB-2022-1845-001"],
                ["Model", "Actros 1845"],
                ["Emission Standard", "Euro 6"],
                ["Year of Manufacture", "2022"],
                ["Current Location", truck.loc],
                ["Truck Type", truck.type],
                [
                  "Status",
                  <Badge dot tone={tone[truck.status]}>
                    {truck.status}
                  </Badge>,
                ],
                ["Fleet Type", "Heavy Duty"],
                ["Owning Company", truck.company],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <Header title="Recent Trips" action="View All" />
            <DataTable
              rows={trips.slice(0, 5)}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "id",
                  header: "Trip ID",
                  render: (row) => (
                    <button
                      className="truck-link"
                      onClick={() => navigate(`/jobs/${row.jobId}`)}
                    >
                      {row.id}
                    </button>
                  ),
                },
                { key: "route", header: "Route" },
                { key: "pickupDate", header: "Start Date" },
                { key: "deliveryDate", header: "End Date" },
                {
                  key: "distanceKm",
                  header: "Distance",
                  render: (row) => `${row.distanceKm || 0} km`,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <Badge dot tone={tone[row.status] || "success"}>
                      {row.status}
                    </Badge>
                  ),
                },
              ]}
            />
          </Card>
        </div>
        <aside className="truck-side">
          <Card>
            <Header title="Truck Images" action="View All (6)" />
            <div className="truck-image-main">
              <Icon name="truck" size={112} />
            </div>
            <div className="truck-thumbs">
              {[1, 2, 3, 4, 5].map((item) => (
                <button key={item}>
                  <Icon name={item === 3 ? "gauge" : "truck"} size={22} />
                  {item === 5 && <b>+2</b>}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <Header title="Compliance & Insurance" action="View All" />
            {documents.map(([name, date, status]) => (
              <div className="truck-doc" key={name}>
                <Icon name="shield-check" size={17} />
                <p>
                  <strong>{name}</strong>
                  <small>{date}</small>
                </p>
                <Badge dot tone="success">
                  {status}
                </Badge>
              </div>
            ))}
          </Card>
          <Card>
            <Header title="Recent Activity" action="View All" />
            <Activity />
          </Card>
          {driver && (
            <Card>
              <Header title="Assigned Driver" />
              <div className="truck-driver-card">
                <Avatar name={driver.name} size={44} />
                <p>
                  <strong>{driver.name}</strong>
                  <small>{driver.phone}</small>
                </p>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
function TabPanel({ tab, records, trips, navigate }) {
  let rows = [],
    columns = [];
  if (tab === "Maintenance") {
    rows = records;
    columns = [
      {
        key: "id",
        header: "Record ID",
        render: (row) => (
          <button
            className="truck-link"
            onClick={() => navigate(`/maintenance/${row.id}`)}
          >
            {row.id}
          </button>
        ),
      },
      { key: "description", header: "Service" },
      { key: "serviceCenter", header: "Service Center" },
      { key: "dueDate", header: "Due Date" },
      { key: "priority", header: "Priority" },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <Badge dot tone={tone[row.status]}>
            {row.status}
          </Badge>
        ),
      },
      {
        key: "action",
        header: "",
        render: (row) => (
          <IconButton
            icon="arrow-right"
            onClick={() => navigate(`/maintenance/${row.id}`)}
          />
        ),
      },
    ];
  } else if (tab === "Trips" || tab === "Jobs") {
    rows = trips;
    columns = [
      {
        key: "id",
        header: "Job / Trip ID",
        render: (row) => (
          <button
            className="truck-link"
            onClick={() => navigate(`/jobs/${row.jobId}`)}
          >
            {row.id}
          </button>
        ),
      },
      { key: "route", header: "Route" },
      { key: "cargo", header: "Cargo" },
      { key: "pickupDate", header: "Pickup" },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <Badge dot tone={tone[row.status] || "neutral"}>
            {row.status}
          </Badge>
        ),
      },
    ];
  } else if (tab === "Documents" || tab === "Insurance") {
    rows = documents.map(([name, date, status], id) => ({
      id,
      name,
      date,
      status,
    }));
    columns = [
      { key: "name", header: "Document" },
      { key: "date", header: "Validity" },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <Badge dot tone="success">
            {row.status}
          </Badge>
        ),
      },
    ];
  } else {
    rows = activities.map(([icon, title, time], id) => ({ id, title, time }));
    columns = [
      { key: "title", header: tab },
      { key: "time", header: "Updated" },
    ];
  }
  return (
    <Card pad="none">
      <div className="truck-panel-title">
        <div>
          <h2 className="tk-section">{tab}</h2>
          <p className="tk-meta">Records and activity for this truck.</p>
        </div>
        {tab === "Maintenance" && (
          <Button icon="plus" onClick={() => navigate("/maintenance")}>
            Schedule Maintenance
          </Button>
        )}
      </div>
      {rows.length ? (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          columns={columns}
          coloredHeader
        />
      ) : (
        <div className="truck-empty">
          <Icon name="clipboard-list" size={28} />
          <p className="tk-body">
            No {tab.toLowerCase()} records for this truck yet.
          </p>
        </div>
      )}
    </Card>
  );
}
