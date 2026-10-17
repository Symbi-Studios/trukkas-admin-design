"use client";

import { useMemo, useRef, useState } from "react";
import { useSelector } from 'react-redux';
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
  EmptyState, Banner,
} from "../ds.js";
import { pricingError, pricingMoney as formatNaira, pricingNumber, pricingDetailUrl, downloadPricingCsv, canChangePricing, useChangeAdminPricingRecordMutation, useExportAdminPricingServicesMutation,
  useGetAdminPricingConfigQuery, useGetAdminPricingTerminalRatesQuery, useGetAdminPricingSummaryQuery,
  useGetAdminPricingServicesQuery, useGetAdminPricingPriceListsQuery, useGetAdminPricingSurchargesQuery,
  useGetAdminPricingExceptionsQuery, useGetAdminPricingHistoryQuery, useGetAdminPricingRecentHistoryQuery,
} from '../store/features/pricing/pricingApi.js';
import { PricingLoading, PricingSettingModal } from './PricingSettings.jsx';
import { PricingServiceForm } from './PricingServiceForm.jsx';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import './PricingManagement.css';

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
  const enabledItems = items.filter((item) => !item.disabled);
  return (
    <span style={{ position: "relative" }}>
      <IconButton
        icon="ellipsis-vertical"
        disabled={!enabledItems.length}
        onClick={() => setMenuFor(menuFor === id ? null : id)}
      />
      {menuFor === id && enabledItems.length > 0 && (
        <span
          style={{ position: "absolute", right: 0, top: 34, zIndex: 30 }}
          onMouseLeave={() => setMenuFor(null)}
        >
          <DropdownMenu width={200} items={enabledItems} />
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
  const [tab, setTab] = useState("Service Pricing");
  const servicesQuery = useGetAdminPricingServicesQuery();
  const summaryQuery = useGetAdminPricingSummaryQuery();
  const listsQuery = useGetAdminPricingPriceListsQuery(undefined, { skip: !['Price Lists', 'Approvals'].includes(tab) });
  const customSurchargesQuery = useGetAdminPricingSurchargesQuery(undefined, { skip: !['Surcharges & Fees', 'Approvals'].includes(tab) });
  const exceptionsQuery = useGetAdminPricingExceptionsQuery(undefined, { skip: !['Approvals', 'Price Exceptions'].includes(tab) });
  const historyQuery = useGetAdminPricingHistoryQuery(undefined, { skip: tab !== 'Price History' });
  const recentHistoryQuery = useGetAdminPricingRecentHistoryQuery();
  const services = servicesQuery.error ? [] : servicesQuery.currentData?.rows || [];
  const configQuery = useGetAdminPricingConfigQuery();
  const config = configQuery.error ? null : configQuery.currentData;
  const [setting, setSetting] = useState(null), [notice, setNotice] = useState(null), [actionError, setActionError] = useState(null);
  const admin = useSelector((state) => state.auth.admin);
  const canEditConfig = admin?.role === 'SUPER_ADMIN';
  const pricingRules = config?.rules || [];
  const summary = summaryQuery.error ? null : summaryQuery.currentData;
  const pricingSummary = { activePriceLists: summary?.activePriceLists ?? '—', totalServices: summary?.totalServices ?? '—', avgPriceChange: summary?.avgPriceChange ?? '—', priceExceptions: summary?.priceExceptions ?? '—', surchargesActive: summary?.surchargesActive ?? '—', currency: config?.currency || '—' };
  const priceApprovalSummary = { pending: summary?.pending ?? '—', approved: summary?.approved ?? '—', rejected: summary?.rejected ?? '—' };
  const priceLists = listsQuery.error ? [] : listsQuery.currentData?.rows || [];
  const exceptions = exceptionsQuery.error ? [] : exceptionsQuery.currentData?.rows || [];
  const history = historyQuery.error ? [] : historyQuery.currentData?.rows || [];
  const recentChanges = recentHistoryQuery.error ? [] : recentHistoryQuery.currentData?.rows || [];
  const pendingApprovals = [...services.filter((row) => row.statusCode === 'PENDING_APPROVAL'), ...priceLists.filter((row) => row.statusCode === 'PENDING_APPROVAL'), ...(customSurchargesQuery.error ? [] : customSurchargesQuery.currentData?.rows || []).filter((row) => row.statusCode === 'PENDING_APPROVAL'), ...exceptions.filter((row) => row.statusCode === 'PENDING')];
  const approvalsLoading = [servicesQuery, listsQuery, customSurchargesQuery, exceptionsQuery].some((query) => query.isFetching);
  const readQueries = [configQuery, summaryQuery, servicesQuery, recentHistoryQuery, ...(tab === 'Price Lists' ? [listsQuery] : tab === 'Surcharges & Fees' ? [customSurchargesQuery] : tab === 'Approvals' ? [listsQuery, customSurchargesQuery, exceptionsQuery] : tab === 'Price Exceptions' ? [exceptionsQuery] : tab === 'Price History' ? [historyQuery] : [])];
  const readError = readQueries.find((query) => query.error)?.error;

  const terminalQuery = useGetAdminPricingTerminalRatesQuery(undefined, { skip: tab !== 'Surcharges & Fees' });
  const terminalRates = terminalQuery.error ? [] : terminalQuery.currentData?.rows || [];
  const surcharges = [...(config?.fees || []), ...terminalRates, ...(customSurchargesQuery.error ? [] : customSurchargesQuery.currentData?.rows || [])];
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
  const [editServiceId, setEditServiceId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [changeRecord, { isLoading: pricingChanging }] = useChangeAdminPricingRecordMutation();
  const [exportPricingPdf] = useExportAdminPricingServicesMutation();
  const changeLock = useRef(false);
  const pdfExportLock = useRef(false);

  const serviceOptions = useMemo(
    () => ["All Services", ...new Set(services.map((s) => s.service).filter((value) => value !== '—'))],
    [services],
  );
  const truckOptions = useMemo(
    () => ["All Truck Types", ...new Set(services.map((s) => s.truckType).filter((value) => value !== '—'))],
    [services],
  );
  const routeOptions = useMemo(
    () => ["All Routes", ...new Set(services.map((s) => s.route).filter((value) => value !== '—'))],
    [services],
  );
  const locationOptions = useMemo(
    () => ["All Locations", ...new Set(services.map((s) => s.coverage).filter((value) => value !== '—'))],
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

  function unavailable(message) { setActionError({ error: message }); setMenuFor(null); setExportOpen(false); }
  async function changePricing(row, action) {
    setMenuFor(null);
    if (changeLock.current) return;
    if (!canChangePricing(row, action, admin)) { unavailable('Your role or this pricing status does not allow this action.'); return; }
    changeLock.current = true; setActionError(null);
    try {
      const saved = await changeRecord({ row, action }).unwrap();
      setNotice(action === 'duplicate' ? 'Draft pricing version created.' : action === 'submit' ? 'Pricing submitted for approval.' : action === 'deactivate' ? 'Pricing deactivated.' : 'Pricing approved and activated.');
      if (action === 'duplicate' && saved.entity === 'services') navigate(pricingDetailUrl(saved.id));
    } catch (error) { setActionError(error); }
    finally { changeLock.current = false; }
  }
  function exportServices() {
    setExportOpen(false);
    if (!servicesQuery.currentData || servicesQuery.error || servicesQuery.isFetching) { unavailable('Load the complete service pricing list before exporting.'); return; }
    downloadPricingCsv('service-pricing.csv', ['Service', 'Route', 'Coverage', 'Truck Type / Container', 'Unit', 'Base Price', 'Surcharge', 'Total Price', 'Status', 'Last Updated'], filtered.map((row) => [row.service, row.route, row.coverage, row.truckType, row.unit, row.basePrice, row.surcharge, row.totalPrice, row.status, row.updated]));
  }
  async function exportServicesAsPdf() {
    setExportOpen(false);
    if (!servicesQuery.currentData || servicesQuery.error || servicesQuery.isFetching) { unavailable('Load the complete service pricing list before exporting.'); return; }
    const ids = filtered.map((row) => row.id).filter(Boolean);
    if (!ids.length) { unavailable('There are no service pricing records to export.'); return; }
    if (pdfExportLock.current) return;
    pdfExportLock.current = true; setActionError(null);
    try { await exportPricingPdf({ ids }).unwrap(); }
    catch (error) { setActionError(error); }
    finally { pdfExportLock.current = false; }
  }

  if ([configQuery, servicesQuery, summaryQuery].some((query) => !query.currentData && query.isFetching)) return <PricingLoading />;
  return (
    <>
      <PageHeader
        crumbs={["Business & Finance", "Pricing Management"]}
        title="Pricing Management"
        description="Manage service rates, pricing rules and surcharges across Trukkas."
        actions={
          <>
            <FilterSelect label="Current settings" icon="calendar" />
            <Button variant="outline" icon="filter">
              Filters
            </Button>
            <Button icon="plus" onClick={() => { setEditServiceId(null); setAddOpen(true); }}>
              Add Pricing
            </Button>
          </>
        }
      />

      {notice && <Banner tone="success" action={<Button variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice}</Banner>}
      {(readError || actionError) && <Banner tone="danger" title="Unable to load platform pricing" action={<Button variant="outline" onClick={() => { setActionError(null); readQueries.filter((query) => query.error).forEach((query) => query.refetch()); }}>Retry</Button>}>{pricingError(actionError || readError)}</Banner>}
      {readQueries.some((query) => query.isFetching) && <DriverLoadingNotice>Refreshing pricing settings…</DriverLoadingNotice>}
      <div className="pricing-stats">
        <StatCard
          icon="list-checks"
          tint="blue"
          label="Active Price Lists"
          value={pricingSummary.activePriceLists}
          caption={pricingSummary.activePriceLists === '—' ? 'Summary unavailable' : undefined}
        />
        <StatCard
          icon="package"
          tint="purple"
          label="Total Services"
          value={pricingSummary.totalServices}
          caption={pricingSummary.totalServices === '—' ? 'Summary unavailable' : undefined}
        />
        <StatCard
          icon="trending-up"
          tint="teal"
          label="Avg. Price Change"
          value={pricingSummary.avgPriceChange}
          direction="down"
          caption={pricingSummary.avgPriceChange === '—' ? 'Summary unavailable' : undefined}
        />
        <StatCard
          icon="triangle-alert"
          tint="amber"
          label="Price Exceptions"
          value={pricingSummary.priceExceptions}
          caption={pricingSummary.priceExceptions === '—' ? 'Summary unavailable' : undefined}
        />
        <StatCard
          icon="badge-percent"
          tint="green"
          label="Surcharges Active"
          value={pricingSummary.surchargesActive}
          caption={pricingSummary.surchargesActive === '—' ? 'Summary unavailable' : undefined}
        />
        <StatCard
          icon="coins"
          tint="navy"
          label="Currency"
          value={pricingSummary.currency}
          caption="Base Currency"
        />
      </div>

      <div className="pricing-layout">
        <SectionCard title="" pad="none" style={{ paddingTop: 4 }}>
          <Tabs
            value={tab}
            onChange={(v) => {
              setTab(v);
              setMenuFor(null);
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
                    ({servicesQuery.currentData && !servicesQuery.error ? filtered.length : '—'})
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
                          { label: "Export as CSV", icon: "file-text", onClick: exportServices },
                          { label: "Export as PDF", icon: "file-text", onClick: () => void exportServicesAsPdf() },
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

              {servicesQuery.isFetching ? <DriverTableLoading columns={11} label="Loading service pricing" /> : view === "list" ? (
                <DataTable
                  rows={paged}
                  rowKey={(r) => r.id}
                  columns={[
                    {
                      key: "service",
                      header: "Service / Job Type",
                      render: (r) => (
                        <Link
                          to={pricingDetailUrl(r.id)}
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
                      render: (r) => pricingNumber(r.basePrice),
                    },
                    {
                      key: "surcharge",
                      header: "Surcharge",
                      render: (r) => (
                        <span style={{ display: "grid", gap: 2 }}>
                          <span>{pricingNumber(r.surcharge)}</span>
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
                          {pricingNumber(r.totalPrice)}
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
                                navigate(pricingDetailUrl(r.id));
                              },
                            },
                            {
                              label: "Edit Pricing",
                              icon: "pencil",
                              disabled: r.statusCode !== 'DRAFT',
                              onClick: () => { setMenuFor(null); setEditServiceId(r.id); setAddOpen(true); },
                            },
                            {
                              label: "Duplicate",
                              icon: "copy",
                              onClick: () => void changePricing(r, 'duplicate'),
                            },
                            { label: 'Submit for Approval', icon: 'send', disabled: !canChangePricing(r, 'submit', admin), onClick: () => void changePricing(r, 'submit') },
                            { divider: true },
                            {
                              label:
                                r.status === "Active"
                                  ? "Deactivate"
                                  : "Activate",
                              icon: "circle-slash",
                              tone: "danger",
                              onClick: () => {
                                void changePricing(r, r.statusCode === 'ACTIVE' ? 'deactivate' : 'activate');
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
                          to={pricingDetailUrl(r.id)}
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
                total={servicesQuery.currentData && !servicesQuery.error ? filtered.length : '—'}
                pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
                onPage={setPage}
                onPageSize={() => {}}
              />
            </>
          )}

          {tab === "Surcharges & Fees" && (
            <>
            <Banner style={{ margin: '14px var(--tk-card-pad)' }}>Global fee changes require Super Admin access. Terminal rates can be edited by admins. Flat amounts are in Naira.</Banner>
            {(terminalQuery.isFetching || customSurchargesQuery.isFetching) && <><DriverLoadingNotice>Loading terminal rates…</DriverLoadingNotice><DriverTableLoading columns={5} label="Loading terminal rates" /></>}
            {terminalQuery.error && <Banner tone="danger" title="Unable to load terminal rates" action={<Button variant="outline" onClick={terminalQuery.refetch}>Retry</Button>}>{pricingError(terminalQuery.error)}</Banner>}
            {terminalQuery.currentData?.warnings.length > 0 && <Banner tone="warning" action={<Button variant="outline" onClick={terminalQuery.refetch}>Retry</Button>}>Terminal rates could not be loaded for: {terminalQuery.currentData.warnings.join(', ')}.</Banner>}
            {!surcharges.length && !terminalQuery.isFetching && <EmptyState title="Pricing fees unavailable" description="Retry to load the current pricing settings." />}
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
                        { label: 'Edit', icon: 'pencil', disabled: !r.editable || (r.source === 'config' ? !canEditConfig || configQuery.isFetching : r.source === 'surcharge' ? customSurchargesQuery.isFetching : terminalQuery.isFetching), onClick: () => { setMenuFor(null); if (r.editable && (r.source !== 'config' || canEditConfig)) setSetting(r); } },
                      ]}
                    />
                  ),
                },
              ]}
            /></>
          )}

          {tab === "Price Lists" && (listsQuery.isFetching ? <DriverTableLoading columns={6} label="Loading price lists" /> :
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
                { key: "services", header: "Services", align: "right", render: (r) => r.services ?? '—' },
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
            <>
            {!canEditConfig && <Banner style={{ margin: '14px var(--tk-card-pad)' }}>Platform rules can be edited by Super Admins.</Banner>}
            {!pricingRules.length && !configQuery.isFetching && <EmptyState title="Pricing rules unavailable" description="Retry to load platform configuration." />}
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
                { key: 'action', header: '', width: 80, render: (r) => <Button variant="outline" size="sm" disabled={!canEditConfig || !r.editable || configQuery.isFetching} onClick={() => setSetting(r)}>Edit</Button> },
              ]}
            /></>
          )}

          {tab === "Approvals" && (approvalsLoading ? <DriverTableLoading columns={6} label="Loading pricing approvals" /> :
            <DataTable
              rows={pendingApprovals}
              rowKey={(r) => `${r.entity}:${r.id}`}
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
                        disabled={pricingChanging || !canChangePricing(r, r.entity === 'exceptions' ? 'approve' : 'activate', admin)}
                        onClick={() => void changePricing(r, r.entity === 'exceptions' ? 'approve' : 'activate')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled
                        title="The API requires a rejection reason; this screen has no reason input."
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
            !approvalsLoading && !readError && pendingApprovals.length === 0 && (
              <EmptyState
                icon="circle-check"
                title="Nothing pending"
                description="All price exceptions have been reviewed."
              />
            )}

          {tab === "Price Exceptions" && (exceptionsQuery.isFetching ? <DriverTableLoading columns={8} label="Loading price exceptions" /> :
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

          {tab === "Price History" && (historyQuery.isFetching ? <DriverTableLoading columns={6} label="Loading price history" /> :
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
                  render: (r) => pricingNumber(r.from),
                },
                {
                  key: "to",
                  header: "To (₦)",
                  align: "right",
                  render: (r) => <b>{pricingNumber(r.to)}</b>,
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
            {recentHistoryQuery.isFetching ? <DriverTableLoading columns={2} label="Loading recent price changes" /> : recentChanges.map((c) => (
              <PriceChangeRow key={c.id} c={c} />
            ))}
          </SectionCard>

          <SectionCard title="Price Approval Summary">
            <p className="tk-meta">Approval totals across all pricing types</p>
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

      {setting && <PricingSettingModal key={setting.id} row={setting} writesUnavailable={setting.source === 'config' && !canEditConfig} onClose={() => setSetting(null)} onDone={setNotice} />}
      {addOpen && <PricingServiceForm id={editServiceId} onClose={() => setAddOpen(false)} onDone={saved => { setAddOpen(false); setNotice(editServiceId ? 'Draft pricing updated.' : 'Draft pricing created.'); navigate(pricingDetailUrl(saved.id)); }} />}
    </>
  );
}
