"use client";
import { usePageSearchState } from '../components/PageSearch.jsx';


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
  DonutChart,
  LegendList,
  LabelValue,
  QuickActionsCard,
  Banner,
  IconButton,
  DropdownMenu,
  Icon,
  EmptyState,
  Skeleton,
} from "../ds.js";
import {
  useGetAdminFeeSummaryQuery, useGetAdminFeeRulesQuery, emptyFeeSummary,
  unavailableFeeCatalog, unavailableFeeDistribution, editableFeeRule, feeDetailUrl,
  feeMoney as formatNaira, feeMillions, feePeriods, feeCategories,
} from '../store/features/fees/feesApi.js';

import { DriverTableLoading } from './DriversLoading.jsx';
import { useFeeOperations } from '../store/features/fees/useFeeOperations.js';
import { FeeRuleEditDialog, FeeRulesBulkDialog } from './FeeRuleDialogs.jsx';
import { FeeRecordsTab, FeeAnalyticsTab, FeeAuditTab } from './FeeTabs.jsx';

const TABS = [
  "Fee Rules",
  "Commission Rules",
  "Deductions",
  "Fee Schemes",
  "Transactions",
  "Payouts",
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
            width={190}
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

export function FeesCommission() {
  const navigate = useNavigate();
  const operations = useFeeOperations();
  const [summaryPeriod, setSummaryPeriod] = useState('month');
  const summaryQuery = useGetAdminFeeSummaryQuery({ owner: operations.owner, period: 'month' }, { skip: !operations.authenticated });
  const periodSummaryQuery = useGetAdminFeeSummaryQuery({ owner: operations.owner, period: summaryPeriod }, { skip: !operations.authenticated });
  const catalogQuery = useGetAdminFeeRulesQuery({ owner: operations.owner }, { skip: !operations.authenticated });
  const catalog = operations.authenticated && !catalogQuery.error ? catalogQuery.currentData || unavailableFeeCatalog : unavailableFeeCatalog;
  const rules = catalog.rules || [];
  const feeSummary = operations.authenticated && !summaryQuery.error ? summaryQuery.currentData?.summary || emptyFeeSummary : emptyFeeSummary;
  const periodSummary = operations.authenticated && !periodSummaryQuery.error ? periodSummaryQuery.currentData?.summary || emptyFeeSummary : emptyFeeSummary;
  const feeDistribution = operations.authenticated && !periodSummaryQuery.error ? periodSummaryQuery.currentData?.distribution || unavailableFeeDistribution : unavailableFeeDistribution;
  const revenueLoading = summaryQuery.isLoading || (summaryQuery.isFetching && !summaryQuery.currentData);
  const metric = (value) => summaryQuery.isLoading ? <Skeleton as="span" width={96} height={23} /> : value;
  const periodMetric = (value) => periodSummaryQuery.isFetching && !periodSummaryQuery.currentData ? <Skeleton as="span" width={96} height={16} /> : value;
  const [editRule, setEditRule] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  function openBulk() {
    setMenuFor(null);
    if (!operations.canManage) { window.alert('Fee changes require Super Admin or Finance Admin access.'); return; }
    if (catalogQuery.error || !catalog.rules || catalogQuery.isFetching || operations.busy) { window.alert('Fee rules must load before they can be edited.'); return; }
    setBulkOpen(true);
  }
  const [tab, setTab] = useState("Fee Rules");
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
        description="Configure platform fees, commissions and deductions."
        actions={
          <>
            <Button icon="plus" disabled>Add Fee Rule</Button>
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
                      { label: "Import Fee Rules", icon: "upload", onClick: () => { setMenuFor(null); operations.unavailable("Importing fee rules"); } },
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--tk-space-4)",
        }}
      >
        <StatCard
          icon="wallet"
          tint="green"
          label="Total Revenue (This Month)"
          value={revenueLoading ? <Skeleton as="span" width={96} height={23} /> : formatNaira(feeSummary.totalRevenue)}
          delta={feeSummary.totalRevenueDelta}
          caption="vs previous period"
        />
        <StatCard
          icon="scan-line"
          tint="purple"
          label="Total Platform Fees"
          value={metric(formatNaira(feeSummary.totalPlatformFees))}
          delta={feeSummary.totalPlatformFeesDelta}
          caption="vs previous period"
        />
        <StatCard
          icon="handshake"
          tint="amber"
          label="Total Commissions"
          value={metric(formatNaira(feeSummary.totalCommissions))}
          delta={feeSummary.totalCommissionsDelta}
          caption="vs previous period"
        />
        <StatCard
          icon="file-minus"
          tint="red"
          label="Total Deductions"
          value={metric(formatNaira(feeSummary.totalDeductions))}
          delta={feeSummary.totalDeductionsDelta}
          direction="down"
          caption="vs previous period"
        />
        <StatCard
          icon="chart-pie"
          tint="blue"
          label="Avg. Effective Rate"
          value={metric(feeSummary.avgEffectiveRate)}
          delta={feeSummary.avgEffectiveRateDelta}
          caption="vs previous period"
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
            onChange={setTab}
            style={{ padding: "0 var(--tk-card-pad)" }}
            items={TABS}
          />

          {tab === "Fee Rules" ? (
            <>
              <TableToolbar
                search={
                  <SearchField
                    placeholder="Search fee rules..."
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(1);
                    }}
                  />
                }
                filters={
                  <>
                    <FilterButton
                      label="Status"
                      value={status}
                      options={["All Status", ...STATUSES]}
                      active={status !== "All Status"}
                      onChange={(v) => {
                        setStatus(v);
                        setPage(1);
                      }}
                    />
                    <FilterButton
                      label="Job Types"
                      value={jobType}
                      options={["All Job Types", ...JOB_TYPES]}
                      active={jobType !== "All Job Types"}
                      onChange={(v) => {
                        setJobType(v);
                        setPage(1);
                      }}
                    />
                    <FilterButton label="Locations" value={location} options={locationOptions} active={location !== 'All Locations'} onChange={(value) => { setLocation(value); setPage(1); }} />
                    <FilterButton
                      label="Cargo Types"
                      value={cargoType}
                      options={["All Cargo Types", ...CARGO_TYPES]}
                      active={cargoType !== "All Cargo Types"}
                      onChange={(v) => {
                        setCargoType(v);
                        setPage(1);
                      }}
                    />
                    <span style={{ position: 'relative' }}>
                      <Button variant="outline" icon="sliders-horizontal" onClick={() => setMenuFor(menuFor === 'filters' ? null : 'filters')}>
                        More Filters
                      </Button>
                      {menuFor === 'filters' && <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setMenuFor(null)}>
                        <DropdownMenu width={190} items={feeCategories.map((option) => ({ label: option.label, icon: category === option.value ? 'check' : undefined, onClick: () => { setCategory(option.value); setPage(1); setMenuFor(null); } }))} />
                      </span>}
                    </span>
                  </>
                }
              />

              <div style={{ padding: "0 var(--tk-card-pad) 4px" }}>
                <span
                  style={{
                    font: "600 15px/22px var(--tk-font-sans)",
                    color: "var(--tk-ink-900)",
                  }}
                >
                  Fee Rules{" "}
                  <span style={{ color: "var(--tk-ink-400)", fontWeight: 500 }}>
                    ({catalog.total ?? "—"})
                  </span>
                </span>
              </div>

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
                                { label: "Duplicate Rule", icon: "copy", onClick: () => { setMenuFor(null); operations.unavailable("Duplicating fee rules"); } },
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
          ) : tab === 'Deductions' || tab === 'Transactions' ? (
            <FeeRecordsTab key={tab + ':' + operations.owner} kind={tab === 'Deductions' ? 'deductions' : 'transactions'} rules={rules} />
          ) : tab === 'Analytics' ? (
            <FeeAnalyticsTab period={summaryPeriod} onPeriod={setSummaryPeriod} />
          ) : tab === 'Audit Log' ? (
            <FeeAuditTab key={operations.owner} />
          ) : (
            <Card
              pad="none"
              style={{ border: 0, boxShadow: "none", padding: "32px 0" }}
            >
              <EmptyState
                icon="hammer"
                title={`${tab} isn't built yet`}
                description="This tab is wired into Fees & Commission, but its content hasn't been transcribed from the source screenshots yet."
              />
            </Card>
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
            title="Fee & Commission Summary"
            action={<FilterButton label="Period" value={feePeriods.find((period) => period.value === summaryPeriod).label} options={feePeriods.map((period) => period.label)} active={summaryPeriod !== 'month'} onChange={(value) => setSummaryPeriod(feePeriods.find((period) => period.label === value).value)} />}
            footer={<a href="#" onClick={(event) => { event.preventDefault(); setTab('Analytics'); }}>View full analytics →</a>}
          >
            <LabelValue
              label="Total Fees Collected"
              value={periodMetric(formatNaira(periodSummary.totalFeesCollected))}
            />
            <LabelValue
              label="Total Commissions Paid"
              value={periodMetric(formatNaira(periodSummary.totalCommissionsPaid))}
            />
            <LabelValue
              label="Total Deductions"
              value={periodMetric(formatNaira(periodSummary.totalDeductionsCollected))}
            />
            <LabelValue
              label="Net Platform Revenue"
              value={periodMetric(formatNaira(periodSummary.netPlatformRevenue))}
            />
            <LabelValue
              label="Avg. Effective Rate"
              value={periodMetric(periodSummary.avgEffectiveRateLabel)}
            />
          </SectionCard>

          <SectionCard
            title="Fee Distribution by Type"
            footer={<a href="#" onClick={(event) => { event.preventDefault(); setTab('Analytics'); }}>View detailed breakdown →</a>}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                alignItems: "center",
                width: "100%",
              }}
            >
              <DonutChart
                size={160}
                thickness={16}
                centerValue={feeMillions(periodSummary.totalFeesCollected)}
                centerLabel="Total Fees"
                data={feeDistribution.filter((d) => Number.isFinite(d.value)).map((d) => ({
                  label: d.label,
                  value: d.value,
                  color: d.color,
                }))}
              />
              <LegendList
                style={{ flex: 1, width: "100%" }}
                items={feeDistribution.map((d) => ({
                  label: d.label,
                  value: d.value,
                  display: `${d.value == null ? "—" : `${d.value}%`} (${feeMillions(d.amount)})`,
                  color: d.color,
                }))}
                showShare={false}
              />
            </div>
          </SectionCard>

          <QuickActionsCard
            items={[
              {
                icon: "plus",
                label: "Add New Fee Rule",
                hint: "Create a fee rule",
                onClick: () => operations.unavailable("Adding fee rules"),
              },
              {
                icon: "handshake",
                label: "Add Commission Rule",
                hint: "Create a commission rule",
                onClick: () => operations.unavailable("Adding commission rules"),
              },
              {
                icon: "layout-template",
                label: "Create Fee Scheme",
                hint: "Bundle rules together",
                onClick: () => operations.unavailable("Creating fee schemes"),
              },
              {
                icon: "list-checks",
                label: "Bulk Update Fees",
                hint: "Edit multiple rules",
                onClick: openBulk,
              },
              {
                icon: "file-text",
                label: "Export Fee Report",
                hint: "Download as CSV/PDF",
                onClick: () => void operations.download("report", 'csv', null, { period: summaryPeriod }),
              },
            ]}
          />
        </div>
      </div>

      {editRule && <FeeRuleEditDialog key={editRule.id} rule={editRule} canManage={operations.canManage} onClose={() => setEditRule(null)} />}
      {bulkOpen && <FeeRulesBulkDialog rules={rules} canManage={operations.canManage} onClose={() => setBulkOpen(false)} />}

      <Banner tone="info" title="About Fees & Commission">
        Fees are charged to users for using the platform services. Commissions
        are paid to partners and service providers. All rates are configurable
        and can be set as percentages or fixed amounts.
      </Banner>
    </>
  );
}
