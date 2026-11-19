"use client";
import { usePageSearchState } from '../components/PageSearch.jsx';


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
  DataTable,
  Pagination,
  Badge,
  IconButton,
  DropdownMenu,
  Icon,
  Modal,
  Textarea,
  EmptyState,
  Banner,
  StatsPanel,
} from "../ds.js";
import { pricingError, pricingMoney as formatNaira, pricingNumber, pricingDetailUrl, downloadPricingCsv, canChangePricing, useChangeAdminPricingRecordMutation, useExportAdminPricingServicesMutation,
  useGetAdminPricingTerminalRatesQuery, useGetAdminPricingSummaryQuery,
  useGetAdminPricingServicesQuery, useGetAdminPricingPriceListsQuery, useGetAdminPricingSurchargesQuery,
  useGetAdminPricingExceptionsQuery, useGetAdminPricingHistoryQuery,
} from '../store/features/pricing/pricingApi.js';
import { PricingLoading, PricingSettingModal } from './PricingSettings.jsx';
import { FilterChip } from '../components/FilterChip.jsx';
import { PricingServiceForm } from './PricingServiceForm.jsx';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import './PricingManagement.css';

// Platform-wide fees and rules live on Finance › Platform Rates; this page only
// manages what services cost. Price exceptions are reviewed and listed under Approvals.
const TABS = [
  "Service Pricing",
  "Surcharges",
  "Price Lists",
  "Approvals",
  "Price History",
];
const PAGE_SIZE = 8;


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



export function PricingManagement() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Service Pricing");
  const servicesQuery = useGetAdminPricingServicesQuery();
  const summaryQuery = useGetAdminPricingSummaryQuery();
  const listsQuery = useGetAdminPricingPriceListsQuery(undefined, { skip: !['Price Lists', 'Approvals'].includes(tab) });
  const customSurchargesQuery = useGetAdminPricingSurchargesQuery(undefined, { skip: !['Surcharges', 'Approvals'].includes(tab) });
  const exceptionsQuery = useGetAdminPricingExceptionsQuery(undefined, { skip: tab !== 'Approvals' });
  const historyQuery = useGetAdminPricingHistoryQuery(undefined, { skip: tab !== 'Price History' });
  const services = servicesQuery.error ? [] : servicesQuery.currentData?.rows || [];
  const [setting, setSetting] = useState(null), [notice, setNotice] = useState(null), [actionError, setActionError] = useState(null);
  const admin = useSelector((state) => state.auth.admin);
  const summary = summaryQuery.error ? null : summaryQuery.currentData;
  const pricingSummary = { activePriceLists: summary?.activePriceLists ?? '—', totalServices: summary?.totalServices ?? '—', avgPriceChange: summary?.avgPriceChange ?? '—', priceExceptions: summary?.priceExceptions ?? '—', surchargesActive: summary?.surchargesActive ?? '—' };
  const priceLists = listsQuery.error ? [] : listsQuery.currentData?.rows || [];
  const exceptions = exceptionsQuery.error ? [] : exceptionsQuery.currentData?.rows || [];
  const history = historyQuery.error ? [] : historyQuery.currentData?.rows || [];
  const pendingApprovals = [...services.filter((row) => row.statusCode === 'PENDING_APPROVAL'), ...priceLists.filter((row) => row.statusCode === 'PENDING_APPROVAL'), ...(customSurchargesQuery.error ? [] : customSurchargesQuery.currentData?.rows || []).filter((row) => row.statusCode === 'PENDING_APPROVAL'), ...exceptions.filter((row) => row.statusCode === 'PENDING')];
  const approvalsLoading = [servicesQuery, listsQuery, customSurchargesQuery, exceptionsQuery].some((query) => query.isFetching);
  const resolvedExceptions = exceptions.filter((row) => row.statusCode !== 'PENDING');
  const readQueries = [summaryQuery, servicesQuery, ...(tab === 'Price Lists' ? [listsQuery] : tab === 'Surcharges' ? [customSurchargesQuery] : tab === 'Approvals' ? [listsQuery, customSurchargesQuery, exceptionsQuery] : tab === 'Price History' ? [historyQuery] : [])];
  const readError = readQueries.find((query) => query.error)?.error;

  const terminalQuery = useGetAdminPricingTerminalRatesQuery(undefined, { skip: tab !== 'Surcharges' });
  const terminalRates = terminalQuery.error ? [] : terminalQuery.currentData?.rows || [];
  const surcharges = [...terminalRates, ...(customSurchargesQuery.error ? [] : customSurchargesQuery.currentData?.rows || [])];
  const [q, setQ] = usePageSearchState("", () => setPage(1), tab === 'Service Pricing');
  const [serviceType, setServiceType] = useState("All Services");
  const [jobType, setJobType] = useState("All Job Types");
  const [route, setRoute] = useState("All Routes");
  const [location, setLocation] = useState("All Locations");
  const [truckType, setTruckType] = useState("All Truck Types");
  const [page, setPage] = useState(1);
  const [view, setView] = useState("list");
  const [menuFor, setMenuFor] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editServiceId, setEditServiceId] = useState(null);
  const [rejectRow, setRejectRow] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
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
    setQ("");
    setPage(1);
  }

  function unavailable(message) { setActionError({ error: message }); setMenuFor(null); setExportOpen(false); }
  async function changePricing(row, action, reason) {
    setMenuFor(null);
    if (changeLock.current) return;
    if (!canChangePricing(row, action, admin)) { unavailable('Your role or this pricing status does not allow this action.'); return; }
    changeLock.current = true; setActionError(null);
    try {
      const saved = await changeRecord({ row, action, reason }).unwrap();
      setNotice(action === 'reject' ? 'Pricing rejected.' : action === 'duplicate' ? 'Draft pricing version created.' : action === 'submit' ? 'Pricing submitted for approval.' : action === 'deactivate' ? 'Pricing deactivated.' : 'Pricing approved and activated.');
      if (action === 'reject') { setRejectRow(null); setRejectReason(''); }
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

  if ([servicesQuery, summaryQuery].some((query) => !query.currentData && query.isFetching)) return <PricingLoading />;
  return (
    <>
      <PageHeader
        crumbs={["Finance", "Pricing"]}
        title="Pricing"
        description="Manage service rates, price lists and surcharges across Trukkas."
        actions={
          <>
            <Button icon="plus" onClick={() => { setEditServiceId(null); setAddOpen(true); }}>
              Add Pricing
            </Button>
          </>
        }
      />

      {notice && <Banner tone="success" action={<Button variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice}</Banner>}
      {(readError || actionError) && <Banner tone="danger" title="Unable to load platform pricing" action={<Button variant="outline" onClick={() => { setActionError(null); readQueries.filter((query) => query.error).forEach((query) => query.refetch()); }}>Retry</Button>}>{pricingError(actionError || readError)}</Banner>}
      {readQueries.some((query) => query.isFetching) && <DriverLoadingNotice>Refreshing pricing settings…</DriverLoadingNotice>}
      <StatsPanel fixedLabel="Current settings" fixedHint="Counts reflect the current pricing setup; Avg. Price Change compares the last 30 days with the 30 days before.">
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
      </StatsPanel>

      <div className="pricing-layout pricing-layout-full">
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
                search={<SearchField placeholder="Search by service, route, location or truck type…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
                filters={<>
                  <FilterChip name="Service" icon="tag" value={serviceType} allValue="All Services" options={serviceOptions} onChange={(v) => { setServiceType(v); setPage(1); }} />
                  <FilterChip name="Unit" icon="ruler" value={jobType} allValue="All Job Types" options={["All Job Types", "Per Trip", "Per Day"]} onChange={(v) => { setJobType(v); setPage(1); }} />
                  <FilterChip name="Route" icon="route" value={route} allValue="All Routes" options={routeOptions} onChange={(v) => { setRoute(v); setPage(1); }} />
                  <FilterChip name="Location" icon="map-pin" value={location} allValue="All Locations" options={locationOptions} onChange={(v) => { setLocation(v); setPage(1); }} />
                  <FilterChip name="Truck Type" icon="truck" value={truckType} allValue="All Truck Types" options={truckOptions} onChange={(v) => { setTruckType(v); setPage(1); }} />
                </>}
                onClear={serviceType !== "All Services" || jobType !== "All Job Types" || route !== "All Routes" || location !== "All Locations" || truckType !== "All Truck Types" || q.trim() ? resetFilters : undefined}
                viewControl={
                  <span style={{ display: "flex", border: "1px solid var(--tk-line-strong)", borderRadius: "var(--tk-r-md)", overflow: "hidden" }}>
                    <IconButton icon="list" tone={view === "list" ? "blue" : "ghost"} style={{ borderRadius: 0 }} onClick={() => setView("list")} />
                    <IconButton icon="grid-3x3" tone={view === "grid" ? "blue" : "ghost"} style={{ borderRadius: 0 }} onClick={() => setView("grid")} />
                  </span>
                }
                trailing={
                  <span style={{ position: "relative" }}>
                    <Button variant="outline" icon="download" iconRight="chevron-down" onClick={() => setExportOpen((o) => !o)}>Export</Button>
                    {exportOpen && (
                      <span style={{ position: "absolute", right: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setExportOpen(false)}>
                        <DropdownMenu width={180} items={[
                          { label: "Export as CSV", icon: "file-text", onClick: exportServices },
                          { label: "Export as PDF", icon: "file-text", onClick: () => void exportServicesAsPdf() },
                        ]} />
                      </span>
                    )}
                  </span>
                }
              />

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

          {tab === "Surcharges" && (
            <>
            <Banner style={{ margin: '14px var(--tk-card-pad)' }}>Terminal rates and draft surcharges can be edited here. Flat amounts are in Naira. Platform-wide fees such as the platform fee, commission, VAT and demurrage rates are on <Link to="/rates">Platform Rates</Link>.</Banner>
            {(terminalQuery.isFetching || customSurchargesQuery.isFetching) && <><DriverLoadingNotice>Loading terminal rates…</DriverLoadingNotice><DriverTableLoading columns={5} label="Loading terminal rates" /></>}
            {terminalQuery.error && <Banner tone="danger" title="Unable to load terminal rates" action={<Button variant="outline" onClick={terminalQuery.refetch}>Retry</Button>}>{pricingError(terminalQuery.error)}</Banner>}
            {terminalQuery.currentData?.warnings.length > 0 && <Banner tone="warning" action={<Button variant="outline" onClick={terminalQuery.refetch}>Retry</Button>}>Terminal rates could not be loaded for: {terminalQuery.currentData.warnings.join(', ')}.</Banner>}
            {!surcharges.length && !terminalQuery.isFetching && !customSurchargesQuery.isFetching && <EmptyState title="No surcharges or terminal rates" description="Retry to load the current pricing settings." />}
            <DataTable
              rows={surcharges}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "name",
                  header: "Surcharge / Terminal Rate",
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
                        { label: 'Edit', icon: 'pencil', disabled: !r.editable || (r.source === 'surcharge' ? customSurchargesQuery.isFetching : terminalQuery.isFetching), onClick: () => { setMenuFor(null); if (r.editable) setSetting(r); } },
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
                        disabled={pricingChanging || !canChangePricing(r, 'reject', admin)}
                        onClick={() => { setActionError(null); setRejectReason(''); setRejectRow(r); }}
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
                description="All pricing changes and price exceptions have been reviewed."
              />
            )}

          {tab === "Approvals" && !approvalsLoading && resolvedExceptions.length > 0 && (
            <>
            <h3 className="tk-section" style={{ margin: "20px var(--tk-card-pad) 8px" }}>Exception History</h3>
            <DataTable
              rows={resolvedExceptions}
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
            </>
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

      </div>

      <Modal open={Boolean(rejectRow)} title="Reject pricing" onClose={() => { if (!pricingChanging) setRejectRow(null); }} footer={<><Button variant="outline" disabled={pricingChanging} onClick={() => setRejectRow(null)}>Cancel</Button><Button variant="danger" disabled={pricingChanging || !rejectReason.trim()} onClick={() => void changePricing(rejectRow, 'reject', rejectReason)}>{pricingChanging ? 'Rejecting…' : 'Reject'}</Button></>}>
        {actionError && <Banner tone="danger">{pricingError(actionError)}</Banner>}
        <Textarea label="Reason for rejection" maxLength={500} disabled={pricingChanging} value={rejectReason} onChange={(event) => setRejectReason(event.target.value.slice(0, 500))} />
      </Modal>
      {setting && <PricingSettingModal key={setting.id} row={setting} onClose={() => setSetting(null)} onDone={setNotice} />}
      {addOpen && <PricingServiceForm id={editServiceId} onClose={() => setAddOpen(false)} onDone={saved => { setAddOpen(false); setNotice(editServiceId ? 'Draft pricing updated.' : 'Draft pricing created.'); navigate(pricingDetailUrl(saved.id)); }} />}
    </>
  );
}
