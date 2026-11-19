"use client";
import { usePageSearchState } from '../components/PageSearch.jsx';


import { useMemo, useState } from "react";
import { Link, useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  Tabs,
  TableToolbar,
  SearchField,
  DataTable,
  Pagination,
  Badge,
  Banner,
  IconButton,
  DropdownMenu,
  Icon,
  Skeleton,
  StatsPanel,
} from "../ds.js";
import { DEFAULT_STATS_PERIOD, STATS_PERIODS, statsPeriod, statsPeriodRange } from '../domain/statsPeriod.js';
import {
  useGetAdminFeeSummaryQuery, useGetAdminFeeRulesQuery, emptyFeeSummary,
  unavailableFeeCatalog, unavailableFeeDistribution, editableFeeRule, feeDetailUrl,
  feeMoney as formatNaira, feeCategories,
} from '../store/features/fees/feesApi.js';

import { DriverTableLoading } from './DriversLoading.jsx';
import { useFeeOperations } from '../store/features/fees/useFeeOperations.js';
import { FeeRuleEditDialog, FeeRulesBulkDialog } from './FeeRuleDialogs.jsx';
import { FeeRecordsTab, FeeAnalyticsTab, FeeAuditTab } from './FeeTabs.jsx';
import { initialTab } from '../domain/urlState.js';
import { FilterChip } from '../components/FilterChip.jsx';

// Platform-wide rates (platform fee, commission %, VAT) are edited on Platform Rates;
// late-delivery deductions are shown under Demurrage › Driver Delays.
const TABS = [
  "Fee Rules",
  "Fee Collections",
  "Analytics",
  "Audit Log",
];
const STATUSES = ["Active", "Inactive", "Draft"];
const JOB_TYPES = ["All", "FCL, LCL", "Breakbulk", "Export", "Per Container"];
const CARGO_TYPES = ["All", "Containers", "Breakbulk"];
const PAGE_SIZE = 8;

function iconTile(icon, tint) {
  const TINT = {
    blue: ["var(--tk-blue-soft)", "var(--tk-blue)"],
    green: ["var(--tk-success-soft)", "var(--tk-success)"],
    amber: ["var(--tk-warning-soft)", "var(--tk-warning)"],
    red: ["var(--tk-danger-soft)", "var(--tk-danger)"],
    purple: ["var(--tk-purple-soft)", "var(--tk-purple)"],
    teal: ["var(--tk-teal-soft)", "var(--tk-teal)"],
  };
  const [bg, fg] = TINT[tint] || TINT.blue;
  return (
    <span
      style={{
        width: 34,
        height: 34,
        borderRadius: "var(--tk-r-sm)",
        background: bg,
        color: fg,
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
      }}
    >
      <Icon name={icon} size={17} />
    </span>
  );
}


export function FeesCommission() {
  const navigate = useNavigate();
  const operations = useFeeOperations();
  const [summaryPeriod, setSummaryPeriod] = useState('month');
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsRange = useMemo(() => statsPeriodRange(statsPeriodKey), [statsPeriodKey]);
  const summaryQuery = useGetAdminFeeSummaryQuery({ owner: operations.owner, period: 'month', ...statsRange }, { skip: !operations.authenticated });
  const catalogQuery = useGetAdminFeeRulesQuery({ owner: operations.owner }, { skip: !operations.authenticated });
  const catalog = operations.authenticated && !catalogQuery.error ? catalogQuery.currentData || unavailableFeeCatalog : unavailableFeeCatalog;
  const rules = catalog.rules || [];
  const feeSummary = operations.authenticated && !summaryQuery.error ? summaryQuery.currentData?.summary || emptyFeeSummary : emptyFeeSummary;
  const revenueLoading = summaryQuery.isLoading || (summaryQuery.isFetching && !summaryQuery.currentData);
  const metric = (value) => summaryQuery.isLoading ? <Skeleton as="span" width={96} height={23} /> : value;
  const [editRule, setEditRule] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  function openBulk() {
    setMenuFor(null);
    if (!operations.canManage) { window.alert('Fee changes require Super Admin or Finance Admin access.'); return; }
    if (catalogQuery.error || !catalog.rules || catalogQuery.isFetching || operations.busy) { window.alert('Fee rules must load before they can be edited.'); return; }
    setBulkOpen(true);
  }
  const [tab, setTab] = useState(() => initialTab(TABS, "Fee Rules"));
  const [q, setQ] = usePageSearchState("", () => setPage(1), tab === 'Fee Rules');
  const [status, setStatus] = useState("All Status");
  const [jobType, setJobType] = useState("All Job Types");
  const [cargoType, setCargoType] = useState("All Cargo Types");
  const [location, setLocation] = useState('All Locations');
  const [category, setCategory] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [menuFor, setMenuFor] = useState(null);
  const locationOptions = useMemo(() => ['All Locations', ...new Set(rules.map((rule) => rule.location).filter((value) => value && value !== 'ALL' && value !== '—'))], [rules]);

  const filtered = useMemo(
    () =>
      rules.filter(
        (r) =>
          (status === "All Status" || r.status === status) &&
          (jobType === "All Job Types" || r.jobType === "All" || r.jobType === jobType) &&
          (cargoType === "All Cargo Types" || r.cargoType === "All" || r.cargoType === cargoType) &&
          (location === 'All Locations' || r.location === 'ALL' || r.location === location) &&
          (!category || r.category === category) &&
          (!q ||
            [r.name, r.sub, r.appliesTo].some(
              (v) => v && v.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [rules, status, jobType, cargoType, location, category, q],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const exportRules = (format) => {
    setMenuFor(null);
    void operations.download('rules', format, null, { search: q, status: status === 'All Status' ? undefined : status.toUpperCase(), jobType: jobType === 'All Job Types' ? undefined : jobType, cargoType: cargoType === 'All Cargo Types' ? undefined : cargoType, location: location === 'All Locations' ? undefined : location, category });
  };

  return (
    <>
      <PageHeader
        crumbs={["Finance", "Fees & Commission"]}
        title="Fees & Commission"
        description="Fee rules, what they collect, and every change made to them."
        actions={
          <>
            <span style={{ position: "relative" }}>
              <Button
                variant="outline"
                icon="download"
                iconRight="chevron-down"
                onClick={() =>
                  setMenuFor(menuFor === "export" ? null : "export")
                }
              >
                Export
              </Button>
              {menuFor === "export" && (
                <span
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 44,
                    zIndex: 30,
                  }}
                  onMouseLeave={() => setMenuFor(null)}
                >
                  <DropdownMenu
                    width={200}
                    items={[
                      { label: "Export as CSV", icon: "file-text", onClick: () => exportRules("csv") },
                      { label: "Export as PDF", icon: "file-text", onClick: () => exportRules("pdf") },
                    ]}
                  />
                </span>
              )}
            </span>
            <span style={{ position: "relative" }}>
              <Button
                variant="secondary"
                iconRight="ellipsis-vertical"
                onClick={() => setMenuFor(menuFor === "more" ? null : "more")}
              >
                More Actions
              </Button>
              {menuFor === "more" && (
                <span
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 44,
                    zIndex: 30,
                  }}
                  onMouseLeave={() => setMenuFor(null)}
                >
                  <DropdownMenu
                    width={220}
                    items={[
                      { label: "Bulk Update Fees", icon: "list-checks", onClick: openBulk },
                      { divider: true },
                      { label: "Export Fee Report", icon: "file-text", onClick: () => { setMenuFor(null); void operations.download("report", 'csv', null, { period: summaryPeriod }); } },
                    ]}
                  />
                </span>
              )}
            </span>
          </>
        }
      />

      <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey} periods={STATS_PERIODS.filter((p) => p.key !== "all")}>
        <StatCard
          icon="wallet"
          tint="green"
          label="Total Revenue"
          value={revenueLoading ? <Skeleton as="span" width={96} height={23} /> : formatNaira(feeSummary.totalRevenue)}
          delta={feeSummary.totalRevenueDelta}
          caption={statsPeriod(statsPeriodKey).vs}
        />
        <StatCard
          icon="scan-line"
          tint="purple"
          label="Total Platform Fees"
          value={metric(formatNaira(feeSummary.totalPlatformFees))}
          delta={feeSummary.totalPlatformFeesDelta}
          caption={statsPeriod(statsPeriodKey).vs}
        />
        <StatCard
          icon="handshake"
          tint="amber"
          label="Total Commissions"
          value={metric(formatNaira(feeSummary.totalCommissions))}
          delta={feeSummary.totalCommissionsDelta}
          caption={statsPeriod(statsPeriodKey).vs}
        />
        <StatCard
          icon="file-minus"
          tint="red"
          label="Total Deductions"
          value={metric(formatNaira(feeSummary.totalDeductions))}
          delta={feeSummary.totalDeductionsDelta}
          direction="down"
          caption={statsPeriod(statsPeriodKey).vs}
        />
        <StatCard
          icon="chart-pie"
          tint="blue"
          label="Avg. Effective Rate"
          value={metric(feeSummary.avgEffectiveRate)}
          delta={feeSummary.avgEffectiveRateDelta}
          caption={statsPeriod(statsPeriodKey).vs}
        />
      </StatsPanel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: "var(--tk-grid-gap)",
          alignItems: "start",
        }}
      >
        <SectionCard title="" pad="none" style={{ paddingTop: 4 }}>
          <Tabs
            value={tab}
            onChange={setTab}
            style={{ padding: "0 var(--tk-card-pad)" }}
            items={TABS}
          />

          {tab === "Fee Rules" ? (
            <>
              <TableToolbar
                search={<SearchField placeholder="Search by rule name or what it applies to…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
                filters={<>
                  <FilterChip name="Category" icon="layers" value={category ?? ""} allValue="" options={[{ value: "", label: "All Categories" }, ...feeCategories.filter((option) => option.value).map((option) => ({ value: option.value, label: option.label }))]} onChange={(v) => { setCategory(v || null); setPage(1); }} />
                  <FilterChip name="Status" icon="circle-dot" value={status} allValue="All Status" options={["All Status", ...STATUSES]} onChange={(v) => { setStatus(v); setPage(1); }} />
                  <FilterChip name="Job Type" icon="route" value={jobType} allValue="All Job Types" options={["All Job Types", ...JOB_TYPES]} onChange={(v) => { setJobType(v); setPage(1); }} />
                  <FilterChip name="Location" icon="map-pin" value={location} allValue="All Locations" options={locationOptions} onChange={(v) => { setLocation(v); setPage(1); }} />
                  <FilterChip name="Cargo" icon="package" value={cargoType} allValue="All Cargo Types" options={["All Cargo Types", ...CARGO_TYPES]} onChange={(v) => { setCargoType(v); setPage(1); }} />
                </>}
                onClear={category || status !== "All Status" || jobType !== "All Job Types" || location !== "All Locations" || cargoType !== "All Cargo Types" || q.trim()
                  ? () => { setCategory(null); setStatus("All Status"); setJobType("All Job Types"); setLocation("All Locations"); setCargoType("All Cargo Types"); setQ(""); setPage(1); }
                  : undefined}
              />

              {catalogQuery.isLoading ? <DriverTableLoading columns={9} label="Loading fee rules" /> : <DataTable
                rows={paged}
                rowKey={(r) => r.id}
                columns={[
                  {
                    key: "name",
                    header: "Rule Name",
                    render: (r) => (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        {iconTile(r.icon, r.iconTint)}
                        <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                          <Link
                            to={feeDetailUrl(r)}
                            style={{
                              font: "600 13px/18px var(--tk-font-sans)",
                              color: "var(--tk-ink-900)",
                            }}
                          >
                            {r.name}
                          </Link>
                          <span className="tk-meta">{r.sub}</span>
                        </span>
                      </span>
                    ),
                  },
                  { key: "appliesTo", header: "Applies To" },
                  { key: "jobType", header: "Job Type" },
                  { key: "cargoType", header: "Cargo Type" },
                  {
                    key: "rate",
                    header: "Rate / Amount",
                    render: (r) => (
                      <span
                        style={{
                          font: "600 13px/18px var(--tk-font-sans)",
                          color: "var(--tk-ink-900)",
                        }}
                      >
                        {r.rate}
                      </span>
                    ),
                  },
                  { key: "calcType", header: "Calculation Type" },
                  {
                    key: "status",
                    header: "Status",
                    render: (r) => <Badge>{r.status}</Badge>,
                  },
                  { key: "effectiveFrom", header: "Effective From" },
                  {
                    key: "x",
                    header: "Actions",
                    width: 60,
                    render: (r) => (
                      <span style={{ position: "relative" }}>
                        <IconButton
                          icon="ellipsis-vertical"
                          onClick={() =>
                            setMenuFor(menuFor === r.id ? null : r.id)
                          }
                        />
                        {menuFor === r.id && (
                          <span
                            style={{
                              position: "absolute",
                              right: 0,
                              top: 34,
                              zIndex: 30,
                            }}
                            onMouseLeave={() => setMenuFor(null)}
                          >
                            <DropdownMenu
                              width={190}
                              items={[
                                {
                                  label: "View Rule",
                                  icon: "eye",
                                  onClick: () => {
                                    setMenuFor(null);
                                    navigate(feeDetailUrl(r));
                                  },
                                },
                                { label: "Edit Rule", icon: "pencil", disabled: catalogQuery.isFetching || operations.busy || !operations.canManage || !editableFeeRule(r), onClick: () => { setMenuFor(null); setEditRule(r); } },
                                { divider: true },
                                {
                                  label:
                                    r.status === "Active"
                                      ? "Deactivate Rule"
                                      : "Activate Rule",
                                  icon: "circle-slash",
                                  tone: "danger",
                                  disabled: catalogQuery.isFetching || operations.busy || !operations.canManage || !editableFeeRule(r),
                                  onClick: () => { setMenuFor(null); void operations.toggle(r); },
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
                page={currentPage}
                pageSize={pageSize}
                total={catalog.rules ? filtered.length : undefined}
                pageCount={pageCount}
                onPage={(next) => setPage(Math.min(Math.max(1, next), Math.max(1, Math.ceil(filtered.length / pageSize))))}
                onPageSize={(size) => { if (Number.isSafeInteger(size) && size > 0) { setPageSize(size); setPage(1); } }}
              />
            </>
          ) : tab === 'Fee Collections' ? (
            <FeeRecordsTab key={tab + ':' + operations.owner} kind="transactions" rules={rules} />
          ) : tab === 'Analytics' ? (
            <FeeAnalyticsTab period={summaryPeriod} onPeriod={setSummaryPeriod} />
          ) : tab === 'Audit Log' ? (
            <FeeAuditTab key={operations.owner} />
          ) : null}
        </SectionCard>

      </div>

      {editRule && <FeeRuleEditDialog key={editRule.id} rule={editRule} canManage={operations.canManage} onClose={() => setEditRule(null)} />}
      {bulkOpen && <FeeRulesBulkDialog rules={rules} canManage={operations.canManage} onClose={() => setBulkOpen(false)} />}

      <Banner tone="info" title="About Fees & Commission">
        Fee rules decide which fees apply to which jobs, cargo and locations. The platform-wide
        values they use, such as the platform fee, commission and VAT, are set on <Link to="/rates">Platform Rates</Link>.
      </Banner>
    </>
  );
}
