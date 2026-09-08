"use client";

import { useMemo, useState } from "react";
import { Link, useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  Card,
  SectionCard,
  Tabs,
  TableToolbar,
  SearchField,
  FilterSelect,
  DataTable,
  Pagination,
  Badge,
  IconButton,
  DropdownMenu,
  Icon,
  ListRow,
  Modal,
  TextField,
  Select,
  EmptyState,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import {
  addServicePricing,
  setServicePricingStatus,
  setSurchargeStatus,
  approvePriceException,
  rejectPriceException,
} from "../mock/api.js";
import {
  pricingSummary,
  priceApprovalSummary,
} from "../mock/fixtures/pricing.js";
import { formatNaira } from "../mock/format.js";

const TABS = [
  "Service Pricing",
  "Surcharges & Fees",
  "Price Lists",
  "Pricing Rules",
  "Approvals",
  "Price Exceptions",
  "Price History",
];
const PAGE_SIZE = 8;

function FilterButton({ label, value, options, active, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative" }}>
      <FilterSelect
        label={value}
        active={active}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <span
          style={{ position: "absolute", left: 0, top: 44, zIndex: 30 }}
          onMouseLeave={() => setOpen(false)}
        >
          <DropdownMenu
            width={210}
            items={options.map((o) => ({
              label: o,
              icon: o === value ? "check" : undefined,
              onClick: () => {
                onChange(o);
                setOpen(false);
              },
            }))}
          />
        </span>
      )}
    </span>
  );
}

function RowMenu({ items, id, menuFor, setMenuFor }) {
  return (
    <span style={{ position: "relative" }}>
      <IconButton
        icon="ellipsis-vertical"
        onClick={() => setMenuFor(menuFor === id ? null : id)}
      />
      {menuFor === id && (
        <span
          style={{ position: "absolute", right: 0, top: 34, zIndex: 30 }}
          onMouseLeave={() => setMenuFor(null)}
        >
          <DropdownMenu width={200} items={items} />
        </span>
      )}
    </span>
  );
}

function PriceChangeRow({ c }) {
  const up = c.pct.startsWith("+");
  return (
    <div style={{ padding: "11px 0", borderTop: "1px solid var(--tk-line)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            flex: 1,
            font: "600 13px/18px var(--tk-font-sans)",
            color: "var(--tk-ink-900)",
          }}
        >
          {c.service}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            font: "600 12px/16px var(--tk-font-sans)",
            color: up ? "var(--tk-success)" : "var(--tk-danger)",
          }}
        >
          <Icon name={up ? "arrow-up" : "arrow-down"} size={11} />
          {c.pct}
        </span>
      </div>
      <span className="tk-meta" style={{ display: "block" }}>
        {c.route}
      </span>
      <span
        style={{
          display: "block",
          font: "500 12px/18px var(--tk-font-sans)",
          color: "var(--tk-ink-500)",
        }}
      >
        {formatNaira(c.from)} →{" "}
        <b style={{ color: "var(--tk-ink-900)" }}>{formatNaira(c.to)}</b>
      </span>
      <span className="tk-meta" style={{ display: "block" }}>
        {c.updated} {c.time} by {c.by}
      </span>
    </div>
  );
}

function ApprovalTile({ label, value, tone }) {
  const TONE = {
    amber: ["var(--tk-warning-soft)", "var(--tk-warning)"],
    green: ["var(--tk-success-soft)", "var(--tk-success)"],
    red: ["var(--tk-danger-soft)", "var(--tk-danger)"],
  };
  const [bg, fg] = TONE[tone];
  return (
    <div
      style={{
        background: bg,
        borderRadius: "var(--tk-r-lg)",
        padding: "14px 10px",
        display: "grid",
        gap: 4,
        justifyItems: "center",
        textAlign: "center",
      }}
    >
      <span style={{ font: "700 20px/24px var(--tk-font-sans)", color: fg }}>
        {value}
      </span>
      <span className="tk-meta">{label}</span>
    </div>
  );
}

export function PricingManagement() {
  const navigate = useNavigate();
  const services = useCollection("servicePricing") || [];
  const pricingRules = useCollection("pricingRules") || [];
  const surcharges = useCollection("surcharges") || [];
  const priceLists = useCollection("priceLists") || [];
  const exceptions = useCollection("priceExceptions") || [];
  const history = useCollection("priceHistory") || [];
  const recentChanges = history.slice(0, 5);

  const [tab, setTab] = useState("Service Pricing");
  const [q, setQ] = useState("");
  const [serviceType, setServiceType] = useState("All Services");
  const [jobType, setJobType] = useState("All Job Types");
  const [route, setRoute] = useState("All Routes");
  const [location, setLocation] = useState("All Locations");
  const [truckType, setTruckType] = useState("All Truck Types");
  const [currency, setCurrency] = useState("NGN (₦)");
  const [page, setPage] = useState(1);
  const [view, setView] = useState("list");
  const [menuFor, setMenuFor] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [draft, setDraft] = useState({
    service: "",
    route: "",
    coverage: "",
    truckType: "",
    unit: "Per Trip",
    basePrice: "",
    surcharge: "",
  });
  const [busy, setBusy] = useState(false);

  const serviceOptions = useMemo(
    () => ["All Services", ...new Set(services.map((s) => s.service))],
    [services],
  );
  const truckOptions = useMemo(
    () => ["All Truck Types", ...new Set(services.map((s) => s.truckType))],
    [services],
  );
  const routeOptions = useMemo(
    () => ["All Routes", ...new Set(services.map((s) => s.route))],
    [services],
  );
  const locationOptions = useMemo(
    () => ["All Locations", ...new Set(services.map((s) => s.coverage))],
    [services],
  );

  const filtered = useMemo(
    () =>
      services.filter(
        (s) =>
          (serviceType === "All Services" || s.service === serviceType) &&
          (jobType === "All Job Types" || s.unit === jobType) &&
          (route === "All Routes" || s.route === route) &&
          (location === "All Locations" || s.coverage === location) &&
          (truckType === "All Truck Types" || s.truckType === truckType) &&
          (!q ||
            [s.service, s.route, s.coverage, s.truckType].some(
              (v) => v && v.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [services, serviceType, jobType, route, location, truckType, q],
  );

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetFilters() {
    setServiceType("All Services");
    setJobType("All Job Types");
    setRoute("All Routes");
    setLocation("All Locations");
    setTruckType("All Truck Types");
    setCurrency("NGN (₦)");
    setQ("");
    setPage(1);
  }

  async function submitAdd() {
    if (!draft.service || !draft.route || !draft.basePrice) return;
    setBusy(true);
    await addServicePricing(draft);
    setBusy(false);
    setAddOpen(false);
    setDraft({
      service: "",
      route: "",
      coverage: "",
      truckType: "",
      unit: "Per Trip",
      basePrice: "",
      surcharge: "",
    });
    setPage(1);
  }

  return (
    <>
      <PageHeader
        crumbs={["Business & Finance", "Pricing Management"]}
        title="Pricing Management"
        description="Manage service rates, pricing rules and surcharges across Trukkas."
        actions={
          <>
            <FilterSelect label="May 24 – May 30, 2026" icon="calendar" />
            <Button variant="outline" icon="filter">
              Filters
            </Button>
            <Button icon="plus" onClick={() => setAddOpen(true)}>
              Add Pricing
            </Button>
          </>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--tk-space-4)",
        }}
      >
        <StatCard
          icon="list-checks"
          tint="blue"
          label="Active Price Lists"
          value={pricingSummary.activePriceLists}
          delta={pricingSummary.activePriceListsDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="package"
          tint="purple"
          label="Total Services"
          value={pricingSummary.totalServices}
          delta={pricingSummary.totalServicesDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="trending-up"
          tint="teal"
          label="Avg. Price Change"
          value={pricingSummary.avgPriceChange}
          delta={pricingSummary.avgPriceChangeDelta}
          direction="down"
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="triangle-alert"
          tint="amber"
          label="Price Exceptions"
          value={pricingSummary.priceExceptions}
          delta={pricingSummary.priceExceptionsDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="badge-percent"
          tint="green"
          label="Surcharges Active"
          value={pricingSummary.surchargesActive}
          delta={pricingSummary.surchargesActiveDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="coins"
          tint="navy"
          label="Currency"
          value={pricingSummary.currency}
          caption="Base Currency"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: "var(--tk-grid-gap)",
          alignItems: "start",
        }}
      >
        <SectionCard title="" pad="none" style={{ paddingTop: 4 }}>
          <Tabs
            value={tab}
            onChange={(v) => {
              setTab(v);
              setPage(1);
            }}
            style={{ padding: "0 var(--tk-card-pad)" }}
            items={TABS}
          />

          {tab === "Service Pricing" && (
            <>
              <TableToolbar
                filters={
                  <>
                    <FilterButton
                      label="Service Type"
                      value={serviceType}
                      options={serviceOptions}
                      active={serviceType !== "All Services"}
                      onChange={(v) => {
                        setServiceType(v);
                        setPage(1);
                      }}
                    />
                    <FilterButton
                      label="Job Type"
                      value={jobType}
                      options={["All Job Types", "Per Trip", "Per Day"]}
                      active={jobType !== "All Job Types"}
                      onChange={(v) => {
                        setJobType(v);
                        setPage(1);
                      }}
                    />
                    <FilterButton
                      label="Route"
                      value={route}
                      options={routeOptions}
                      active={route !== "All Routes"}
                      onChange={(v) => {
                        setRoute(v);
                        setPage(1);
                      }}
                    />
                    <FilterButton
                      label="Location"
                      value={location}
                      options={locationOptions}
                      active={location !== "All Locations"}
                      onChange={(v) => {
                        setLocation(v);
                        setPage(1);
                      }}
                    />
                    <FilterButton
                      label="Truck Type"
                      value={truckType}
                      options={truckOptions}
                      active={truckType !== "All Truck Types"}
                      onChange={(v) => {
                        setTruckType(v);
                        setPage(1);
                      }}
                    />
                    <FilterButton
                      label="Currency"
                      value={currency}
                      options={["NGN (₦)"]}
                      onChange={setCurrency}
                    />
                  </>
                }
              />
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "0 var(--tk-card-pad) 14px",
                  justifyContent: "flex-end",
                }}
              >
                <Button
                  variant="outline"
                  icon="rotate-ccw"
                  size="sm"
                  onClick={resetFilters}
                >
                  Reset
                </Button>
                <Button size="sm">Apply</Button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 var(--tk-card-pad) 12px",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    font: "600 15px/22px var(--tk-font-sans)",
                    color: "var(--tk-ink-900)",
                  }}
                >
                  Service Pricing{" "}
                  <span style={{ color: "var(--tk-ink-400)", fontWeight: 500 }}>
                    ({filtered.length})
                  </span>
                </span>
                <SearchField
                  placeholder="Search services, routes..."
                  style={{ width: 220 }}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                />
                <span style={{ position: "relative" }}>
                  <Button
                    variant="outline"
                    icon="download"
                    iconRight="chevron-down"
                    size="sm"
                    onClick={() => setExportOpen((o) => !o)}
                  >
                    Export
                  </Button>
                  {exportOpen && (
                    <span
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 38,
                        zIndex: 30,
                      }}
                      onMouseLeave={() => setExportOpen(false)}
                    >
                      <DropdownMenu
                        width={180}
                        items={[
                          { label: "Export as CSV", icon: "file-text" },
                          { label: "Export as PDF", icon: "file-text" },
                        ]}
                      />
                    </span>
                  )}
                </span>
                <span
                  style={{
                    display: "flex",
                    border: "1px solid var(--tk-line-strong)",
                    borderRadius: "var(--tk-r-md)",
                    overflow: "hidden",
                  }}
                >
                  <IconButton
                    icon="list"
                    tone={view === "list" ? "blue" : "ghost"}
                    style={{ borderRadius: 0 }}
                    onClick={() => setView("list")}
                  />
                  <IconButton
                    icon="grid-3x3"
                    tone={view === "grid" ? "blue" : "ghost"}
                    style={{ borderRadius: 0 }}
                    onClick={() => setView("grid")}
                  />
                </span>
              </div>

              {view === "list" ? (
                <DataTable
                  rows={paged}
                  rowKey={(r) => r.id}
                  columns={[
                    {
                      key: "service",
                      header: "Service / Job Type",
                      render: (r) => (
                        <Link
                          to={`/pricing/${r.id}`}
                          style={{
                            font: "600 13px/18px var(--tk-font-sans)",
                            color: "var(--tk-ink-900)",
                          }}
                        >
                          {r.service}
                        </Link>
                      ),
                    },
                    {
                      key: "route",
                      header: "Route / Coverage",
                      render: (r) => (
                        <span style={{ display: "grid", gap: 2 }}>
                          <span
                            style={{
                              font: "500 13px/18px var(--tk-font-sans)",
                              color: "var(--tk-ink-700)",
                            }}
                          >
                            {r.route}
                          </span>
                          <span className="tk-meta">{r.coverage}</span>
                        </span>
                      ),
                    },
                    { key: "truckType", header: "Truck Type / Container" },
                    { key: "unit", header: "Unit" },
                    {
                      key: "basePrice",
                      header: "Base Price (₦)",
                      align: "right",
                      render: (r) => r.basePrice.toLocaleString("en-NG"),
                    },
                    {
                      key: "surcharge",
                      header: "Surcharge",
                      render: (r) => (
                        <span style={{ display: "grid", gap: 2 }}>
                          <span>{r.surcharge.toLocaleString("en-NG")}</span>
                          <span className="tk-meta">({r.surchargePct})</span>
                        </span>
                      ),
                    },
                    {
                      key: "totalPrice",
                      header: "Total Price (₦)",
                      align: "right",
                      render: (r) => (
                        <span
                          style={{
                            font: "600 13px/18px var(--tk-font-sans)",
                            color: "var(--tk-ink-900)",
                          }}
                        >
                          {r.totalPrice.toLocaleString("en-NG")}
                        </span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (r) => <Badge>{r.status}</Badge>,
                    },
                    {
                      key: "updated",
                      header: "Last Updated",
                      render: (r) => (
                        <span style={{ display: "grid", gap: 2 }}>
                          <span>{r.updated}</span>
                          <span className="tk-meta">{r.updatedTime}</span>
                        </span>
                      ),
                    },
                    {
                      key: "x",
                      header: "",
                      width: 44,
                      render: (r) => (
                        <RowMenu
                          id={r.id}
                          menuFor={menuFor}
                          setMenuFor={setMenuFor}
                          items={[
                            {
                              label: "View Pricing",
                              icon: "eye",
                              onClick: () => {
                                setMenuFor(null);
                                navigate(`/pricing/${r.id}`);
                              },
                            },
                            {
                              label: "Edit Pricing",
                              icon: "pencil",
                              onClick: () => setMenuFor(null),
                            },
                            {
                              label: "Duplicate",
                              icon: "copy",
                              onClick: () => setMenuFor(null),
                            },
                            { divider: true },
                            {
                              label:
                                r.status === "Active"
                                  ? "Deactivate"
                                  : "Activate",
                              icon: "circle-slash",
                              tone: "danger",
                              onClick: () => {
                                setServicePricingStatus(
                                  r.id,
                                  r.status === "Active" ? "Inactive" : "Active",
                                );
                                setMenuFor(null);
                              },
                            },
                          ]}
                        />
                      ),
                    },
                  ]}
                />
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: 12,
                    padding: "0 var(--tk-card-pad) 12px",
                  }}
                >
                  {paged.map((r) => (
                    <Card
                      key={r.id}
                      pad="tight"
                      style={{ display: "grid", gap: 8 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <Link
                          to={`/pricing/${r.id}`}
                          style={{
                            font: "600 13px/18px var(--tk-font-sans)",
                            color: "var(--tk-ink-900)",
                          }}
                        >
                          {r.service}
                        </Link>
                        <Badge>{r.status}</Badge>
                      </div>
                      <span className="tk-meta">
                        {r.route} · {r.coverage}
                      </span>
                      <span className="tk-meta">
                        {r.truckType} · {r.unit}
                      </span>
                      <span
                        style={{
                          font: "700 16px/22px var(--tk-font-sans)",
                          color: "var(--tk-ink-900)",
                        }}
                      >
                        {formatNaira(r.totalPrice)}
                      </span>
                    </Card>
                  ))}
                </div>
              )}
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
                onPage={setPage}
                onPageSize={() => {}}
              />
            </>
          )}

          {tab === "Surcharges & Fees" && (
            <DataTable
              rows={surcharges}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "name",
                  header: "Surcharge / Fee",
                  render: (r) => (
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "var(--tk-r-sm)",
                          background: "var(--tk-warning-soft)",
                          color: "var(--tk-warning)",
                          display: "grid",
                          placeItems: "center",
                          flex: "0 0 auto",
                        }}
                      >
                        <Icon name={r.icon} size={16} />
                      </span>
                      <span style={{ display: "grid", gap: 2 }}>
                        <span
                          style={{
                            font: "600 13px/18px var(--tk-font-sans)",
                            color: "var(--tk-ink-900)",
                          }}
                        >
                          {r.name}
                        </span>
                        <span className="tk-meta">{r.description}</span>
                      </span>
                    </span>
                  ),
                },
                { key: "rate", header: "Rate", render: (r) => <b>{r.rate}</b> },
                { key: "appliesTo", header: "Applies To" },
                { key: "effectiveFrom", header: "Effective From" },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <Badge>{r.status}</Badge>,
                },
                {
                  key: "x",
                  header: "",
                  width: 44,
                  render: (r) => (
                    <RowMenu
                      id={r.id}
                      menuFor={menuFor}
                      setMenuFor={setMenuFor}
                      items={[
                        {
                          label: "Edit",
                          icon: "pencil",
                          onClick: () => setMenuFor(null),
                        },
                        {
                          label:
                            r.status === "Active" ? "Deactivate" : "Activate",
                          icon: "circle-slash",
                          tone: "danger",
                          onClick: () => {
                            setSurchargeStatus(
                              r.id,
                              r.status === "Active" ? "Inactive" : "Active",
                            );
                            setMenuFor(null);
                          },
                        },
                      ]}
                    />
                  ),
                },
              ]}
            />
          )}

          {tab === "Price Lists" && (
            <DataTable
              rows={priceLists}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "name",
                  header: "Price List",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
                      <span
                        style={{
                          font: "600 13px/18px var(--tk-font-sans)",
                          color: "var(--tk-ink-900)",
                        }}
                      >
                        {r.name}
                      </span>
                      <span className="tk-meta">{r.id}</span>
                    </span>
                  ),
                },
                { key: "region", header: "Region / Coverage" },
                { key: "services", header: "Services", align: "right" },
                { key: "currency", header: "Currency" },
                { key: "lastUpdated", header: "Last Updated" },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <Badge>{r.status}</Badge>,
                },
              ]}
            />
          )}

          {tab === "Pricing Rules" && (
            <DataTable
              rows={pricingRules}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "name",
                  header: "Rule",
                  render: (r) => (
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "var(--tk-r-sm)",
                          background: "var(--tk-blue-soft)",
                          color: "var(--tk-blue)",
                          display: "grid",
                          placeItems: "center",
                          flex: "0 0 auto",
                        }}
                      >
                        <Icon name={r.icon} size={16} />
                      </span>
                      <span style={{ display: "grid", gap: 2 }}>
                        <span
                          style={{
                            font: "600 13px/18px var(--tk-font-sans)",
                            color: "var(--tk-ink-900)",
                          }}
                        >
                          {r.name}
                        </span>
                        <span className="tk-meta">{r.description}</span>
                      </span>
                    </span>
                  ),
                },
                {
                  key: "rate",
                  header: "Rate / Value",
                  render: (r) => <b>{r.rate}</b>,
                },
              ]}
            />
          )}

          {tab === "Approvals" && (
            <DataTable
              rows={exceptions.filter((e) => e.status === "Pending Approval")}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "service",
                  header: "Service / Route",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
                      <span
                        style={{
                          font: "600 13px/18px var(--tk-font-sans)",
                          color: "var(--tk-ink-900)",
                        }}
                      >
                        {r.service}
                      </span>
                      <span className="tk-meta">{r.route}</span>
                    </span>
                  ),
                },
                { key: "requestedBy", header: "Requested By" },
                {
                  key: "standardPrice",
                  header: "Standard Price",
                  align: "right",
                  render: (r) => formatNaira(r.standardPrice),
                },
                {
                  key: "exceptionPrice",
                  header: "Requested Price",
                  align: "right",
                  render: (r) => (
                    <b style={{ color: "var(--tk-blue)" }}>
                      {formatNaira(r.exceptionPrice)}
                    </b>
                  ),
                },
                { key: "submitted", header: "Submitted" },
                {
                  key: "x",
                  header: "Actions",
                  width: 170,
                  render: (r) => (
                    <span style={{ display: "flex", gap: 8 }}>
                      <Button
                        size="sm"
                        onClick={() => approvePriceException(r.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => rejectPriceException(r.id)}
                      >
                        Reject
                      </Button>
                    </span>
                  ),
                },
              ]}
            />
          )}
          {tab === "Approvals" &&
            exceptions.filter((e) => e.status === "Pending Approval").length ===
              0 && (
              <EmptyState
                icon="circle-check"
                title="Nothing pending"
                description="All price exceptions have been reviewed."
              />
            )}

          {tab === "Price Exceptions" && (
            <DataTable
              rows={exceptions}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "service",
                  header: "Service / Route",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
                      <span
                        style={{
                          font: "600 13px/18px var(--tk-font-sans)",
                          color: "var(--tk-ink-900)",
                        }}
                      >
                        {r.service}
                      </span>
                      <span className="tk-meta">{r.route}</span>
                    </span>
                  ),
                },
                { key: "reason", header: "Reason" },
                { key: "requestedBy", header: "Requested By" },
                {
                  key: "standardPrice",
                  header: "Standard",
                  align: "right",
                  render: (r) => formatNaira(r.standardPrice),
                },
                {
                  key: "exceptionPrice",
                  header: "Exception",
                  align: "right",
                  render: (r) => formatNaira(r.exceptionPrice),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <Badge>{r.status}</Badge>,
                },
                { key: "submitted", header: "Submitted" },
              ]}
            />
          )}

          {tab === "Price History" && (
            <DataTable
              rows={history}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "service",
                  header: "Service / Route",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
                      <span
                        style={{
                          font: "600 13px/18px var(--tk-font-sans)",
                          color: "var(--tk-ink-900)",
                        }}
                      >
                        {r.service}
                      </span>
                      <span className="tk-meta">{r.route}</span>
                    </span>
                  ),
                },
                {
                  key: "from",
                  header: "From (₦)",
                  align: "right",
                  render: (r) => r.from.toLocaleString("en-NG"),
                },
                {
                  key: "to",
                  header: "To (₦)",
                  align: "right",
                  render: (r) => <b>{r.to.toLocaleString("en-NG")}</b>,
                },
                {
                  key: "pct",
                  header: "Change",
                  render: (r) => (
                    <span
                      style={{
                        color: r.pct.startsWith("+")
                          ? "var(--tk-success)"
                          : "var(--tk-danger)",
                        fontWeight: 600,
                      }}
                    >
                      {r.pct}
                    </span>
                  ),
                },
                {
                  key: "updated",
                  header: "Date",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
                      <span>{r.updated}</span>
                      <span className="tk-meta">{r.time}</span>
                    </span>
                  ),
                },
                { key: "by", header: "Updated By" },
              ]}
            />
          )}
        </SectionCard>

        <div
          style={{
            display: "grid",
            gap: "var(--tk-grid-gap)",
            alignContent: "start",
          }}
        >
          <SectionCard
            title="Pricing Rules"
            action={
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setTab("Pricing Rules");
                }}
              >
                View All
              </a>
            }
            footer={
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setTab("Pricing Rules");
                }}
              >
                Manage Pricing Rules →
              </a>
            }
          >
            {pricingRules.slice(0, 5).map((r) => (
              <ListRow
                key={r.id}
                icon={r.icon}
                iconTint={r.iconTint}
                title={r.name}
                subtitle={r.description}
                value={r.rate}
              />
            ))}
          </SectionCard>

          <SectionCard
            title="Recent Price Changes"
            action={
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setTab("Price History");
                }}
              >
                View All
              </a>
            }
          >
            {recentChanges.map((c) => (
              <PriceChangeRow key={c.id} c={c} />
            ))}
          </SectionCard>

          <SectionCard title="Price Approval Summary">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              <ApprovalTile
                label="Pending Approval"
                value={priceApprovalSummary.pending}
                tone="amber"
              />
              <ApprovalTile
                label="Approved"
                value={priceApprovalSummary.approved}
                tone="green"
              />
              <ApprovalTile
                label="Rejected"
                value={priceApprovalSummary.rejected}
                tone="red"
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Pricing"
        description="Create a new service pricing entry."
        width={560}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                busy || !draft.service || !draft.route || !draft.basePrice
              }
              onClick={submitAdd}
            >
              {busy ? "Saving…" : "Add Pricing"}
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <TextField
            label="Service"
            required
            placeholder="e.g. Import (Container)"
            value={draft.service}
            onChange={(e) => setDraft({ ...draft, service: e.target.value })}
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <TextField
              label="Route"
              required
              placeholder="e.g. Apapa Port → Ikeja"
              value={draft.route}
              onChange={(e) => setDraft({ ...draft, route: e.target.value })}
            />
            <TextField
              label="Coverage"
              placeholder="e.g. Lagos"
              value={draft.coverage}
              onChange={(e) => setDraft({ ...draft, coverage: e.target.value })}
            />
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <TextField
              label="Truck Type / Container"
              placeholder="e.g. 40FT HC"
              value={draft.truckType}
              onChange={(e) =>
                setDraft({ ...draft, truckType: e.target.value })
              }
            />
            <Select
              label="Unit"
              options={["Per Trip", "Per Day"]}
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            />
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <TextField
              label="Base Price (₦)"
              required
              type="number"
              placeholder="350000"
              value={draft.basePrice}
              onChange={(e) =>
                setDraft({ ...draft, basePrice: e.target.value })
              }
            />
            <TextField
              label="Surcharge (₦)"
              type="number"
              placeholder="20000"
              value={draft.surcharge}
              onChange={(e) =>
                setDraft({ ...draft, surcharge: e.target.value })
              }
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
