"use client";
import { useState } from "react";
import { useSelector } from "react-redux";
import { Badge, Banner, Button, CopyableId, DrawerFacts, DrawerSection, SideDrawer, Skeleton, isMissing } from "../ds.js";
import { Link } from "../router.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { useGetAdminEscrowHoldQuery, useGetAdminEscrowReleasesQuery } from "../store/features/wallets/walletsApi.js";
import { escrowCanRelease, escrowMoneyRoles } from "../store/features/wallets/walletActionsApi.js";
import { useGetAdminFeeTransactionsQuery } from "../store/features/fees/feeTabsApi.js";
import { Money, PartyCell, formatNaira, FinanceFacts, cleanSteps } from "../components/finance/FinanceCells.jsx";
import { WalletActionDialog } from "./WalletActionDialog.jsx";

export const ESCROW_STATUS_TONE = {
  Locked: "warning", Held: "warning", "Mobilization Released": "info", Disputed: "danger", Completed: "success",
  Refunded: "orange", Cancelled: "neutral", Pending: "warning", Failed: "danger", Reversed: "orange",
};

// The fee ledger defaults to the last 30 days; ask for all of it.
const lagosToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const paid = (date) => (isMissing(date) ? "Not paid yet" : `Paid ${date}`);

/** One escrow hold and how its money was settled: what came in, where it went, what's left. */
export function EscrowDrawer({ holdId, onClose }) {
  const owner = useSelector((state) => state.auth.admin?.id), role = useSelector((state) => state.auth.admin?.role);
  const holdQuery = useGetAdminEscrowHoldQuery({ holdId, owner, role }, { skip: !holdId, refetchOnMountOrArgChange: true });
  const hold = holdQuery.error ? null : holdQuery.currentData;
  const releasesQuery = useGetAdminEscrowReleasesQuery({ escrowId: holdId, owner, role }, { skip: !hold });
  const releases = releasesQuery.error ? [] : releasesQuery.currentData || [];
  const feesQuery = useGetAdminFeeTransactionsQuery({ owner, page: 1, limit: 50, search: hold?.jobId || "", dateFrom: "2020-01-01", dateTo: lagosToday() }, { skip: !hold || isMissing(hold?.jobId) });
  const fees = (feesQuery.error ? [] : feesQuery.currentData?.rows || []).filter((row) => row.job === hold?.jobId);
  const [action, setAction] = useState(null);

  const b = hold?.breakdown;
  const refunds = releases.filter((row) => row.releaseType === "Refund" && row.statusCode === "COMPLETED").reduce((sum, row) => sum + (row.amount || 0), 0);
  const disputeSettled = releases.filter((row) => row.releaseType === "Dispute settlement" && row.statusCode === "COMPLETED").reduce((sum, row) => sum + (row.amount || 0), 0);
  const canMoveMoney = escrowMoneyRoles.includes(role);
  const openDisputes = hold?.disputes.filter((dispute) => dispute.canResolve) || [];

  const footer = hold && <div className="fin-actions">
    {hold.jobApiId && <Link to={"/jobs/detail?id=" + encodeURIComponent(hold.jobApiId)} style={{ marginRight: "auto", alignSelf: "center", font: "600 13px/18px var(--tk-font-sans)" }}>View job →</Link>}
    {hold.canOpenDispute && <Button variant="outline" icon="triangle-alert" onClick={() => setAction({ kind: "open", record: hold })}>Open dispute</Button>}
    {openDisputes.length > 0 && <Button variant="outline" icon="scale" onClick={() => setAction({ kind: "resolve", record: openDisputes[0] })}>Resolve dispute</Button>}
    {escrowCanRelease(hold) && <Button icon="lock-open" disabled={!canMoveMoney} title={!canMoveMoney ? "Releasing funds needs Super Admin or Finance Admin access" : undefined} onClick={() => setAction({ kind: "release", record: hold })}>
      Release {hold.nextRelease && !isMissing(hold.nextRelease.tranche) ? hold.nextRelease.tranche.toLowerCase() : "funds"}
    </Button>}
  </div>;

  return <>
    <SideDrawer label="Escrow details" eyebrow="Escrow" onClose={onClose} footer={footer} width={580}
      title={<CopyableId id={hold?.jobId && hold.jobId !== "—" ? hold.jobId : holdId} size="lg" onCopy={(value) => navigator.clipboard?.writeText(value)} />}
      meta={hold && <>
        <Badge tone={ESCROW_STATUS_TONE[hold.status] || "neutral"} dot>{hold.status}</Badge>
        {hold.frozen && <Badge tone="danger">Frozen</Badge>}
        {!isMissing(hold.jobStatus) && <Badge tone="neutral">Job: {hold.jobStatus}</Badge>}
      </>}>
      {!hold && holdQuery.isFetching && <><Skeleton height={88} /><Skeleton height={220} /><Skeleton height={140} /></>}
      {holdQuery.error && <Banner tone="warning" title={getApiErrorMessage(holdQuery.error)} action={<Button size="sm" variant="outline" onClick={holdQuery.refetch}>Retry</Button>} />}
      {hold && <>
        <DrawerSection title="Settlement">
          <div className="fin-hero"><span>Still held in escrow</span><strong>{formatNaira(hold.heldAmount) ?? "Not available"}</strong></div>
          <ul className="fin-breakdown">
            <li><span><strong>Paid into escrow</strong><small>By {hold.customer} on {hold.heldOn}</small></span><Money value={b?.total ?? hold.total} /></li>
            <li className="sub"><span><strong>Mobilisation to trucker</strong><small>{paid(b?.mobilizationPaidAt)}</small></span><Money value={b?.mobilization} signed positive={false} strong={false} /></li>
            <li className="sub"><span><strong>Final payment to trucker</strong><small>{paid(b?.finalPaidAt)}</small></span><Money value={b?.final} signed positive={false} strong={false} /></li>
            {b?.driverDelay > 0 && <li className="sub"><span><strong>Late-delivery deduction</strong><small>Taken from the final payment · 80% to the forwarder, 20% to the platform</small></span><Money value={b.driverDelay} strong={false} /></li>}
            {disputeSettled > 0 && <li className="sub"><span><strong>Dispute settlement to trucker</strong></span><Money value={disputeSettled} signed positive={false} strong={false} /></li>}
            {refunds > 0 && <li className="sub"><span><strong>Refunded to forwarder</strong></span><Money value={refunds} signed positive={false} strong={false} /></li>}
            <li className="total"><span><strong>Still held</strong>{hold.nextRelease && !isMissing(hold.nextRelease.trigger) && <small>Next: {hold.nextRelease.tranche} — {hold.nextRelease.trigger}</small>}</span><Money value={hold.heldAmount} /></li>
          </ul>
        </DrawerSection>

        <DrawerSection title="Parties">
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <PartyCell name={hold.customer} role={hold.customerRole} size={36} />
            <PartyCell name={hold.trucker} role={hold.truckerRole} size={36} />
          </div>
          <FinanceFacts items={[{ label: "Route", value: hold.route, wide: true }, { label: "Held on", value: hold.heldOn, sub: hold.heldTime }, { label: "Release by", value: hold.releaseBy }]} />
        </DrawerSection>

        <DrawerSection title="Releases">
          {releasesQuery.isFetching && !releases.length ? <Skeleton height={80} /> : releases.length ? <ul className="fin-breakdown">
            {releases.map((release) => <li key={release.key}>
              <span>
                <strong>{release.releaseType}</strong>
                <small>To {release.releasedTo} · {release.releasedOn}{release.releasedBy !== "—" ? ` · by ${release.releasedBy}` : ""}</small>
                {release.releaseId !== "—" && <small><Link to={"/transactions?id=" + encodeURIComponent(release.releaseId)}>View transaction →</Link></small>}
              </span>
              <span style={{ display: "grid", justifyItems: "end", gap: 4 }}><Money value={release.amount} /><Badge tone={ESCROW_STATUS_TONE[release.status] || "neutral"}>{release.status}</Badge></span>
            </li>)}
          </ul> : <p className="fin-note">Nothing has been released from this escrow yet.</p>}
        </DrawerSection>

        {fees.length > 0 && <DrawerSection title="Platform fees recorded on this job">
          <ul className="fin-breakdown">
            {fees.map((fee) => <li key={fee.id}><span><strong>{fee.feeName}</strong><small>{fee.category} · paid by {fee.payer}</small></span><Money value={fee.amount} /></li>)}
          </ul>
        </DrawerSection>}

        {hold.disputes.length > 0 && <DrawerSection title="Disputes">
          <ul className="fin-breakdown">
            {hold.disputes.map((dispute) => <li key={dispute.id}>
              <span><strong>{dispute.reason}</strong><small>Opened {dispute.opened}</small></span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge tone={dispute.canResolve ? "danger" : "neutral"}>{dispute.status}</Badge>
                {dispute.canResolve && <Button size="sm" variant="outline" onClick={() => setAction({ kind: "resolve", record: dispute })}>Resolve</Button>}
              </span>
            </li>)}
          </ul>
        </DrawerSection>}
      </>}
    </SideDrawer>
    {action && <WalletActionDialog key={action.kind + ":" + (action.record.holdId || action.record.id)} kind={action.kind} record={action.record} owner={owner} role={role} onClose={() => setAction(null)} />}
  </>;
}
