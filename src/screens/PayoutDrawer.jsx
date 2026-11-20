"use client";
import { ToastRelay } from '../components/ActionToast.jsx';
import { useEffect, useRef, useState } from "react";
import { Badge, Banner, Button, CopyableId, DrawerFacts, DrawerSection, DropdownMenu, Modal, SideDrawer, Skeleton, Textarea, Timeline, isMissing } from "../ds.js";
import { Link } from "../router.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import {
  useGetAdminPayoutDetailQuery, useApproveAdminPayoutWithdrawalMutation, useRejectAdminPayoutWithdrawalMutation,
  useRequestAdminPayoutInfoMutation, useRaiseAdminPayoutIssueMutation, useUpdateAdminPayoutNotesMutation,
  useLazyGetAdminPayoutStatementQuery, useLazyGetAdminPayoutDocumentQuery, downloadPayoutFile, payoutJobUrl,
} from "../store/features/payouts/payoutsApi.js";
import { Money, PartyCell, formatNaira, FinanceFacts, cleanSteps } from "../components/finance/FinanceCells.jsx";

export const PAYOUT_STATUS_TONE = { Pending: "warning", "Pending Review": "warning", Approved: "info", Processing: "info", Completed: "success", Paid: "success", Rejected: "danger", Failed: "danger", Reversed: "orange" };

const MODALS = {
  reject: { title: "Reject payout", label: "Reason for rejection", action: "Reject", required: true },
  info: { title: "Request more information", label: "What do you need from the beneficiary?", action: "Send request", required: true },
  issue: { title: "Raise an issue", label: "Describe the issue", action: "Raise issue", required: true },
  notes: { title: "Edit notes", label: "Internal notes", action: "Save notes", required: false },
};

export function PayoutDrawer({ target, row, onClose }) {
  const query = useGetAdminPayoutDetailQuery({ id: target.id, source: target.source }, { skip: !target.id });
  const r = query.error ? null : query.currentData;
  const [approve, approveState] = useApproveAdminPayoutWithdrawalMutation();
  const [reject, rejectState] = useRejectAdminPayoutWithdrawalMutation();
  const [requestInfo, infoState] = useRequestAdminPayoutInfoMutation();
  const [raiseIssue, issueState] = useRaiseAdminPayoutIssueMutation();
  const [saveNotes, notesState] = useUpdateAdminPayoutNotesMutation();
  const [readStatement, statementState] = useLazyGetAdminPayoutStatementQuery();
  const [readDocument, documentState] = useLazyGetAdminPayoutDocumentQuery();
  const busy = approveState.isLoading || rejectState.isLoading || infoState.isLoading || issueState.isLoading || notesState.isLoading || statementState.isFetching || documentState.isFetching;
  const pending = useRef(false);
  const [modal, setModal] = useState(null);
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => { setModal(null); setText(""); setMenu(false); setNotice(null); }, [target.id, target.source]);

  async function run(task, success) {
    if (pending.current || busy) return;
    pending.current = true; setMenu(false);
    try { const result = await task(); setNotice({ tone: "success", text: success(result) }); setModal(null); setText(""); }
    catch (error) { setNotice({ tone: "danger", text: getApiErrorMessage(error) }); }
    finally { pending.current = false; }
  }
  const submitModal = () => {
    const ids = { id: r.id, source: r.source };
    if (modal === "reject") return run(() => reject({ ...ids, reason: text }).unwrap(), (res) => res.message || "Payout rejected.");
    if (modal === "info") return run(() => requestInfo({ ...ids, message: text }).unwrap(), () => "Information requested.");
    if (modal === "issue") return run(() => raiseIssue({ ...ids, note: text }).unwrap(), () => "Issue raised.");
    return run(() => saveNotes({ ...ids, note: text }).unwrap(), () => "Notes saved.");
  };
  const statement = () => run(async () => downloadPayoutFile(await readStatement({ id: r.id, source: r.source }, false).unwrap()), () => "Statement downloaded.");
  const openDocument = (doc) => run(async () => downloadPayoutFile(await readDocument({ id: r.id, source: r.source, url: doc.url }, false).unwrap()), () => `${doc.name} downloaded.`);

  const status = r?.status || row?.status;
  const gross = r?.grossAmount ?? row?.grossAmount, net = r?.netAmount ?? row?.netAmount;
  const lines = r?.deductionLines?.length ? r.deductionLines : row?.deductionLines || [];
  const steps = r ? (status === "Completed" ? r.payoutSteps : r.approvalSteps) : [];
  const allocations = r?.allocations || [];
  const docs = r?.documents || [];
  const config = modal ? MODALS[modal] : null;

  const footer = r && <div className="fin-actions">
    <span style={{ position: "relative", marginRight: "auto" }}>
      <Button variant="outline" icon="ellipsis" disabled={busy} onClick={() => setMenu((open) => !open)}>More</Button>
      {menu && <span style={{ position: "absolute", left: 0, bottom: 44, zIndex: 40 }} onMouseLeave={() => setMenu(false)}>
        <DropdownMenu width={220} items={[
          { label: "Request information", icon: "message-circle-question", onClick: () => { setMenu(false); setText(""); setModal("info"); } },
          { label: "Raise an issue", icon: "flag", onClick: () => { setMenu(false); setText(""); setModal("issue"); } },
          { label: "Edit notes", icon: "pencil", onClick: () => { setMenu(false); setText(isMissing(r.notes) ? "" : r.notes); setModal("notes"); } },
          { divider: true },
          { label: "Download statement", icon: "file-text", onClick: statement },
        ]} />
      </span>}
    </span>
    {r.canReject && <Button variant="danger" disabled={busy} onClick={() => { setText(""); setModal("reject"); }}>Reject</Button>}
    {r.canReject && <Button icon="check" disabled={busy || !r.canApprove} title={!r.canApprove ? "This payout isn't ready to approve yet" : undefined}
      onClick={() => run(() => approve({ id: r.id, source: r.source, adminRemark: "" }).unwrap(), (res) => res.message || "Payout approved.")}>
      {approveState.isLoading ? "Approving…" : "Approve payout"}
    </Button>}
    {!r.canReject && <Button variant="outline" icon="file-text" disabled={busy} onClick={statement}>Statement</Button>}
  </div>;

  return <>
    <SideDrawer label="Payout details" eyebrow="Payout" onClose={onClose} footer={footer} width={560}
      title={<CopyableId id={target.id} size="lg" onCopy={(value) => navigator.clipboard?.writeText(value)} />}
      meta={status && <>
        <Badge tone={PAYOUT_STATUS_TONE[status] || "neutral"} dot>{status}</Badge>
        {!isMissing(r?.eligibility) && <Badge tone={r.eligibility === "Eligible" ? "success" : "warning"}>{r.eligibility}</Badge>}
      </>}>
      {!r && query.isFetching && <><Skeleton height={88} /><Skeleton height={180} /><Skeleton height={140} /></>}
      {query.error && <Banner tone="warning" title={getApiErrorMessage(query.error)} action={<Button size="sm" variant="outline" onClick={query.refetch}>Retry</Button>} />}
      {notice && <ToastRelay message={notice.text} tone={notice.tone} onShown={() => setNotice(null)}><Banner tone={notice.tone} title={notice.text} /></ToastRelay>}
      {r && <>
        {r.eligibilityReasons?.length > 0 && r.canReject && <Banner tone="warning" title="Can't approve yet">{r.eligibilityReasons.join(" · ")}</Banner>}

        <DrawerSection title="Amount">
          <div className="fin-hero"><span>{status === "Completed" ? "Paid to bank" : "To be paid"}</span><strong>{formatNaira(net) ?? "Not available"}</strong></div>
          <ul className="fin-breakdown">
            <li><span><strong>Requested</strong><small>Gross amount from the wallet</small></span><Money value={gross} /></li>
            {lines.map((line) => <li key={line.key} className="sub"><span><strong>{line.label}</strong></span><Money value={line.amount} signed positive={false} strong={false} /></li>)}
            <li className="total"><span><strong>Net payout</strong></span><Money value={net} /></li>
          </ul>
        </DrawerSection>

        <DrawerSection title="Beneficiary">
          <PartyCell name={r.party} role={r.partyRole} size={40} />
          <FinanceFacts items={[
            { label: "Bank", value: r.payment.bank, sub: r.payment.accountNumber },
            { label: "Account name", value: r.payment.accountName },
            { label: "Requested", value: r.dateRequested, sub: r.dateRequestedTime },
            { label: "Reference", value: r.reference },
          ]} />
        </DrawerSection>

        {allocations.length > 0 && <DrawerSection title="Jobs this payout covers">
          <ul className="fin-breakdown">
            {allocations.map((entry) => <li key={entry.key}>
              <span>
                <strong>{entry.jobId ? <Link to={payoutJobUrl(entry.jobId)}>{entry.jobNumber || entry.jobId}</Link> : "Not available"}</strong>
                <small>{entry.tripLabel ? `Trips: ${entry.tripLabel}` : "Wallet earnings"}</small>
              </span>
              <Money value={entry.amount} />
            </li>)}
          </ul>
          <p className="fin-note">Payouts come from the wallet balance; jobs are matched to it oldest first.</p>
        </DrawerSection>}

        {steps.length > 0 && <DrawerSection title="Progress"><Timeline items={cleanSteps(steps)} /></DrawerSection>}

        {(!isMissing(r.notes) || r.adminRemark || r.issueNotes?.length > 0) && <DrawerSection title="Notes">
          <FinanceFacts items={[
            ...(!isMissing(r.notes) ? [{ label: "Internal notes", value: r.notes, wide: true }] : []),
            ...(r.adminRemark ? [{ label: "Admin remark", value: r.adminRemark, wide: true }] : []),
            ...(r.issueNotes || []).map((issue, index) => ({ label: `Issue ${index + 1}`, value: issue.note, sub: issue.time, wide: true })),
          ]} />
        </DrawerSection>}

        {docs.length > 0 && <DrawerSection title="Documents">
          <div style={{ display: "grid", gap: 8 }}>
            {docs.map((doc, index) => <Button key={doc.url || index} variant="outline" icon="file-text" disabled={busy || !doc.url} onClick={() => openDocument(doc)} style={{ justifyContent: "flex-start" }}>{doc.name}</Button>)}
          </div>
        </DrawerSection>}
      </>}
    </SideDrawer>
    {config && <Modal open title={config.title} onClose={() => { if (!busy) setModal(null); }}
      footer={<><Button variant="outline" disabled={busy} onClick={() => setModal(null)}>Cancel</Button>
        <Button variant={modal === "reject" ? "danger" : "primary"} disabled={busy || (config.required && !text.trim())} onClick={submitModal}>{busy ? "Saving…" : config.action}</Button></>}>
      <Textarea label={config.label} rows={4} value={text} disabled={busy} onChange={(event) => setText(event.target.value)} />
    </Modal>}
  </>;
}
