"use client";
import { ToastRelay } from '../components/ActionToast.jsx';
import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Badge, Banner, Button, CopyableId, DrawerFacts, DrawerSection, DropdownMenu, Modal, Select, SideDrawer, Skeleton, Textarea, Timeline, isMissing } from "../ds.js";
import { Link } from "../router.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import {
  useGetAdminDemurrageDetailQuery, useGetAdminDemurrageJobContextQuery, useGetAdminDemurrageInvoicesQuery, useGetAdminDemurrageDisputesQuery,
  useLazyGetAdminDemurrageInvoiceQuery, useSaveAdminDemurrageNoteMutation, useRaiseAdminDemurrageDisputeMutation, useResolveAdminDemurrageMutation,
  useEmailAdminDemurrageInvoiceMutation, demurrageRequestKey, mergeDemurrageDetail, demurrageJobUrl,
} from "../store/features/demurrage/demurrageApi.js";
import { Money, PartyCell, formatNaira, FinanceFacts, cleanSteps } from "../components/finance/FinanceCells.jsx";

export const DEMURRAGE_STATUS_TONE = { Active: "danger", Upcoming: "warning", Resolved: "success", Dispute: "purple", Waived: "neutral", Assessed: "warning", Applied: "success" };
const DISPUTE_REASONS = ["Incorrect charge calculation", "Delay caused by the trucker", "Delay caused by the terminal", "Other"];
const daysLabel = (value) => (value == null ? null : `${value.toLocaleString("en-NG")} day${value === 1 ? "" : "s"}`);

/** Driver-delay deduction: taken from the trucker's final payment and split 80/20. */
function DeductionDrawer({ row, onClose }) {
  return <SideDrawer label="Driver delay deduction" eyebrow="Driver delay" onClose={onClose} width={520}
    title={<CopyableId id={row.job} size="lg" onCopy={(value) => navigator.clipboard?.writeText(value)} />}
    meta={<><Badge tone={DEMURRAGE_STATUS_TONE[row.status] || "neutral"} dot>{row.status}</Badge><Badge tone="purple">Driver Delay</Badge></>}
    footer={row.jobId && <div className="fin-actions"><Link to={demurrageJobUrl(row.jobId)} style={{ marginRight: "auto", alignSelf: "center", font: "600 13px/18px var(--tk-font-sans)" }}>View job →</Link></div>}>
    <DrawerSection title="Deduction">
      <div className="fin-hero"><span>Deducted from the trucker’s final payment</span><strong>{formatNaira(row.amount) ?? "Not available"}</strong></div>
      <ul className="fin-breakdown">
        <li className="sub"><span><strong>To the forwarder</strong><small>80% compensation for the late delivery</small></span><Money value={row.forwarder} strong={false} /></li>
        <li className="sub"><span><strong>To the platform</strong><small>20%</small></span><Money value={row.platform} strong={false} /></li>
        <li className="total"><span><strong>Total deducted</strong></span><Money value={row.amount} /></li>
      </ul>
      <p className="fin-note">{row.status === "Assessed" ? "The job is still in progress — this amount is accruing and will be deducted when it completes." : row.reason}</p>
    </DrawerSection>
    <DrawerSection title="Trucker">
      <PartyCell name={row.user} role="TRUCKER" size={40} />
      <FinanceFacts items={[{ label: "Recorded", value: row.createdAt }, { label: "Final payment", value: row.transactionId ? <Link to={"/transactions?id=" + encodeURIComponent(row.transactionId)}>View transaction →</Link> : null }]} />
    </DrawerSection>
  </SideDrawer>;
}

/** Late-offloading charge billed to the forwarder. */
function ChargeDrawer({ id, onClose }) {
  const owner = useSelector((state) => state.auth.admin?.id), role = useSelector((state) => state.auth.admin?.role);
  const scope = { owner, role };
  const canResolve = ["SUPER_ADMIN", "FINANCE_ADMIN"].includes(role);
  const detailQuery = useGetAdminDemurrageDetailQuery({ id, ...scope }, { skip: !id });
  const entry = detailQuery.error ? null : detailQuery.currentData;
  const jobQuery = useGetAdminDemurrageJobContextQuery({ id: entry?.jobApiId, ...scope }, { skip: !entry?.jobApiId });
  const invoiceQuery = useGetAdminDemurrageInvoicesQuery({ id: entry?.chargeApiId, ...scope }, { skip: !entry?.chargeApiId });
  const disputesQuery = useGetAdminDemurrageDisputesQuery({ id: entry?.chargeApiId, ...scope }, { skip: !entry?.chargeApiId });
  const r = useMemo(() => entry ? { ...mergeDemurrageDetail(entry, jobQuery.error ? null : jobQuery.currentData, invoiceQuery.error ? null : invoiceQuery.currentData), disputeSummary: disputesQuery.error ? entry.disputeSummary : disputesQuery.currentData?.summary ?? entry.disputeSummary } : null,
    [entry, jobQuery.currentData, jobQuery.error, invoiceQuery.currentData, invoiceQuery.error, disputesQuery.currentData, disputesQuery.error]);
  const [saveNote, noteState] = useSaveAdminDemurrageNoteMutation();
  const [raiseDispute, disputeState] = useRaiseAdminDemurrageDisputeMutation();
  const [resolve, resolveState] = useResolveAdminDemurrageMutation();
  const [emailInvoice, emailState] = useEmailAdminDemurrageInvoiceMutation();
  const [readInvoice, pdfState] = useLazyGetAdminDemurrageInvoiceQuery();
  const busy = noteState.isLoading || disputeState.isLoading || resolveState.isLoading || emailState.isLoading || pdfState.isFetching;
  const pending = useRef(false), resolveKey = useRef(null), emailKey = useRef(null);
  const [modal, setModal] = useState(null), [menu, setMenu] = useState(false), [notice, setNotice] = useState(null);
  const [method, setMethod] = useState(""), [waiver, setWaiver] = useState(""), [reason, setReason] = useState(DISPUTE_REASONS[0]), [details, setDetails] = useState(""), [note, setNote] = useState("");
  useEffect(() => { setModal(null); setMenu(false); setNotice(null); }, [id]);

  async function run(task, success) {
    if (pending.current || busy) return;
    pending.current = true; setMenu(false);
    try { const result = await task(); setNotice({ tone: "success", text: success(result) }); setModal(null); }
    catch (error) { setNotice({ tone: "danger", text: getApiErrorMessage(error) }); if (error?.status === 409) detailQuery.refetch(); }
    finally { pending.current = false; }
  }
  async function invoice() {
    await run(async () => {
      const file = await readInvoice({ id: r.chargeApiId, preview: false, ...scope }, false).unwrap();
      const anchor = document.createElement("a"); anchor.href = file.url; anchor.download = file.name;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(file.url), 1000);
    }, () => "Invoice downloaded.");
  }
  const resolvable = r && r.version != null && r.outstanding > 0 && !["RESOLVED", "WAIVED"].includes(r.statusCode);
  const confirmResolve = () => {
    const payload = { id: r.chargeApiId, method, reason: method === "WAIVE" ? waiver.trim() : undefined, expectedVersion: r.version, ...scope };
    if (!resolveKey.current) resolveKey.current = demurrageRequestKey();
    return run(() => resolve({ ...payload, key: resolveKey.current }).unwrap().finally(() => { resolveKey.current = null; }), (res) => `Charge ${String(res.status || "resolved").toLowerCase()}.`);
  };
  const timeline = r ? [
    { title: "Cargo arrived", key: "freeStarted" }, { title: "Free window ended", key: "freeEnded" }, { title: "Charge started", key: "chargeStarted" }, { title: "Last update", key: "updated" },
  ].map((step) => ({ title: step.title, description: r.timeline[step.key]?.detail !== "—" ? r.timeline[step.key]?.detail : undefined, time: r.timeline[step.key]?.date, state: isMissing(r.timeline[step.key]?.date) ? "pending" : "done" })) : [];

  const footer = r && <div className="fin-actions">
    <span style={{ position: "relative", marginRight: "auto" }}>
      <Button variant="outline" icon="ellipsis" disabled={busy} onClick={() => setMenu((open) => !open)}>More</Button>
      {menu && <span style={{ position: "absolute", left: 0, bottom: 44, zIndex: 'var(--tk-z-dropdown)' }} onMouseLeave={() => setMenu(false)}>
        <DropdownMenu width={220} items={[
          { label: "Record a dispute", icon: "triangle-alert", onClick: () => { setMenu(false); setDetails(""); setModal("dispute"); } },
          { label: "Edit note", icon: "pencil", onClick: () => { setMenu(false); setNote(isMissing(r.noteValue) ? "" : r.noteValue); setModal("note"); } },
          { divider: true },
          { label: "Email invoice to forwarder", icon: "mail", onClick: () => { if (!emailKey.current) emailKey.current = demurrageRequestKey(); run(() => emailInvoice({ id: r.chargeApiId, key: emailKey.current, ...scope }).unwrap().finally(() => { emailKey.current = null; }), (res) => res.message || "Invoice emailed."); } },
          { label: "Download invoice", icon: "download", onClick: invoice },
        ]} />
      </span>}
    </span>
    <Button icon="circle-check" disabled={busy || !canResolve || !resolvable} title={!canResolve ? "Only Super Admins and Finance Admins can resolve charges" : !resolvable ? "Nothing outstanding to resolve" : undefined}
      onClick={() => { setMethod(""); setWaiver(""); setModal("resolve"); }}>Resolve charge</Button>
  </div>;

  return <>
    <SideDrawer label="Demurrage charge" eyebrow="Late offloading" onClose={onClose} footer={footer} width={560}
      title={<CopyableId id={r?.jobId && r.jobId !== "—" ? r.jobId : id} size="lg" onCopy={(value) => navigator.clipboard?.writeText(value)} />}
      meta={r && <><Badge tone={DEMURRAGE_STATUS_TONE[r.status] || "neutral"} dot>{r.status}</Badge><Badge tone="info">Late Offloading</Badge>{r.source && <Badge tone="neutral">{r.source === "MANUAL" ? "Manual" : "Automatic"}</Badge>}</>}>
      {!r && detailQuery.isFetching && <><Skeleton height={88} /><Skeleton height={200} /></>}
      {detailQuery.error && <Banner tone="warning" title={getApiErrorMessage(detailQuery.error)} action={<Button size="sm" variant="outline" onClick={detailQuery.refetch}>Retry</Button>} />}
      {notice && <ToastRelay message={notice.text} tone={notice.tone} onShown={() => setNotice(null)}><Banner tone={notice.tone} title={notice.text} /></ToastRelay>}
      {r && <>
        <DrawerSection title="Charge">
          <div className="fin-hero"><span>{r.outstanding > 0 ? "Outstanding" : "Charge"}</span><strong>{formatNaira(r.outstanding > 0 ? r.outstanding : r.charge) ?? "Not available"}</strong></div>
          <ul className="fin-breakdown">
            <li><span><strong>{daysLabel(r.daysOver) || "Days over"} × {formatNaira(r.rate) ?? "rate"}/day</strong><small>{r.formula !== "—" ? r.formula : "Days past the free window × the rate when the charge started"}</small></span><Money value={r.subtotal} /></li>
            {r.vat > 0 && <li className="sub"><span><strong>VAT {r.vatPercent != null ? `(${r.vatPercent}%)` : ""}</strong></span><Money value={r.vat} strong={false} /></li>}
            <li className="total"><span><strong>Total charge</strong></span><Money value={r.charge} /></li>
            <li className="sub"><span><strong>Paid</strong></span><Money value={r.paid} strong={false} /></li>
            <li className="total"><span><strong>Outstanding</strong></span><Money value={r.outstanding} /></li>
          </ul>
        </DrawerSection>
        <DrawerSection title="Parties">
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <PartyCell name={r.customer} role="FORWARDER" size={36} />
            <PartyCell name={r.assignedTo} role="TRUCKER" size={36} />
          </div>
        </DrawerSection>
        <DrawerSection title="Offloading">
          <FinanceFacts items={[
            { label: "Days over", value: daysLabel(r.daysOver), sub: r.overSince !== "—" ? r.overSince : undefined },
            { label: "Free window", value: r.freePeriod },
            { label: "Container", value: r.container, sub: r.size !== "—" ? r.size : undefined },
            { label: "Route", value: r.route },
          ]} />
          <Timeline items={cleanSteps(timeline)} />
        </DrawerSection>
        {(!isMissing(r.disputeSummary) || !isMissing(r.noteValue)) && <DrawerSection title="Disputes & notes">
          <FinanceFacts items={[
            ...(!isMissing(r.disputeSummary) ? [{ label: "Disputes", value: r.disputeSummary, wide: true }] : []),
            ...(!isMissing(r.noteValue) ? [{ label: "Note", value: r.noteValue, sub: r.noteUpdatedAt, wide: true }] : []),
          ]} />
        </DrawerSection>}
        {r.jobApiId && <p className="fin-note"><Link to={demurrageJobUrl(r.jobApiId)}>View job →</Link></p>}
      </>}
    </SideDrawer>

    {modal === "resolve" && <Modal open title="Resolve charge" description="Collect the outstanding balance from the forwarder's wallet or waive it." onClose={() => { if (!busy) setModal(null); }}
      footer={<><Button variant="outline" disabled={busy} onClick={() => setModal(null)}>Cancel</Button>
        <Button disabled={busy || !method || (method === "WAIVE" && !waiver.trim()) || (method === "COLLECT" && r.statusCode === "UPCOMING")} onClick={confirmResolve}>{busy ? "Saving…" : "Confirm"}</Button></>}>
      <div style={{ display: "grid", gap: 12 }}>
        <Select label="Resolution" value={method} placeholder="Choose how to resolve" onChange={(event) => setMethod(event.target.value)} options={[{ value: "COLLECT", label: `Collect ${formatNaira(r.outstanding)}` }, { value: "WAIVE", label: "Waive the charge" }]} />
        {method === "WAIVE" && <Textarea label="Why is it being waived?" rows={3} value={waiver} onChange={(event) => setWaiver(event.target.value)} />}
      </div>
    </Modal>}
    {modal === "dispute" && <Modal open title="Record a dispute" onClose={() => { if (!busy) setModal(null); }}
      footer={<><Button variant="outline" disabled={busy} onClick={() => setModal(null)}>Cancel</Button>
        <Button disabled={busy || !reason} onClick={() => run(() => raiseDispute({ id: r.chargeApiId, reason, details, ...scope }).unwrap(), () => "Dispute recorded.")}>{busy ? "Saving…" : "Record dispute"}</Button></>}>
      <div style={{ display: "grid", gap: 12 }}>
        <Select label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} options={DISPUTE_REASONS} />
        <Textarea label="Details (optional)" rows={3} value={details} onChange={(event) => setDetails(event.target.value)} />
      </div>
    </Modal>}
    {modal === "note" && <Modal open title="Edit note" onClose={() => { if (!busy) setModal(null); }}
      footer={<><Button variant="outline" disabled={busy} onClick={() => setModal(null)}>Cancel</Button>
        <Button disabled={busy} onClick={() => run(() => saveNote({ id: r.chargeApiId, note, ...scope }).unwrap(), () => "Note saved.")}>{busy ? "Saving…" : "Save note"}</Button></>}>
      <Textarea label="Note" rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
    </Modal>}
  </>;
}

export function DemurrageDrawer({ row, chargeId, onClose }) {
  if (row?.kind === "Driver Delay") return <DeductionDrawer row={row} onClose={onClose} />;
  return <ChargeDrawer id={row?.chargeApiId || chargeId} onClose={onClose} />;
}
