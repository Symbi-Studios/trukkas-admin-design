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
  DonutChart,
  LegendList,
  LabelValue,
  QuickActionsCard,
  Banner,
  IconButton,
  DropdownMenu,
  Icon,
  EmptyState,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { feeSummary, feeDistribution } from "../mock/fixtures/fees.js";
import { formatNaira } from "../mock/format.js";

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
  const rules = useCollection("feeRules") || [];
  const [tab, setTab] = useState("Fee Rules");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All Status");
  const [jobType, setJobType] = useState("All Job Types");
  const [cargoType, setCargoType] = useState("All Cargo Types");
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState(null);

  const filtered = useMemo(
    () =>
      rules.filter(
        (r) =>
          (status === "All Status" || r.status === status) &&
          (jobType === "All Job Types" || r.jobType === jobType) &&
          (cargoType === "All Cargo Types" || r.cargoType === cargoType) &&
          (!q ||
            [r.name, r.sub, r.appliesTo].some(
              (v) => v && v.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [rules, status, jobType, cargoType, q],
  );

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        crumbs={["Finance", "Fees & Commission"]}
        title="Fees & Commission"
        description="Configure platform fees, commissions and deductions."
        actions={
          <>
            <Button icon="plus">Add Fee Rule</Button>
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
                      { label: "Export as CSV", icon: "file-text" },
                      { label: "Export as PDF", icon: "file-text" },
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
                      { label: "Bulk Update Fees", icon: "list-checks" },
                      { label: "Import Fee Rules", icon: "upload" },
                      { divider: true },
                      { label: "Export Fee Report", icon: "file-text" },
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
          value={formatNaira(feeSummary.totalRevenue)}
          delta={feeSummary.totalRevenueDelta}
          caption="vs last month"
        />
        <StatCard
          icon="scan-line"
          tint="purple"
          label="Total Platform Fees"
          value={formatNaira(feeSummary.totalPlatformFees)}
          delta={feeSummary.totalPlatformFeesDelta}
          caption="vs last month"
        />
        <StatCard
          icon="handshake"
          tint="amber"
          label="Total Commissions"
          value={formatNaira(feeSummary.totalCommissions)}
          delta={feeSummary.totalCommissionsDelta}
          caption="vs last month"
        />
        <StatCard
          icon="file-minus"
          tint="red"
          label="Total Deductions"
          value={formatNaira(feeSummary.totalDeductions)}
          delta={feeSummary.totalDeductionsDelta}
          direction="down"
          caption="vs last month"
        />
        <StatCard
          icon="chart-pie"
          tint="blue"
          label="Avg. Effective Rate"
          value={feeSummary.avgEffectiveRate}
          delta={feeSummary.avgEffectiveRateDelta}
          caption="vs last month"
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
                    <FilterSelect label="All Locations" />
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
                    <Button variant="outline" icon="sliders-horizontal">
                      More Filters
                    </Button>
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
                    ({filtered.length})
                  </span>
                </span>
              </div>

              <DataTable
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
                            to={"/fees/" + r.id}
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
                                    navigate("/fees/" + r.id);
                                  },
                                },
                                { label: "Edit Rule", icon: "pencil" },
                                { label: "Duplicate Rule", icon: "copy" },
                                { divider: true },
                                {
                                  label:
                                    r.status === "Active"
                                      ? "Deactivate Rule"
                                      : "Activate Rule",
                                  icon: "circle-slash",
                                  tone: "danger",
                                },
                              ]}
                            />
                          </span>
                        )}
                      </span>
                    ),
                  },
                ]}
              />
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
                onPage={setPage}
                onPageSize={() => {}}
              />
            </>
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
            action={<FilterSelect label="This Month" />}
            footer={<a href="#">View full analytics →</a>}
          >
            <LabelValue
              label="Total Fees Collected"
              value={formatNaira(feeSummary.totalFeesCollected)}
            />
            <LabelValue
              label="Total Commissions Paid"
              value={formatNaira(feeSummary.totalCommissionsPaid)}
            />
            <LabelValue
              label="Total Deductions"
              value={formatNaira(feeSummary.totalDeductionsCollected)}
            />
            <LabelValue
              label="Net Platform Revenue"
              value={formatNaira(feeSummary.netPlatformRevenue)}
            />
            <LabelValue
              label="Avg. Effective Rate"
              value={feeSummary.avgEffectiveRateLabel}
            />
          </SectionCard>

          <SectionCard
            title="Fee Distribution by Type"
            footer={<a href="#">View detailed breakdown →</a>}
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
                centerValue={`₦${(feeSummary.totalPlatformFees / 1000000).toFixed(2)}M`}
                centerLabel="Total Fees"
                data={feeDistribution.map((d) => ({
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
                  display: `${d.value}% (₦${(d.amount / 1000000).toFixed(2)}M)`,
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
              },
              {
                icon: "handshake",
                label: "Add Commission Rule",
                hint: "Create a commission rule",
              },
              {
                icon: "layout-template",
                label: "Create Fee Scheme",
                hint: "Bundle rules together",
              },
              {
                icon: "list-checks",
                label: "Bulk Update Fees",
                hint: "Edit multiple rules",
              },
              {
                icon: "file-text",
                label: "Export Fee Report",
                hint: "Download as CSV/PDF",
              },
            ]}
          />
        </div>
      </div>

      <Banner tone="info" title="About Fees & Commission">
        Fees are charged to users for using the platform services. Commissions
        are paid to partners and service providers. All rates are configurable
        and can be set as percentages or fixed amounts.
      </Banner>
    </>
  );
}
