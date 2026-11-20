"use client";
import { ToastRelay } from '../components/ActionToast.jsx';
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Badge, Banner, Button, CopyableId, DrawerFacts, DrawerSection, DropdownMenu, Modal, SideDrawer, Skeleton, TextField, Textarea, Timeline, isMissing } from "../ds.js";
import { Link } from "../router.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { withParams } from "../domain/urlState.js";
import {
  useGetAdminTransactionDetailQuery, useRetryAdminTransactionMutation, useReverseAdminTransactionMutation, useRefundAdminTransactionMutation,
  useReportAdminTransactionIssueMutation, useLazyGetAdminTransactionStatementQuery, useLazyGetAdminTransactionReceiptQuery,
  downloadTransactionPdf, transactionJobUrl,
} from "../store/features/transactions/transactionsApi.js";
import { Money, PartyCell, formatNaira, FinanceFacts, cleanSteps } from "../components/finance/FinanceCells.jsx";

export const TRANSACTION_STATUS_TONE = { Completed: "success", Pending: "warning", Processing: "info", Failed: "danger", Reversed: "orange" };
export const TRANSACTION_TYPE_TONE = {
  "Payment In": "success", "Payment Out": "orange", Payout: "purple", "Escrow Release": "info", "Escrow Hold": "neutral",
  "Wallet Funding": "teal", Fee: "orange", Refund: "warning", Reversal: "danger",
};

export function TransactionDrawer({ id, row, onClose }) {
  const query = useGetAdminTransactionDetailQuery(id, { skip: !id });
  const r = query.error ? null : query.currentData;
  const role = useSelector((state) => state.auth.admin?.role);
  const [retry, retryState] = useRetryAdminTransactionMutation();
  const [reverse, reverseState] = useReverseAdminTransactionMutation();
  const [refund, refundState] = useRefundAdminTransactionMutation();
  const [report, reportState] = useReportAdminTransactionIssueMutation();
  const [readStatement, statementState] = useLazyGetAdminTransactionStatementQuery();
  const [readReceipt, receiptState] = useLazyGetAdminTransactionReceiptQuery();
  const busy = retryState.isLoading || reverseState.isLoading || refundState.isLoading || reportState.isLoading || statementState.isFetching || receiptState.isFetching;
  const pending = useRef(false);
  const [modal, setModal] = useState(null), [amount, setAmount] = useState(""), [note, setNote] = useState(""), [menu, setMenu] = useState(false), [notice, setNotice] = useState(null);
  useEffect(() => { setModal(null); setAmount(""); setNote(""); setMenu(false); setNotice(null); }, [id]);

  const refundLimit = r?.actions.refundableAmount;
  const canRefund = ["SUPER_ADMIN", "FINANCE_ADMIN"].includes(role) && r?.actions.canRefund === true && refundLimit != null && refundLimit > 0;
  const canReverse = role === "SUPER_ADMIN" && r?.statusCode === "COMPLETED" && r?.actions.canReverse === true;

  async function run(task, success) {
    if (pending.current || busy) return;
    pending.current = true; setMenu(false);
    try { const result = await task(); setNotice({ tone: "success", text: success(result) }); setModal(null); setNote(""); setAmount(""); }
    catch (error) { setNotice({ tone: "danger", text: getApiErrorMessage(error) }); }
    finally { pending.current = false; }
  }
  const pdf = (read) => run(async () => downloadTransactionPdf(await read(r.id, false).unwrap()), () => "Download started.");
  const data = r || row;

  const footer = r && <div className="fin-actions">
    <span style={{ position: "relative", marginRight: "auto" }}>
      <Button variant="outline" icon="ellipsis" disabled={busy} onClick={() => setMenu((open) => !open)}>More</Button>
      {menu && <span style={{ position: "absolute", left: 0, bottom: 44, zIndex: 40 }} onMouseLeave={() => setMenu(false)}>
        <DropdownMenu width={220} items={[
          { label: "Download statement", icon: "file-text", onClick: () => pdf(readStatement) },
          { label: "Report an issue", icon: "flag", onClick: () => { setMenu(false); setModal("issue"); } },
          ...(canReverse ? [{ divider: true }, { label: "Reverse transaction", icon: "undo-2", tone: "danger", onClick: () => { setMenu(false); setModal("reverse"); } }] : []),
        ]} />
      </span>}
    </span>
    {r.statusCode === "FAILED" && <Button variant="outline" icon="rotate-ccw" disabled={busy} onClick={() => run(() => retry(r.id).unwrap(), (res) => res.message || "Retry started.")}>Retry</Button>}
    {canRefund && <Button variant="outline" icon="corner-up-left" disabled={busy} onClick={() => { setAmount(String(refundLimit)); setModal("refund"); }}>Refund</Button>}
    <Button icon="download" disabled={busy || r.statusCode !== "COMPLETED"} onClick={() => pdf(readReceipt)}>Receipt</Button>
  </div>;

  return <>
    <SideDrawer label="Transaction details" eyebrow="Transaction" onClose={onClose} footer={footer} width={560}
      title={<CopyableId id={data?.displayId || id} size="lg" onCopy={(value) => navigator.clipboard?.writeText(value)} />}
      meta={data && <>
        <Badge tone={TRANSACTION_STATUS_TONE[data.status] || "neutral"} dot>{data.status}</Badge>
        <Badge tone={TRANSACTION_TYPE_TONE[data.type] || "neutral"}>{data.type}</Badge>
      </>}>
      {!r && query.isFetching && <><Skeleton height={88} /><Skeleton height={180} /></>}
      {query.error && <Banner tone="warning" title={getApiErrorMessage(query.error)} action={<Button size="sm" variant="outline" onClick={query.refetch}>Retry</Button>} />}
      {notice && <ToastRelay message={notice.text} tone={notice.tone} onShown={() => setNotice(null)}><Banner tone={notice.tone} title={notice.text} /></ToastRelay>}
      {r && <>
        <DrawerSection title="Amount">
          <div className="fin-hero"><span>{r.description}</span><strong>{formatNaira(r.amount, { signed: true, positive: r.pos }) ?? "Not available"}</strong></div>
          {r.breakdown?.length > 0 && <ul className="fin-breakdown">
            {r.breakdown.map((line, index) => <li key={line.label + index}><span><strong>{line.label}</strong></span><Money value={line.value} /></li>)}
          </ul>}
          <FinanceFacts items={[
            { label: "Date", value: r.date, sub: r.time },
            { label: "Balance after", value: r.balanceAfter == null ? null : formatNaira(r.balanceAfter) },
            { label: "Method", value: r.paymentMethod.method, sub: isMissing(r.paymentMethod.bank) ? undefined : `${r.paymentMethod.bank} ${r.paymentMethod.accountNumber}` },
            { label: "Customer reference", value: r.reference.customerRef },
          ]} />
        </DrawerSection>

        {r.parties.length > 0 && <DrawerSection title="Parties">
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            {r.parties.map((party) => <PartyCell key={party.role + party.id} name={party.name} role={party.role} size={36} />)}
          </div>
        </DrawerSection>}

        {(r.jobInfo || r.escrowId || r.typeCode === "WITHDRAWAL") && <DrawerSection title="Related">
          <ul className="fin-breakdown">
            {r.jobInfo && <li><span><strong><Link to={transactionJobUrl(r.jobInfo.jobId)}>Job {r.relatedTo}</Link></strong><small>{r.jobInfo.route}</small></span></li>}
            {r.escrowId && <li><span><strong><Link to={"/wallets?id=" + encodeURIComponent(r.escrowId)}>Escrow settlement</Link></strong><small>How this job's payment was split</small></span></li>}
            {r.typeCode === "WITHDRAWAL" && <li><span><strong><Link to={withParams("/payouts", { q: r.displayId })}>Withdrawal request</Link></strong><small>Review it on Payouts</small></span></li>}
          </ul>
        </DrawerSection>}

        {r.timeline.length > 0 && <DrawerSection title="Progress"><Timeline items={cleanSteps(r.timeline)} /></DrawerSection>}

        {(r.issueNotes?.length > 0 || !isMissing(r.reference.internalNote)) && <DrawerSection title="Notes">
          <FinanceFacts items={[
            ...(!isMissing(r.reference.internalNote) ? [{ label: "Internal note", value: r.reference.internalNote, wide: true }] : []),
            ...(r.issueNotes || []).map((issue, index) => ({ label: `Issue ${index + 1}`, value: issue.note, sub: issue.time, wide: true })),
          ]} />
        </DrawerSection>}

        {r.documents.length > 0 && <DrawerSection title="Documents">
          <div style={{ display: "grid", gap: 8 }}>
            {r.documents.map((doc, index) => <Button key={doc.id || index} variant="outline" icon="file-text" disabled={!doc.url || !/^https?:\/\//i.test(doc.url)} onClick={() => window.open(doc.url, "_blank", "noopener,noreferrer")} style={{ justifyContent: "flex-start" }}>{doc.name}</Button>)}
          </div>
        </DrawerSection>}
      </>}
    </SideDrawer>

    {modal === "refund" && <Modal open title="Refund to forwarder" description={`Up to ${formatNaira(refundLimit)} can be refunded from this job's escrow.`} onClose={() => { if (!busy) setModal(null); }}
      footer={<><Button variant="outline" disabled={busy} onClick={() => setModal(null)}>Cancel</Button>
        <Button disabled={busy || !(Number(amount) > 0 && Number(amount) <= refundLimit)} onClick={() => run(() => refund({ id: r.id, amount: Number(amount) }).unwrap(), (res) => `Refund ${String(res.status || "submitted").toLowerCase()}.`)}>{busy ? "Refunding…" : "Refund"}</Button></>}>
      <TextField label="Refund amount (₦)" money type="number" min="1" max={refundLimit} value={amount} onChange={(event) => setAmount(event.target.value)} />
    </Modal>}
    {modal === "issue" && <Modal open title="Report an issue" onClose={() => { if (!busy) setModal(null); }}
      footer={<><Button variant="outline" disabled={busy} onClick={() => setModal(null)}>Cancel</Button>
        <Button variant="danger" disabled={busy || !note.trim()} onClick={() => run(() => report({ id: r.id, note: note.trim() }).unwrap(), () => "Issue reported.")}>{busy ? "Submitting…" : "Report issue"}</Button></>}>
      <Textarea label="Describe the issue" rows={4} maxLength={280} value={note} onChange={(event) => setNote(event.target.value)} />
    </Modal>}
    {modal === "reverse" && <Modal open title="Reverse this transaction?" description="This creates an opposite entry and can't be undone." onClose={() => { if (!busy) setModal(null); }}
      footer={<><Button variant="outline" disabled={busy} onClick={() => setModal(null)}>Cancel</Button>
        <Button variant="danger" disabled={busy} onClick={() => run(() => reverse(r.id).unwrap(), (res) => res.message || "Transaction reversed.")}>{busy ? "Reversing…" : "Reverse"}</Button></>}>
      <p className="fin-note">{r?.displayId} · {formatNaira(r?.amount)}</p>
    </Modal>}
  </>;
}
