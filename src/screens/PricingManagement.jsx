"use client";
import { showToast } from '../components/ActionToast.jsx';
import { useMemo, useState } from "react";
import { usePageSearchState } from "../components/PageSearch.jsx";
import {
  PageHeader, Button, StatCard, SectionCard, Tabs, TableToolbar, SearchField, DataTable, Pagination, Badge, Banner, EmptyState,
  StatsPanel, SideDrawer, DrawerSection, DrawerFacts, TextField, NotAvailable, isMissing,
} from "../ds.js";
import {
  pricingError, useGetAdminPricingSummaryQuery, useGetAdminPricingServicesQuery, useGetAdminPricingPriceListsQuery,
  useGetAdminPricingSurchargesQuery, useGetAdminPricingTerminalRatesQuery, useUpdateAdminPricingSurchargeMutation,
} from "../store/features/pricing/pricingApi.js";
import { usePublishPricing } from "../store/features/pricing/usePublishPricing.js";
import { FilterChip } from "../components/FilterChip.jsx";
import { MiddleId, Money, FinanceFacts, cleanSteps } from "../components/finance/FinanceCells.jsx";
import { RateEditDialog } from "./RateEditDialog.jsx";
import { ZoneEditor } from "./ZoneEditor.jsx";
import { PortPricing } from "./PortPricing.jsx";
import { useGetAdminPricingZoneQuery } from "../store/features/pricing/zonePricingApi.js";
import { PricingServiceForm } from "./PricingServiceForm.jsx";
import { DriverTableLoading } from "./DriversLoading.jsx";
import "../components/finance/finance.css";

// Pricing is what a trip costs: rate cards for specific lanes, zone prices by destination state
// for everything else, the per-km fare and terminal handling fee at each terminal, and surcharges.
// Platform-wide fees live on Platform Rates. Saving publishes straight away (see usePublishPricing).
const TABS = ["Rate Cards", "Zone Pricing", "Per-km & Terminal Rates", "Surcharges", "Port Rates"];
// Rate cards are hidden for now (zones and per-km cover pricing); the code stays for when they return.
// Port Rates (per-port ₦/km pricing, section 07) comes first; the older tabs keep working beside it.
const VISIBLE_TABS = [TABS[4], ...TABS.slice(1, 4)];
const PORT_TAB = TABS[4];
const STATUS_TONE = { Active: "success", Draft: "neutral", "Pending Approval": "warning", Inactive: "neutral", "Active Terminal": "success", "Inactive Terminal / Port": "neutral" };
const PAGE_SIZE = 10;
const statusOptions = (rows) => ["All Statuses", ...new Set(rows.map((row) => row.status).filter((value) => !isMissing(value)))];
const matches = (row, keys, q) => !q.trim() || keys.some((key) => row[key] && String(row[key]).toLowerCase().includes(q.trim().toLowerCase()));

function Table({ rows, columns, loading, empty, onOpen, rowKey = (row) => row.id }) {
  const [page, setPage] = useState(1);
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (loading) return <DriverTableLoading columns={columns.length} label="Loading pricing" />;
  if (!rows.length) return <EmptyState icon="tag" title={empty.title} description={empty.description} />;
  return <>
    <DataTable rows={paged} rowKey={rowKey} columns={columns} onRowClick={onOpen} />
    <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} pageCount={Math.max(1, Math.ceil(rows.length / PAGE_SIZE))} onPage={setPage} onPageSize={() => {}} />
  </>;
}

function ZoneDetail({ id, row }) {
  const query = useGetAdminPricingZoneQuery(id);
  const zone = query.error ? null : query.currentData;
  return <>
    <DrawerSection title="Zone">
      <FinanceFacts items={[{ label: "Region", value: row.region }, { label: "From port", value: row.route === "—" ? "Any port" : row.route }, { label: "From state", value: zone?.originState || "Any state" }, { label: "Last updated", value: row.lastUpdated }]} />
      <p className="fin-note">Zone prices apply to any truck no rate card covers, priced by destination state.</p>
    </DrawerSection>
    <DrawerSection title="State rates">
      {query.isFetching && !zone ? <DriverTableLoading columns={3} label="Loading rates" /> : zone?.rates.length ? <ul className="fin-breakdown">
        {zone.rates.map((rate) => <li key={rate.id}>
          <span><strong>{rate.destinationState}</strong><small>{[rate.cargoType === "BULK_BREAK" ? "Bulk" : rate.cargoType === "CONTAINER" ? "Container" : "Any cargo", rate.containerSize || rate.truckType, rate.minimumCharge != null ? `min ₦${rate.minimumCharge.toLocaleString("en-NG")}` : null].filter(Boolean).join(" · ")}</small></span>
          <span className="fin-date" style={{ justifyItems: "end" }}><Money value={rate.price} /><small>{rate.unitLabel}</small></span>
        </li>)}
      </ul> : <p className="fin-note">No state rates yet.</p>}
    </DrawerSection>
  </>;
}

function TerminalDrawer({ terminal, onClose, onEdit }) {
  const km = terminal.rows.baseFeePerKm, handling = terminal.rows.handlingFee;
  return <SideDrawer label="Terminal rates" eyebrow="Per-km & terminal rates" title={terminal.name} onClose={onClose} width={480}
    meta={terminal.status && terminal.status !== "—" && <Badge tone={STATUS_TONE[terminal.status] || "neutral"} dot>{terminal.status.replace(" Terminal", "").replace(" / Port", "")}</Badge>}>
    <DrawerSection title="Rates">
      <ul className="fin-breakdown">
        {[[km, "Fare per km", "Distance × this rate when no rate card or zone covers a trip from here"], [handling, "Terminal handling fee", "Flat fee collected for the terminal on each job from here"]].map(([rate, title, hint]) => rate && <li key={rate.id}>
          <span><strong>{title}</strong><small>{hint}</small></span>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Money value={rate.value} /><Button size="sm" variant="outline" icon="pencil" disabled={!rate.editable} onClick={() => onEdit(rate)}>Edit</Button></span>
        </li>)}
      </ul>
      <FinanceFacts items={[{ label: "Fare per km since", value: km?.effectiveFrom }, { label: "Handling fee since", value: handling?.effectiveFrom }]} />
    </DrawerSection>
  </SideDrawer>;
}

function RecordDrawer({ row, kind, onClose, onEdit, notify }) {
  const publisher = usePublishPricing();
  const [updateSurcharge, surchargeState] = useUpdateAdminPricingSurchargeMutation();
  const [value, setValue] = useState(row.value == null ? "" : String(row.value));
  const [error, setError] = useState(null);
  const busy = publisher.busy || surchargeState.isLoading;
  async function act(task, message) {
    setError(null);
    try { await task(); notify(message); onClose(); }
    catch (failure) { setError(pricingError(failure)); }
  }
  const saveSurcharge = () => act(async () => {
    const draft = await publisher.draftFor(row);
    const next = Number(value);
    if (next !== draft.value) await updateSurcharge({ id: draft.id, status: draft.statusCode, calc: draft.calc, value: next, expectedValue: draft.value }).unwrap();
    await publisher.publish({ ...draft, value: next });
  }, publisher.canActivate ? `${row.name} updated.` : `${row.name} submitted for activation.`);
  const unpublished = ["DRAFT", "PENDING_APPROVAL"].includes(row.statusCode);
  const footer = <div className="fin-actions">
    {row.statusCode === "ACTIVE" && <Button variant="danger" disabled={busy || !publisher.canActivate} style={{ marginRight: "auto" }} onClick={() => act(() => publisher.deactivate(row), `${row.name || row.service} taken out of use.`)}>Deactivate</Button>}
    {unpublished && <Button variant="outline" disabled={busy || (row.statusCode === "PENDING_APPROVAL" && !publisher.canActivate)} onClick={() => act(() => publisher.publish(row), "Published.")}>Publish</Button>}
    {kind === "service" && <Button icon="pencil" disabled={busy} onClick={() => onEdit(row)}>Edit rate</Button>}
    {kind === "zone" && <Button icon="pencil" disabled={busy} onClick={() => onEdit(row)}>Edit zone</Button>}
    {kind === "surcharge" && <Button disabled={busy || value.trim() === "" || !(Number(value) >= 0)} onClick={saveSurcharge}>{busy ? "Saving…" : publisher.canActivate ? "Save & publish" : "Save & submit"}</Button>}
  </div>;
  return <SideDrawer label="Pricing details" eyebrow={kind === "service" ? "Rate card" : kind === "zone" ? "Zone pricing" : "Surcharge"} onClose={onClose} footer={footer} width={520}
    title={row.service || row.name}
    meta={<><Badge tone={STATUS_TONE[row.status] || "neutral"} dot>{row.status}</Badge>{row.code && <MiddleId value={row.code} label="code" />}</>}>
    {error && <Banner tone="danger" title={error} />}
    {unpublished && <Banner inline tone="warning" title={row.statusCode === "DRAFT" ? "This rate isn't live yet" : "Waiting for activation"}>{row.statusCode === "DRAFT" ? "Publish it to start using it." : "A Super Admin or Finance Admin can publish it."}</Banner>}
    {kind === "service" && <>
      <DrawerSection title="Price">
        <div className="fin-hero"><span>Total {String(row.unit || "").toLowerCase()}</span><strong>{row.totalPrice != null ? `₦${row.totalPrice.toLocaleString("en-NG", { minimumFractionDigits: 2 })}` : "Not available"}</strong></div>
        <ul className="fin-breakdown">
          <li><span><strong>Base rate</strong><small>{row.unit}</small></span><Money value={row.basePrice} /></li>
          <li className="sub"><span><strong>Surcharges</strong><small>{row.surchargePct !== "—" ? row.surchargePct : "Active surcharges that apply"}</small></span><Money value={row.surcharge} strong={false} /></li>
          <li className="total"><span><strong>Total</strong></span><Money value={row.totalPrice} /></li>
        </ul>
      </DrawerSection>
      <DrawerSection title="Applies to">
        <FinanceFacts items={[{ label: "Route", value: row.route, wide: true }, { label: "Coverage", value: row.coverage }, { label: "Equipment", value: row.truckType }, { label: "Last updated", value: row.updated, sub: row.updatedTime }]} />
      </DrawerSection>
    </>}
    {kind === "zone" && <ZoneDetail id={row.id} row={row} />}
    {kind === "surcharge" && <DrawerSection title="Surcharge">
      <FinanceFacts items={[{ label: "Applies to", value: row.appliesTo, wide: true }, { label: "Current rate", value: row.rate }, { label: "Effective from", value: row.effectiveFrom }]} />
      <TextField label={`New rate (${row.unit})`} type="number" min={0} step="any" money={String(row.unit).startsWith("NGN")} value={value} disabled={busy} onChange={(event) => setValue(event.target.value)} />
      <p className="fin-note">Saving replaces the live surcharge from now on.</p>
    </DrawerSection>}
  </SideDrawer>;
}

export function PricingManagement() {
  const [tab, setTab] = useState(VISIBLE_TABS[0]);
  const [q, setQ] = usePageSearchState("");
  const [status, setStatus] = useState("All Statuses");
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null);
  const [terminal, setTerminal] = useState(null);
  const [terminalRow, setTerminalRow] = useState(null);
  const [zoneForm, setZoneForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const summaryQuery = useGetAdminPricingSummaryQuery();
  const servicesQuery = useGetAdminPricingServicesQuery(undefined, { skip: tab !== TABS[0] });
  const zonesQuery = useGetAdminPricingPriceListsQuery(undefined, { skip: tab !== TABS[1] });
  const terminalQuery = useGetAdminPricingTerminalRatesQuery(undefined, { skip: tab !== TABS[2] });
  const surchargesQuery = useGetAdminPricingSurchargesQuery(undefined, { skip: tab !== TABS[3] });
  const summary = summaryQuery.error ? null : summaryQuery.currentData;
  const pick = (query) => (query.error ? [] : query.currentData?.rows || []);
  const terminalRows = pick(terminalQuery);
  const terminals = useMemo(() => {
    const byTerminal = new Map();
    for (const row of terminalRows) {
      const entry = byTerminal.get(row.terminalId) || { id: row.terminalId, name: row.description, status: row.status, rows: {} };
      entry.rows[row.key] = row; byTerminal.set(row.terminalId, entry);
    }
    return [...byTerminal.values()];
  }, [terminalRows]);

  const current = { [TABS[0]]: pick(servicesQuery), [TABS[1]]: pick(zonesQuery), [TABS[2]]: terminals, [TABS[3]]: pick(surchargesQuery) }[tab] || [];
  const query = { [TABS[0]]: servicesQuery, [TABS[1]]: zonesQuery, [TABS[2]]: terminalQuery, [TABS[3]]: surchargesQuery }[tab] || {};
  const keys = { [TABS[0]]: ["service", "code", "route", "coverage", "truckType"], [TABS[1]]: ["name", "region", "route"], [TABS[2]]: ["name"], [TABS[3]]: ["name", "appliesTo", "description"] }[tab] || [];
  const rows = current.filter((row) => (status === "All Statuses" || row.status === status) && matches(row, keys, q));
  const notify = (text) => showToast(text);
  const switchTab = (next) => { setTab(next); setStatus("All Statuses"); setQ(""); setOpen(null); };

  const columns = {
    [TABS[0]]: [
      { key: "service", header: "Rate Card", render: (r) => <span className="fin-date"><span>{r.service}</span><small>{r.code || "Draft"}</small></span> },
      { key: "route", header: "Route", render: (r) => isMissing(r.route) ? <NotAvailable label="Any route" /> : <span className="fin-date" style={{ whiteSpace: "normal", maxWidth: 240 }}><span>{r.route}</span>{!isMissing(r.coverage) && <small>{r.coverage}</small>}</span> },
      { key: "equipment", header: "Equipment", render: (r) => isMissing(r.truckType) ? <NotAvailable label="Any equipment" /> : r.truckType },
      { key: "unit", header: "Unit", render: (r) => <Badge tone="neutral">{r.unit}</Badge> },
      { key: "base", header: "Base Rate", align: "right", render: (r) => <Money value={r.basePrice} /> },
      { key: "total", header: "With Surcharges", align: "right", render: (r) => <Money value={r.totalPrice} /> },
      { key: "status", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status] || "neutral"} dot>{r.status}</Badge> },
    ],
    [TABS[1]]: [
      { key: "name", header: "Zone", render: (r) => <span className="fin-date"><span>{r.name}</span><small>{r.region}</small></span> },
      { key: "route", header: "Origin Port", render: (r) => isMissing(r.route) ? <NotAvailable label="Any port" /> : r.route },
      { key: "rates", header: "State Rates", align: "right", render: (r) => r.services == null ? <NotAvailable /> : <span className="tk-cell-strong">{r.services}</span> },
      { key: "updated", header: "Last Updated", render: (r) => isMissing(r.lastUpdated) ? <NotAvailable /> : r.lastUpdated },
      { key: "status", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status] || "neutral"} dot>{r.status}</Badge> },
    ],
    [TABS[2]]: [
      { key: "name", header: "Port / Terminal", render: (r) => <span className="tk-cell-strong">{r.name}</span> },
      { key: "km", header: "Fare per km", align: "right", render: (r) => <Money value={r.rows.baseFeePerKm?.value} /> },
      { key: "handling", header: "Handling Fee", align: "right", render: (r) => <Money value={r.rows.handlingFee?.value} /> },
      { key: "status", header: "Status", render: (r) => isMissing(r.status) ? <NotAvailable /> : <Badge tone={STATUS_TONE[r.status] || "neutral"} dot>{r.status.replace(" Terminal", "").replace(" / Port", "")}</Badge> },
      { key: "edit", header: "", width: 80, render: (r) => <Button size="sm" variant="outline" icon="pencil" onClick={(event) => { event.stopPropagation(); setTerminalRow(r); }}>Edit</Button> },
    ],
    [TABS[3]]: [
      { key: "name", header: "Surcharge", render: (r) => <span className="fin-date"><span>{r.name}</span><small>{r.description}</small></span> },
      { key: "applies", header: "Applies To", render: (r) => isMissing(r.appliesTo) ? <NotAvailable label="All jobs" /> : <span style={{ whiteSpace: "normal" }}>{r.appliesTo}</span> },
      { key: "rate", header: "Rate", align: "right", render: (r) => isMissing(r.rate) ? <NotAvailable /> : <span className="fin-money strong">{r.rate}</span> },
      { key: "effective", header: "Effective From", render: (r) => isMissing(r.effectiveFrom) ? <NotAvailable /> : r.effectiveFrom },
      { key: "status", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status] || "neutral"} dot>{r.status}</Badge> },
    ],
  }[tab];
  const kind = { [TABS[0]]: "service", [TABS[1]]: "zone", [TABS[3]]: "surcharge" }[tab];
  const openRow = kind ? (row) => setOpen({ row, kind }) : (row) => setTerminalRow(row);

  return (
    <>
      <PageHeader crumbs={["Finance", "Pricing"]} title="Pricing"
        description="What a trip costs: per-port rates, zone prices by destination state, per-km fares and terminal fees, and surcharges. Platform fees are on Platform Rates."
        actions={<Button icon="plus" onClick={() => setZoneForm({ id: null })}>New zone</Button>} />
      {notice && <Banner tone="success" title={notice} />}
      <StatsPanel fixedLabel="Current setup" fixedHint="Counts reflect the pricing in use now; average change compares the last 30 days with the 30 before.">
        <StatCard icon="map" tint="purple" label="Active Zones" value={summary?.activePriceLists ?? "—"} caption="state price lists" />
        <StatCard icon="badge-percent" tint="green" label="Active Surcharges" value={summary?.surchargesActive ?? "—"} caption="added on top of fares" />
        <StatCard icon="trending-up" tint="teal" label="Avg. Price Change" value={summary?.avgPriceChange ?? "—"} caption="last 30 days" />
      </StatsPanel>
      <SectionCard title="" pad="none" className="fin-table" style={{ paddingTop: 4 }}>
        <Tabs value={tab} onChange={switchTab} style={{ padding: "0 var(--tk-card-pad)" }} items={VISIBLE_TABS} />
        {tab === PORT_TAB ? <PortPricing notify={notify} /> : <>
        <TableToolbar
          search={<SearchField placeholder={`Search ${tab.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />}
          filters={<FilterChip name="Status" icon="circle-dot" value={status} allValue="All Statuses" options={statusOptions(current)} onChange={setStatus} />}
          onClear={status !== "All Statuses" || q.trim() ? () => { setStatus("All Statuses"); setQ(""); } : undefined}
        />
        {query.error && <Banner tone="danger" title="Unable to load pricing" action={<Button variant="outline" size="sm" onClick={query.refetch}>Retry</Button>} style={{ margin: "0 var(--tk-card-pad) 12px" }}>{pricingError(query.error)}</Banner>}
        {tab === TABS[2] && <p className="fin-note" style={{ padding: "0 var(--tk-card-pad) 10px" }}>The fare per km is used when no rate card or zone covers a trip. Changes apply to new quotes straight away.</p>}
        <Table key={tab} rows={rows} columns={columns} loading={query.isFetching && !query.currentData}
          empty={{ title: `No ${tab.toLowerCase()} found`, description: q.trim() || status !== "All Statuses" ? "Try adjusting your filters or search." : tab === TABS[0] ? "Create a rate card to price a specific lane." : "Nothing is set up here yet." }}
          onOpen={openRow} />
        </>}
      </SectionCard>
      {open && <RecordDrawer key={open.row.id} row={open.row} kind={open.kind} onClose={() => setOpen(null)} notify={notify} onEdit={(row) => { setOpen(null); if (open.kind === "zone") setZoneForm({ id: row.id }); else setForm({ id: row.id }); }} />}
      {zoneForm && <ZoneEditor id={zoneForm.id} onClose={() => setZoneForm(null)} onDone={(saved) => { setZoneForm(null); notify(saved?.statusCode === "ACTIVE" ? "Zone is live." : "Zone saved and waiting for activation."); }} />}
      {terminalRow && <TerminalDrawer terminal={terminals.find((t) => t.id === terminalRow.id) || terminalRow} onClose={() => setTerminalRow(null)} onEdit={setTerminal} />}
      {form && <PricingServiceForm id={form.id} onClose={() => setForm(null)} onDone={(saved) => { setForm(null); notify(saved?.statusCode === "ACTIVE" ? "Rate card is live." : "Rate card saved and waiting for activation."); }} />}
      {terminal && <RateEditDialog key={terminal.id} row={terminal} onClose={() => setTerminal(null)} onDone={notify} />}
    </>
  );
}
