"use client";
import { useEffect, useMemo, useState } from "react";
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
  PageHeader,
  Pagination,
  SearchField,
  Select,
  StatCard,
  Tabs,
  Textarea,
  TextField,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { setCompanyStatus } from "../mock/api.js";
import { getJobTrips } from "../domain/jobTrips.js";
import {
  getCompanyPayoutSummary,
  normalizePayouts,
} from "../domain/payouts.js";
import { formatNaira } from "../mock/format.js";
import "./CompanyDetail.css";

const statusTone = {
  Active: "success",
  Available: "success",
  "On Trip": "info",
  "In Maintenance": "warning",
  Inactive: "neutral",
  Suspended: "danger",
  "Pending Review": "warning",
  Delivered: "success",
  Completed: "success",
  "In Transit": "info",
  Assigned: "info",
  Open: "warning",
};
const docs = [
  ["CAC Certificate", "Verified", "Jan 16, 2026"],
  ["TIN Certificate", "Verified", "Jan 16, 2026"],
  ["Insurance Certificate", "Verified", "Jan 18, 2026"],
  ["Fleet Ownership Documents", "Verified", "Jan 20, 2026"],
  ["Driver Compliance Records", "Verified", "Jan 22, 2026"],
  ["Safety & Regulatory Clearance", "Verified", "Jan 25, 2026"],
];
const activity = [
  [
    "circle-check",
    "Company documents verified",
    "by Super Admin",
    "3 days ago",
  ],
  ["truck", "New truck added", "by Company", "5 days ago"],
  ["users", "Driver record updated", "by Company", "1 week ago"],
  ["wallet", "Payout processed", "by Finance System", "1 week ago"],
  [
    "clipboard-check",
    "Insurance certificate renewed",
    "by Company",
    "2 weeks ago",
  ],
];
const initials = (name = "") =>
  name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
function downloadRows(filename, rows) {
  const fields = Object.keys(rows[0] || {});
  const csv = [
    fields.join(","),
    ...rows.map((row) =>
      fields
        .map((field) => `"${String(row[field] ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CompanyDetail() {
  const navigate = useNavigate(),
    { companyId } = useParams();
  const companies = useCollection("companies") || [],
    allTrucks = useCollection("trucks") || [],
    allDrivers = useCollection("drivers") || [],
    allJobs = useCollection("jobs") || [],
    payoutRows = useCollection("payoutRequests") || [],
    maintenance = useCollection("maintenance") || [];
  const allPayouts = useMemo(
    () => normalizePayouts(payoutRows, allJobs),
    [payoutRows, allJobs],
  );
  const decodedCompanyId = decodeURIComponent(companyId || "");
  const payoutCompany = allPayouts.find(
    (payout) =>
      payout.partyType === "company" &&
      (payout.companyId === decodedCompanyId ||
        payout.partyId === decodedCompanyId ||
        payout.party === decodedCompanyId),
  );
  const company =
    companies.find(
      (item) => item.id === decodedCompanyId || item.name === decodedCompanyId,
    ) ||
    (payoutCompany
      ? {
          id: payoutCompany.companyId || payoutCompany.partyId,
          name: payoutCompany.companyName || payoutCompany.party,
          regNo: payoutCompany.partyId,
          location: "Nigeria",
          contactName: payoutCompany.requestedBy,
          contactPhone: payoutCompany.requester?.phone || "—",
          contactEmail: payoutCompany.requester?.email || "—",
          joined: payoutCompany.dateRequested,
          status: payoutCompany.requester?.status || "Active",
          trucks: 0,
          drivers: 0,
        }
      : companies[0]);
  const trucks = useMemo(() => {
    const linked = allTrucks.filter(
      (truck) => truck.company === company?.name || truck.tc === company?.id,
    );
    return linked.length
      ? linked
      : companies.some((item) => item.id === company?.id)
        ? allTrucks
        : [];
  }, [allTrucks, companies, company]);
  const drivers = useMemo(() => {
    const plates = new Set(trucks.map((truck) => truck.plate));
    const linked = allDrivers.filter(
      (driver) =>
        driver.company === company?.name || plates.has(driver.truckPlate),
    );
    return linked.length
      ? linked
      : companies.some((item) => item.id === company?.id)
        ? allDrivers
        : [];
  }, [allDrivers, companies, company, trucks]);
  const jobs = useMemo(() => {
    const plates = new Set(trucks.map((truck) => truck.plate));
    const linked = allJobs.filter(
      (job) =>
        job.truckCompany === company?.name ||
        job.truckingCompany === company?.name ||
        getJobTrips(job).some((trip) => plates.has(trip.truckPlate)),
    );
    return linked.length
      ? linked
      : companies.some((item) => item.id === company?.id)
        ? allJobs.slice(0, 5)
        : [];
  }, [allJobs, companies, company, trucks]);
  const payouts = useMemo(
    () =>
      allPayouts.filter(
        (payout) =>
          payout.partyType === "company" &&
          (payout.companyId === company?.id ||
            payout.partyId === company?.id ||
            payout.companyName === company?.name ||
            payout.party === company?.name),
      ),
    [allPayouts, company],
  );
  const payoutSummary = useMemo(
    () => getCompanyPayoutSummary(payouts),
    [payouts],
  );
  const [tab, setTab] = useState("Overview"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All Statuses"),
    [page, setPage] = useState(1),
    [selectedTruck, setSelectedTruck] = useState(null),
    [selectedDriver, setSelectedDriver] = useState(null),
    [checkedTrucks, setCheckedTrucks] = useState([]),
    [checkedDrivers, setCheckedDrivers] = useState([]),
    [menu, setMenu] = useState(false),
    [editOpen, setEditOpen] = useState(false),
    [messageOpen, setMessageOpen] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "trucks") setTab("Trucks");
    if (requested === "drivers") setTab("Drivers");
    if (requested === "payouts") setTab("Payouts");
  }, []);
  useEffect(() => {
    if (!selectedTruck && trucks[0]) setSelectedTruck(trucks[0]);
  }, [selectedTruck, trucks]);
  useEffect(() => {
    if (!selectedDriver && drivers[0]) setSelectedDriver(drivers[0]);
  }, [drivers, selectedDriver]);
  if (!company)
    return (
      <Card>
        <p className="tk-body">Company not found.</p>
        <Button onClick={() => navigate("/companies")}>
          Back to companies
        </Button>
      </Card>
    );
  const activeTrucks = trucks.filter((truck) =>
    ["Available", "On Trip", "Active"].includes(truck.status),
  ).length;
  const maintenanceCount = trucks.filter(
    (truck) => truck.status === "In Maintenance",
  ).length;
  const activeDrivers = drivers.filter(
    (driver) => !["Inactive", "Suspended"].includes(driver.status),
  ).length;
  const tabItems = [
    { value: "Overview", label: "Overview" },
    { value: "Trucks", label: "Trucks", count: company.trucks },
    { value: "Drivers", label: "Drivers", count: company.drivers },
    { value: "Documents", label: "Documents", count: 12 },
    { value: "Jobs", label: "Jobs", count: 56 },
    { value: "Payouts", label: "Payouts", count: payouts.length },
    { value: "Compliance", label: "Compliance" },
    { value: "Activity Log", label: "Activity Log" },
  ];
  return (
    <div className="company-page">
      <PageHeader
        crumbs={["Companies", "Trucking Companies", company.name]}
        title="Company Details"
        description="Review the company profile, fleet, drivers, documents and compliance status."
        actions={<>
          <IconButton icon="ellipsis" onClick={() => setMenu(!menu)} />
          <Button variant="outline" icon="mail" onClick={() => setMessageOpen(true)}>Send Message</Button>
          <span className="company-menu-wrap">
            <Button iconRight="chevron-down" onClick={() => setMenu(!menu)}>Actions</Button>
            {menu && (
              <span className="company-dropdown">
                <DropdownMenu
                  width={220}
                  items={[
                    { label: "Edit company", icon: "pencil", onClick: () => { setEditOpen(true); setMenu(false); } },
                    { label: "Print profile", icon: "printer", onClick: () => window.print() },
                    { divider: true },
                    {
                      label: company.status === "Suspended" ? "Reactivate company" : "Suspend company",
                      icon: "ban",
                      tone: company.status === "Suspended" ? undefined : "danger",
                      onClick: () => {
                        setCompanyStatus(company.id, company.status === "Suspended" ? "Active" : "Suspended");
                        setMenu(false);
                      },
                    },
                  ]}
                />
              </span>
            )}
          </span>
        </>}
      />
      <header className="company-hero">
        <div className="company-brand">
          <Avatar name={company.name} size={64} square />
          <div>
            <div className="company-name">
              <h2 className="tk-title">{company.name}</h2>
              <Badge
                dot
                tone={
                  company.verification === "Verified" ? "success" : "warning"
                }
              >
                {company.verification}
              </Badge>
            </div>
            <p>
              {company.regNo}
              <span /> {company.location}
            </p>
            <small>Reliable movement. Greater possibilities.</small>
          </div>
        </div>
        <div className="company-contact">
          <span>
            <Icon name="phone" size={16} />
            {company.contactPhone}
          </span>
          <span>
            <Icon name="mail" size={16} />
            {company.contactEmail}
          </span>
          <span>
            <Icon name="globe" size={16} />
            www.
            {company.name.toLowerCase().replaceAll(" ", "").replace("ltd", "")}
            .com
          </span>
          <span>
            <Icon name="map-pin" size={16} />
            {company.location}
          </span>
          <span className="company-date">
            <small>Joined On</small>
            <strong>{company.joined}</strong>
          </span>
          <span className="company-date">
            <small>Last Updated</small>
            <strong>May 28, 2026</strong>
          </span>
        </div>
      </header>
      <Tabs
        value={tab}
        onChange={(value) => {
          setTab(value);
          setPage(1);
          setQuery("");
          setFilter("All Statuses");
        }}
        items={tabItems}
      />
      {tab === "Overview" && (
        <Overview
          company={company}
          activeTrucks={activeTrucks}
          maintenanceCount={maintenanceCount}
          activeDrivers={activeDrivers}
          jobs={jobs}
          payoutSummary={payoutSummary}
          setTab={setTab}
          openEdit={() => setEditOpen(true)}
        />
      )}
      {tab === "Trucks" && (
        <TrucksTab
          company={company}
          trucks={trucks}
          query={query}
          setQuery={setQuery}
          filter={filter}
          setFilter={setFilter}
          page={page}
          setPage={setPage}
          selected={selectedTruck}
          setSelected={setSelectedTruck}
          checked={checkedTrucks}
          setChecked={setCheckedTrucks}
          navigate={navigate}
          maintenance={maintenance}
        />
      )}
      {tab === "Drivers" && (
        <DriversTab
          company={company}
          drivers={drivers}
          query={query}
          setQuery={setQuery}
          filter={filter}
          setFilter={setFilter}
          page={page}
          setPage={setPage}
          selected={selectedDriver}
          setSelected={setSelectedDriver}
          checked={checkedDrivers}
          setChecked={setCheckedDrivers}
          navigate={navigate}
        />
      )}
      {tab === "Payouts" && (
        <PayoutsTab
          company={company}
          payouts={payouts}
          summary={payoutSummary}
          navigate={navigate}
        />
      )}
      {!["Overview", "Trucks", "Drivers", "Payouts"].includes(tab) && (
        <GenericTab tab={tab} docs={docs} jobs={jobs} navigate={navigate} />
      )}
      <Modal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        title={`Message ${company.name}`}
        description={`Send a message to ${company.contactName}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setMessageOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!message.trim()}
              onClick={() => {
                setMessage("");
                setMessageOpen(false);
              }}
            >
              Send Message
            </Button>
          </>
        }
      >
        <Textarea
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Write your message..."
        />
      </Modal>
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit company profile"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setEditOpen(false)}>Save changes</Button>
          </>
        }
      >
        <div className="company-form">
          <TextField label="Company name" defaultValue={company.name} />
          <TextField label="RC number" defaultValue={company.regNo} />
          <TextField
            label="Contact person"
            defaultValue={company.contactName}
          />
          <TextField label="Phone" defaultValue={company.contactPhone} />
          <TextField label="Email" defaultValue={company.contactEmail} />
          <TextField label="Location" defaultValue={company.location} />
        </div>
      </Modal>
    </div>
  );
}

function StatGrid({ children, five = false }) {
  return (
    <div className={`company-stats ${five ? "company-stats-five" : ""}`}>
      {children}
    </div>
  );
}
function PanelHeader({ title, action, onAction }) {
  return (
    <div className="company-panel-head">
      <h2 className="tk-section">{title}</h2>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}
function ActivityList() {
  return (
    <div className="company-activity">
      {activity.map(([icon, title, sub, time]) => (
        <div key={title}>
          <span>
            <Icon name={icon} size={16} />
          </span>
          <p>
            <strong>{title}</strong>
            <small>{sub}</small>
          </p>
          <time>{time}</time>
        </div>
      ))}
    </div>
  );
}
function Overview({
  company,
  activeTrucks,
  maintenanceCount,
  activeDrivers,
  jobs,
  payoutSummary,
  setTab,
  openEdit,
}) {
  return (
    <div className="company-tab">
      <StatGrid five>
        <StatCard
          icon="truck"
          label="Fleet Size"
          value={company.trucks}
          delta="12%"
          caption="from last month"
        />
        <StatCard
          icon="users"
          tint="teal"
          label="Drivers"
          value={company.drivers}
          delta="8%"
          caption="from last month"
        />
        <StatCard
          icon="truck"
          tint="green"
          label="Active Trucks"
          value={Math.max(activeTrucks, 38)}
          caption="84% of fleet"
        />
        <StatCard
          icon="clipboard-check"
          tint="purple"
          label="Completed Jobs"
          value="256"
          delta="16%"
          caption="from last month"
        />
        <StatCard
          icon="wallet"
          tint="amber"
          label="Total Earnings"
          value={formatNaira(payoutSummary.totalEarned)}
          caption={`${payoutSummary.requests} payout request${payoutSummary.requests === 1 ? "" : "s"}`}
        />
      </StatGrid>
      <div className="company-overview-grid">
        <div className="company-overview-main">
          <Card>
            <PanelHeader
              title="Company Information"
              action="Edit"
              onAction={openEdit}
            />
            <div className="company-info-grid">
              {[
                ["Company Name", company.name],
                ["Contact Person", company.contactName],
                ["RC Number", company.regNo],
                ["Phone Number", company.contactPhone],
                ["Business Type", "Trucking / Logistics"],
                ["Email Address", company.contactEmail],
                ["Date Registered", company.joined],
                ["Location", company.location],
                ["Address", company.location],
                ["Tax Identification Number (TIN)", "987654321"],
                ["Website", "www.globalhaulage.com"],
                [
                  "Status",
                  <Badge dot tone="success">
                    {company.status}
                  </Badge>,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <PanelHeader
              title="Fleet Overview"
              action="View All"
              onAction={() => setTab("Trucks")}
            />
            <div className="company-progress-labels">
              <span>
                <i className="green" />
                Active <strong>{Math.max(activeTrucks, 38)}</strong>
              </span>
              <span>
                <i className="grey" />
                Inactive <strong>5</strong>
              </span>
              <span>
                <i className="amber" />
                Under Maintenance{" "}
                <strong>{Math.max(maintenanceCount, 2)}</strong>
              </span>
              <b>
                {company.trucks}
                <small>Total Trucks</small>
              </b>
            </div>
            <div className="company-progress">
              <span style={{ width: "84%" }} />
              <span style={{ width: "11%" }} />
              <span style={{ width: "5%" }} />
            </div>
          </Card>
          <Card>
            <PanelHeader
              title="Driver Overview"
              action="View All"
              onAction={() => setTab("Drivers")}
            />
            <div className="company-progress-labels">
              <span>
                <i className="green" />
                Active <strong>{Math.max(activeDrivers, 72)}</strong>
              </span>
              <span>
                <i className="grey" />
                Inactive <strong>4</strong>
              </span>
              <span>
                <i className="amber" />
                Pending <strong>2</strong>
              </span>
              <b>
                {company.drivers}
                <small>Total Drivers</small>
              </b>
            </div>
            <div className="company-progress drivers">
              <span style={{ width: "92%" }} />
              <span style={{ width: "5%" }} />
              <span style={{ width: "3%" }} />
            </div>
          </Card>
          <Card>
            <PanelHeader
              title="Recent Jobs"
              action="View All"
              onAction={() => setTab("Jobs")}
            />
            <DataTable
              rows={jobs.slice(0, 5)}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "id",
                  header: "Job ID",
                  render: (row) => (
                    <strong className="company-blue">{row.id}</strong>
                  ),
                },
                { key: "route", header: "Route" },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <Badge dot tone={statusTone[row.status] || "neutral"}>
                      {row.status}
                    </Badge>
                  ),
                },
                {
                  key: "date",
                  header: "Date",
                  render: (row) =>
                    row.pickupDate ||
                    row.published?.split(" ").slice(0, 3).join(" "),
                },
                {
                  key: "amount",
                  header: "Amount",
                  render: (row) =>
                    `₦${Number(row.amount || 0).toLocaleString()}`,
                },
              ]}
            />
          </Card>
        </div>
        <aside className="company-overview-side">
          <Card>
            <PanelHeader title="Verification & Compliance" action="View All" />
            {docs.map(([name, status, date]) => (
              <div className="company-doc" key={name}>
                <Icon name="circle-check" size={17} />
                <span>{name}</span>
                <Badge tone="success">{status}</Badge>
                <time>{date}</time>
              </div>
            ))}
          </Card>
          <Card>
            <PanelHeader
              title="Payment & Earnings"
              action="View All"
              onAction={() => setTab("Payouts")}
            />
            <div className="company-payments">
              {[
                [
                  "wallet",
                  "Total Earnings",
                  formatNaira(payoutSummary.totalEarned),
                ],
                [
                  "building-2",
                  "Total Paid Out",
                  formatNaira(payoutSummary.paid),
                ],
                [
                  "circle-check",
                  "Pending Payout",
                  formatNaira(payoutSummary.pending),
                ],
                [
                  "credit-card",
                  "Available",
                  formatNaira(payoutSummary.available),
                ],
              ].map(([icon, label, value]) => (
                <div key={label}>
                  <span>
                    <Icon name={icon} size={17} />
                  </span>
                  <p>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <PanelHeader title="Recent Activity" action="View All" />
            <ActivityList />
          </Card>
        </aside>
      </div>
    </div>
  );
}

function TrucksTab({
  company,
  trucks,
  query,
  setQuery,
  filter,
  setFilter,
  page,
  setPage,
  selected,
  setSelected,
  checked,
  setChecked,
  navigate,
  maintenance,
}) {
  const [type, setType] = useState("All Fleet Types");
  const filtered = trucks.filter(
    (truck) =>
      (!query ||
        [truck.plate, truck.type, truck.ref].some((value) =>
          value.toLowerCase().includes(query.toLowerCase()),
        )) &&
      (filter === "All Statuses" || truck.status === filter) &&
      (type === "All Fleet Types" || truck.tag === type),
  );
  return (
    <div className="company-tab">
      <StatGrid>
        <StatCard
          icon="truck"
          label="Total Trucks"
          value={company.trucks}
          delta="12%"
          caption="from last month"
        />
        <StatCard
          icon="truck"
          tint="green"
          label="Active Trucks"
          value="38"
          delta="84%"
          caption="of fleet"
        />
        <StatCard
          icon="truck"
          tint="purple"
          label="Inactive Trucks"
          value="5"
          delta="11%"
          direction="down"
          caption="of fleet"
        />
        <StatCard
          icon="truck"
          tint="amber"
          label="Under Maintenance"
          value="2"
          delta="4%"
          direction="down"
          caption="of fleet"
        />
      </StatGrid>
      <div className="company-list-layout">
        <Card pad="none">
          <div className="company-list-head">
            <div>
              <h2 className="tk-section">Trucks ({company.trucks})</h2>
              <p className="tk-meta">
                All trucks registered under {company.name}.
              </p>
            </div>
          </div>
          <div className="company-toolbar">
            <SearchField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search trucks by plate number, type, VIN..."
            />
            <Select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              options={[
                "All Statuses",
                "Available",
                "On Trip",
                "In Maintenance",
                "Inactive",
              ]}
            />
            <Select
              value={type}
              onChange={(event) => setType(event.target.value)}
              options={[
                "All Fleet Types",
                "Trailer",
                "Container",
                "Flatbed",
                "Tanker",
              ]}
            />
            <Button
              variant="outline"
              icon="sliders-horizontal"
              onClick={() => {
                setQuery("");
                setFilter("All Statuses");
                setType("All Fleet Types");
              }}
            >
              Reset
            </Button>
          </div>
          <DataTable
            rows={filtered}
            rowKey={(row) => row.plate}
            selectable
            selected={checked}
            onSelect={setChecked}
            onRowClick={setSelected}
            coloredHeader
            columns={[
              {
                key: "plate",
                header: "Plate Number",
                render: (row) => (
                  <span className="company-vehicle">
                    <span>
                      <Icon name="truck" size={20} />
                    </span>
                    <strong>{row.plate}</strong>
                  </span>
                ),
              },
              { key: "type", header: "Truck Type" },
              {
                key: "model",
                header: "Make / Model",
                render: () => "Mercedes Actros",
              },
              { key: "year", header: "Year", render: () => "2022" },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <Badge dot tone={statusTone[row.status]}>
                    {row.status}
                  </Badge>
                ),
              },
              { key: "date", header: "Last Active" },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <IconButton
                    icon="ellipsis"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(row);
                    }}
                  />
                ),
              },
            ]}
          />
          <Pagination
            page={page}
            pageCount={1}
            total={filtered.length}
            onPage={() => setPage(1)}
          />
        </Card>
        <TruckRail
          truck={selected}
          navigate={navigate}
          maintenance={maintenance}
        />
      </div>
    </div>
  );
}
function TruckRail({ truck, navigate, maintenance }) {
  if (!truck) return null;
  const record = maintenance.find((item) => item.plate === truck.plate);
  return (
    <aside className="company-detail-rail">
      <Card>
        <PanelHeader title="Truck Details" />
        <div className="company-truck-visual">
          <Icon name="truck" size={72} />
        </div>
        <h2 className="tk-title">{truck.plate}</h2>
        <p className="tk-body">
          Mercedes-Benz Actros 1845 <Badge tone="info">{truck.tag}</Badge>
        </p>
        <div className="company-key-values">
          {[
            ["VIN Number", "WDB9634031L123456"],
            ["Engine Number", "OM471123456"],
            ["Year of Manufacture", "2022"],
            ["Fleet Type", truck.type],
            ["Load Capacity", "40,000 kg"],
            ["Fuel Type", "Diesel"],
            [
              "Status",
              <Badge dot tone={statusTone[truck.status]}>
                {truck.status}
              </Badge>,
            ],
            ["Last Active", truck.date],
            ["Current Location", truck.loc],
            ["Assigned Driver", truck.driver],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: "6px",
            marginTop: "16px",
          }}
        >
          <Button
            onClick={() =>
              navigate(`/fleet/${encodeURIComponent(truck.plate)}`)
            }
          >
            View Full Details
          </Button>
          <Button
            variant="outline"
            icon="wrench"
            onClick={() =>
              navigate(record ? `/maintenance/${record.id}` : "/maintenance")
            }
          >
            View Maintenance
          </Button>
        </div>
      </Card>
      <Card>
        <PanelHeader title="Recent Activity" action="View All" />
        <ActivityList />
      </Card>
    </aside>
  );
}

function DriversTab({
  company,
  drivers,
  query,
  setQuery,
  filter,
  setFilter,
  page,
  setPage,
  selected,
  setSelected,
  checked,
  setChecked,
  navigate,
}) {
  const [license, setLicense] = useState("All License Types");
  const filtered = drivers.filter(
    (driver) =>
      (!query ||
        [driver.name, driver.license, driver.phone].some((value) =>
          value?.toLowerCase().includes(query.toLowerCase()),
        )) &&
      (filter === "All Statuses" || driver.status === filter) &&
      (license === "All License Types" || driver.licenseClass === license),
  );
  return (
    <div className="company-tab">
      <StatGrid>
        <StatCard
          icon="users"
          label="Total Drivers"
          value={company.drivers}
          delta="8%"
          caption="from last month"
        />
        <StatCard
          icon="truck"
          tint="green"
          label="Active Drivers"
          value="72"
          delta="10%"
          caption="from last month"
        />
        <StatCard
          icon="clock"
          tint="amber"
          label="Inactive Drivers"
          value="4"
          delta="20%"
          direction="down"
          caption="from last month"
        />
        <StatCard
          icon="ban"
          tint="red"
          label="Suspended Drivers"
          value="2"
          caption="from last month"
        />
      </StatGrid>
      <div className="company-list-layout">
        <Card pad="none">
          <div className="company-list-head">
            <div>
              <h2 className="tk-section">Drivers ({company.drivers})</h2>
              <p className="tk-meta">
                All drivers registered under {company.name}.
              </p>
            </div>
            <Button
              variant="outline"
              icon="download"
              onClick={() =>
                downloadRows(`${company.name}-drivers.csv`, filtered)
              }
            >
              Export Drivers
            </Button>
          </div>
          <div className="company-toolbar">
            <SearchField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search drivers by name, license number, phone..."
            />
            <Select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              options={[
                "All Statuses",
                "Active",
                "On Trip",
                "Inactive",
                "Pending Review",
              ]}
            />
            <Select
              value={license}
              onChange={(event) => setLicense(event.target.value)}
              options={[
                "All License Types",
                "Heavy Vehicle (Class E)",
                "Heavy Vehicle (Class D)",
              ]}
            />
            <Button
              variant="outline"
              icon="sliders-horizontal"
              onClick={() => {
                setQuery("");
                setFilter("All Statuses");
                setLicense("All License Types");
              }}
            >
              Reset
            </Button>
          </div>
          <DataTable
            rows={filtered}
            rowKey={(row) => row.id}
            selectable
            selected={checked}
            onSelect={setChecked}
            onRowClick={setSelected}
            coloredHeader
            columns={[
              {
                key: "driver",
                header: "Driver",
                render: (row) => (
                  <span className="tc-company-cell">
                    <Avatar name={row.name} size={32} />
                    <span>
                      <strong>{row.name}</strong>
                      <small>{row.id}</small>
                    </span>
                  </span>
                ),
              },
              { key: "license", header: "License Number" },
              {
                key: "licenseClass",
                header: "License Type",
                render: (row) =>
                  row.licenseClass?.split("(")[1]?.replace(")", "") ||
                  "Class E",
              },
              { key: "phone", header: "Phone Number" },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <Badge dot tone={statusTone[row.status] || "neutral"}>
                    {row.status}
                  </Badge>
                ),
              },
              { key: "joined", header: "Date Joined" },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <IconButton
                    icon="ellipsis"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(row);
                    }}
                  />
                ),
              },
            ]}
          />
          <Pagination
            page={page}
            pageCount={1}
            total={filtered.length}
            onPage={() => setPage(1)}
          />
        </Card>
        <DriverRail driver={selected} navigate={navigate} />
      </div>
    </div>
  );
}
function DriverRail({ driver, navigate }) {
  if (!driver) return null;
  return (
    <aside className="company-detail-rail">
      <Card>
        <div className="company-panel-head">
          <h2 className="tk-section">Driver Details</h2>
          <Badge dot tone={statusTone[driver.status] || "success"}>
            {driver.status}
          </Badge>
        </div>
        <div className="company-driver-head">
          <Avatar name={driver.name} size={76} />
          <div>
            <h2 className="tk-title">{driver.name}</h2>
            <small>{driver.id}</small>
            <span>
              <Icon name="phone" size={14} />
              {driver.phone}
            </span>
            <span>
              <Icon name="mail" size={14} />
              {driver.email}
            </span>
            <span>
              <Icon name="map-pin" size={14} />
              {driver.currentLocation}
            </span>
          </div>
        </div>

        <div className="company-key-values">
          {[
            ["License Number", driver.license],
            ["License Type", driver.licenseClass],
            ["Date of Birth", driver.dob],
            ["Address", driver.address],
            ["Date Joined", driver.joined],
            [
              "Status",
              <Badge dot tone={statusTone[driver.status] || "success"}>
                {driver.status}
              </Badge>,
            ],
            ["Assigned Truck", driver.truckPlate || "—"],
            ["Total Trips", driver.totalTrips],
            ["Rating", `⭐ ${driver.rating} / 5`],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "16px",
          }}
        >
          <Button
            fullWidth
            icon="eye"
            onClick={() => navigate(`/drivers/${driver.id}`)}
          >
            View Full Profile
          </Button>
          <Button variant="outline" icon="file-text" fullWidth>
            View Documents
          </Button>
        </div>
      </Card>
      <Card>
        <PanelHeader title="Recent Activity" action="View All" />
        <ActivityList />
      </Card>
    </aside>
  );
}

function PayoutsTab({ company, payouts, summary, navigate }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [selected, setSelected] = useState(payouts[0] || null);
  const filtered = payouts.filter(
    (payout) =>
      (status === "All Statuses" || payout.status === status) &&
      (!search ||
        [payout.id, payout.jobId, ...(payout.tripIds || [])].some((value) =>
          value?.toLowerCase().includes(search.toLowerCase()),
        )),
  );
  const row =
    selected && payouts.find((item) => item.id === selected.id)
      ? selected
      : filtered[0];
  return (
    <div className="company-tab">
      <StatGrid five>
        <StatCard
          icon="wallet"
          label="Total Earned"
          value={formatNaira(summary.totalEarned)}
          caption={`${summary.requests} requests`}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Available"
          value={formatNaira(summary.available)}
          caption="eligible for approval"
        />
        <StatCard
          icon="clock"
          tint="amber"
          label="Pending Review"
          value={formatNaira(summary.pending)}
          caption="submitted requests"
        />
        <StatCard
          icon="repeat"
          tint="blue"
          label="Processing"
          value={formatNaira(summary.processing)}
          caption="approved or processing"
        />
        <StatCard
          icon="banknote"
          tint="purple"
          label="Paid Out"
          value={formatNaira(summary.paid)}
          caption="completed payouts"
        />
      </StatGrid>
      <div className="company-list-layout">
        <Card pad="none">
          <div className="company-list-head">
            <div>
              <h2 className="tk-section">Payout ledger ({payouts.length})</h2>
              <p className="tk-meta">
                Company payouts reconciled to jobs and individual truck trips.
              </p>
            </div>
            <Button
              variant="outline"
              icon="external-link"
              onClick={() =>
                navigate(`/payouts?companyId=${encodeURIComponent(company.id)}`)
              }
            >
              All platform payouts
            </Button>
          </div>
          <div className="company-toolbar company-payout-toolbar">
            <SearchField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search payout, job, or trip ID..."
            />
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={[
                "All Statuses",
                "Pending Review",
                "Approved",
                "Processing",
                "Completed",
                "Rejected",
              ]}
            />
            <Button
              variant="outline"
              icon="sliders-horizontal"
              onClick={() => {
                setSearch("");
                setStatus("All Statuses");
              }}
            >
              Reset
            </Button>
          </div>
          <DataTable
            rows={filtered}
            rowKey={(payout) => payout.id}
            coloredHeader
            onRowClick={setSelected}
            columns={[
              {
                key: "id",
                header: "Payout ID",
                render: (payout) => (
                  <button
                    className="company-blue company-button-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/payouts/${payout.id}`);
                    }}
                  >
                    {payout.id}
                  </button>
                ),
              },
              {
                key: "jobId",
                header: "Job",
                render: (payout) => (
                  <button
                    className="company-blue company-button-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/jobs/${payout.jobId}`);
                    }}
                  >
                    {payout.jobId}
                  </button>
                ),
              },
              {
                key: "trips",
                header: "Trips",
                render: (payout) => `${payout.tripIds?.length || 0} included`,
              },
              {
                key: "gross",
                header: "Gross",
                render: (payout) => formatNaira(payout.grossAmount),
              },
              {
                key: "deductions",
                header: "Deductions",
                render: (payout) => formatNaira(payout.deductions),
              },
              {
                key: "net",
                header: "Net",
                render: (payout) => (
                  <strong>{formatNaira(payout.netAmount)}</strong>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (payout) => (
                  <Badge dot tone={statusTone[payout.status] || "neutral"}>
                    {payout.status}
                  </Badge>
                ),
              },
              {
                key: "eligibility",
                header: "Eligibility",
                render: (payout) => (
                  <Badge
                    tone={
                      payout.approvalReady
                        ? "success"
                        : payout.eligibility === "Needs Review"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {payout.eligibility}
                  </Badge>
                ),
              },
            ]}
          />
          {!filtered.length && (
            <div className="company-empty">
              <Icon name="wallet" size={24} />
              <strong>No company payouts found</strong>
              <span>
                Completed trip earnings and payout requests will appear here.
              </span>
            </div>
          )}
        </Card>
        <aside className="company-detail-rail">
          <Card>
            <PanelHeader title="Payout Details" />
            {row ? (
              <>
                <div className="company-payout-total">
                  <span className="tk-meta">Net payout</span>
                  <strong>{formatNaira(row.netAmount)}</strong>
                  <Badge tone={statusTone[row.status] || "neutral"}>
                    {row.status}
                  </Badge>
                </div>
                <div className="company-key-values">
                  {[
                    ["Payout ID", row.id],
                    ["Job", row.jobId],
                    ["Trips included", row.tripIds?.length || 0],
                    ["Gross amount", formatNaira(row.grossAmount)],
                    ["Deductions", formatNaira(row.deductions)],
                    ["Eligibility", row.eligibility],
                    [
                      "Reconciliation",
                      row.reconciliation?.ok ? "Balanced" : "Needs review",
                    ],
                    ["Requested", row.dateRequested],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                {!row.approvalReady && (
                  <div className="company-payout-warning">
                    Payment is held until every included trip is delivered and
                    the amounts reconcile.
                  </div>
                )}
                <Button
                  fullWidth
                  onClick={() => navigate(`/payouts/${row.id}`)}
                >
                  View Full Details
                </Button>
              </>
            ) : (
              <div className="company-empty">
                <span>Select a payout to inspect it.</span>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function GenericTab({ tab, docs: documentRows, jobs, navigate }) {
  const rows =
    tab === "Documents" || tab === "Compliance"
      ? documentRows.map(([name, status, date], i) => ({
          id: i,
          name,
          status,
          date,
        }))
      : tab === "Jobs"
        ? jobs
        : activity.map(([icon, title, sub, time], i) => ({
            id: i,
            title,
            sub,
            time,
          }));
  const columns =
    tab === "Documents" || tab === "Compliance"
      ? [
          { key: "name", header: "Document" },
          {
            key: "status",
            header: "Status",
            render: (row) => <Badge tone="success">{row.status}</Badge>,
          },
          { key: "date", header: "Reviewed On" },
        ]
      : tab === "Jobs"
        ? [
            {
              key: "id",
              header: "Job ID",
              render: (row) => (
                <button
                  className="company-blue company-button-link"
                  onClick={() => navigate(`/jobs/${row.id}`)}
                >
                  {row.id}
                </button>
              ),
            },
            { key: "route", header: "Route" },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <Badge tone={statusTone[row.status] || "neutral"}>
                  {row.status}
                </Badge>
              ),
            },
            {
              key: "amount",
              header: "Value",
              render: (row) => `₦${Number(row.amount || 0).toLocaleString()}`,
            },
          ]
        : [
            { key: "title", header: tab },
            { key: "sub", header: "Source" },
            { key: "time", header: "Updated" },
          ];
  return (
    <Card pad="none">
      <div className="company-list-head">
        <div>
          <h2 className="tk-section">{tab}</h2>
          <p className="tk-meta">
            Current {tab.toLowerCase()} records for this company.
          </p>
        </div>
      </div>
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        coloredHeader
        columns={columns}
      />
    </Card>
  );
}
