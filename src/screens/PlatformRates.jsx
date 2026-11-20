"use client";
import { useState } from "react";
import { useSelector } from "react-redux";
import { usePageSearchState, matchesPageSearch } from "../components/PageSearch.jsx";
import { Link } from "../router.js";
import { PageHeader, Badge, Banner, Button, DataTable, EmptyState, Icon, SectionCard, Switch } from "../ds.js";
import { platformRateSections, pricingError, useGetAdminPricingConfigQuery } from "../store/features/pricing/pricingApi.js";
import { RateEditDialog } from "./RateEditDialog.jsx";
import { useGetAdminFeeRulesQuery } from "../store/features/fees/feesApi.js";
import { useFeeOperations } from "../store/features/fees/useFeeOperations.js";
import { DriverLoadingNotice, DriverTableLoading } from "./DriversLoading.jsx";

// Finance › Platform Rates is the only place platform-wide fees, rates and payment terms
// are edited. Pricing, Escrow, Demurrage and Fees & Commission link here instead of
// carrying their own copies.

function RateName({ row }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 32, height: 32, borderRadius: "var(--tk-r-sm)", background: "var(--tk-blue-soft)", color: "var(--tk-blue)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        <Icon name={row.icon || "lock"} size={16} />
      </span>
      <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <span style={{ font: "600 13px/18px var(--tk-font-sans)", color: "var(--tk-ink-900)" }}>{row.name}</span>
        <span className="tk-meta">{row.description}</span>
      </span>
    </span>
  );
}

// Rates the backend can pause: switching off sets the fee to 0, switching on restores its last value.
const PAUSABLE = { platformFee: "platform-fee", commissionPercent: "commission", vatPercent: "vat", withdrawalFee: "withdrawal-fee", depositFee: "deposit-fee" };

export function PlatformRates() {
  const configQuery = useGetAdminPricingConfigQuery();
  const config = configQuery.error ? null : configQuery.currentData;
  const canEdit = useSelector((state) => state.auth.admin?.role) === "SUPER_ADMIN";
  const [setting, setSetting] = useState(null);
  const [notice, setNotice] = useState(null);
  const [search] = usePageSearchState("");
  const rows = (config?.rows || []).filter((row) => matchesPageSearch([row.name, row.description, row.appliesTo], search));
  const escrowPolicy = (config?.escrowPolicy || []).filter((row) => matchesPageSearch([row.name, row.description], search));
  const loading = !config && configQuery.isFetching;
  const fees = useFeeOperations();
  const rulesQuery = useGetAdminFeeRulesQuery({ owner: fees.owner }, { skip: !fees.authenticated });
  const rules = new Map((rulesQuery.error ? [] : rulesQuery.currentData?.rules || []).map((rule) => [rule.id, rule]));
  const ruleFor = (row) => (PAUSABLE[row.key] ? rules.get(PAUSABLE[row.key]) : null);
  async function toggle(row) {
    const rule = ruleFor(row);
    if (!rule) return;
    if (!(await fees.toggle(rule))) return;
    setNotice(`${row.name} ${rule.statusCode === "ACTIVE" ? "paused" : "switched back on"}.`);
  }

  return (
    <>
      <PageHeader
        crumbs={["Finance", "Platform Rates"]}
        title="Platform Rates"
        description="The fees, rates and payment terms applied across Trukkas. New values apply to new jobs and charges; existing ones keep the rate they started with."
      />

      {notice && <Banner tone="success" action={<Button variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice}</Banner>}
      {configQuery.error && <Banner tone="danger" title="Unable to load platform rates" action={<Button variant="outline" onClick={configQuery.refetch}>Retry</Button>}>{pricingError(configQuery.error)}</Banner>}
      {!canEdit && <Banner tone="info">Only Super Admins can change platform rates.</Banner>}
      {config && (config.updatedBy || config.updatedAt.updated !== "—") && (
        <p className="tk-meta" style={{ margin: 0 }}>
          Last changed {config.updatedAt.updated}{config.updatedAt.time !== "—" ? ` at ${config.updatedAt.time}` : ""}{config.updatedBy ? ` by ${config.updatedBy}` : ""}. Every change is recorded in <Link to="/audit">Audit Logs</Link>.
        </p>
      )}
      {configQuery.isFetching && config && <DriverLoadingNotice>Refreshing platform rates…</DriverLoadingNotice>}

      <div style={{ display: "grid", gap: "var(--tk-grid-gap)" }}>
        {platformRateSections.map((section) => {
          const sectionRows = rows.filter((row) => row.section === section.key);
          if (config && !sectionRows.length) return null;
          return (
            <SectionCard key={section.key} title={section.title} description={section.description} pad="none" className="fin-rates-card">
              <div style={{ height: 14 }} />
              {loading ? <DriverTableLoading columns={4} label={`Loading ${section.title.toLowerCase()}`} /> : (
                <DataTable
                  rows={sectionRows}
                  rowKey={(row) => row.id}
                  columns={[
                    { key: "name", header: "Rate", render: (row) => <RateName row={row} /> },
                    { key: "rate", header: "Current Value", width: 190, render: (row) => ruleFor(row)?.statusCode === "INACTIVE"
                      ? <Badge tone="neutral" dot>Paused</Badge>
                      : <span className="fin-money strong">{row.rate}</span> },
                    { key: "effectiveFrom", header: "Effective From", width: 150, render: (row) => row.effectiveFrom === "—" ? <span className="tk-meta">Not recorded</span> : row.effectiveFrom },
                    {
                      key: "on", header: "On", width: 70,
                      render: (row) => {
                        const rule = ruleFor(row);
                        if (!rule) return null;
                        return <Switch checked={rule.statusCode === "ACTIVE"} disabled={!fees.canManage || fees.busy || rulesQuery.isFetching || !["ACTIVE", "INACTIVE"].includes(rule.statusCode)} onChange={() => void toggle(row)} />;
                      },
                    },
                    {
                      key: "edit", header: "", width: 80,
                      render: (row) => <Button variant="outline" size="sm" disabled={!canEdit || !row.editable || configQuery.isFetching || ruleFor(row)?.statusCode === "INACTIVE"} onClick={() => setSetting(row)}>Edit</Button>,
                    },
                  ]}
                />
              )}
              {section.key === "payment" && escrowPolicy.length > 0 && (
                <>
                  <div style={{ height: 18 }} />
                  <DataTable
                    rows={escrowPolicy}
                    rowKey={(row) => row.id}
                    columns={[
                      { key: "name", header: "Escrow Policy", render: (row) => <RateName row={row} /> },
                      { key: "rate", header: "Current Value", width: 180, render: (row) => <b>{row.rate}</b> },
                      { key: "note", header: "", width: 230, render: () => <span className="tk-meta">Fixed platform policy</span> },
                    ]}
                  />
                  <p className="tk-meta" style={{ margin: 0, padding: "12px var(--tk-card-pad)" }}>
                    The confirmation hold follows the container-return confirmation window. Auto-release and dispute freeze are fixed platform policy.
                  </p>
                </>
              )}
            </SectionCard>
          );
        })}
        {config && !rows.length && <EmptyState icon="search" title="No matching rates" description="Try a different search." />}
      </div>

      {setting && <RateEditDialog key={setting.id} row={setting} readOnly={!canEdit} onClose={() => setSetting(null)} onDone={setNotice} />}
    </>
  );
}
