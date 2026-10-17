"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useNavigate, useParams, Link } from "../router.js";
import {
  PageHeader,
  Button,
  Badge,
  Card,
  SectionCard,
  LabelValue,
  CopyableId,
  DropdownMenu,
  Icon,
  Timeline,
  AttachmentCard,
  Modal,
  TextField,
  Textarea,
  Banner,
  Avatar,
  Skeleton,
} from "../ds.js";
import {
  useGetAdminPayoutDetailQuery, useApproveAdminPayoutWithdrawalMutation, useRejectAdminPayoutWithdrawalMutation,
  useRequestAdminPayoutInfoMutation, useRaiseAdminPayoutIssueMutation, useUpdateAdminPayoutNotesMutation,
  useLazyGetAdminPayoutStatementQuery, useLazyGetAdminPayoutDocumentQuery, downloadPayoutFile,
  payoutMoney as formatNaira, payoutCompanyUrl, payoutJobUrl, payoutTransactionUrl,
} from "../store/features/payouts/payoutsApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverLoadingNotice } from "./DriversLoading.jsx";

const STATUS_TONE = {
  "Pending Review": "warning",
  Approved: "success",
  Rejected: "danger",
  Processing: "info",
  Completed: "success",
};
const TILE_TINT = {
  "Pending Review": [
    "var(--tk-warning-soft)",
    "var(--tk-warning)",
    "hourglass",
  ],
  Approved: ["var(--tk-success-soft)", "var(--tk-success)", "circle-check"],
  Rejected: ["var(--tk-danger-soft)", "var(--tk-danger)", "circle-x"],
  Processing: ["var(--tk-blue-soft)", "var(--tk-blue)", "loader"],
  Completed: ["var(--tk-success-soft)", "var(--tk-success)", "banknote"],
};

function StatusStepper({ steps }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        padding: "10px 2px 0",
      }}
    >
      {steps.map((s, i) => {
        const dotBg =
          s.state === "pending"
            ? "#fff"
            : s.state === "danger"
              ? "var(--tk-danger-solid)"
              : s.state === "current"
                ? "var(--tk-blue)"
                : "var(--tk-success)";
        return (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: "center",
              position: "relative",
            }}
          >
            {i > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 11,
                  right: "50%",
                  width: "100%",
                  height: 2,
                  background:
                    steps[i - 1].state === "pending"
                      ? "var(--tk-line-strong)"
                      : "var(--tk-success)",
                  zIndex: 0,
                }}
              />
            )}
            <span
              style={{
                position: "relative",
                zIndex: 1,
                width: 24,
                height: 24,
                borderRadius: 999,
                display: "inline-grid",
                placeItems: "center",
                background: dotBg,
                border:
                  s.state === "pending"
                    ? "2px solid var(--tk-line-strong)"
                    : "none",
              }}
            >
              {s.state !== "pending" && (
                <Icon name={s.icon || "check"} size={12} color="#fff" />
              )}
            </span>
            <div
              style={{
                marginTop: 8,
                font: "600 11px/14px var(--tk-font-sans)",
                color:
                  s.state === "pending"
                    ? "var(--tk-ink-400)"
                    : "var(--tk-ink-900)",
                padding: "0 4px",
                overflowWrap: "break-word",
              }}
            >
              {s.title}
            </div>
            {s.time && (
              <div className="tk-meta" style={{ fontSize: 10 }}>
                {s.time}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RelatedRecordRow({ icon, label, id, description, status, to }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderTop: "1px solid var(--tk-line)",
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--tk-r-sm)",
          background: "var(--tk-blue-soft)",
          color: "var(--tk-blue)",
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        <Icon name={icon} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
        {to ? (
          <Link to={to} className="tk-mono" style={{ fontWeight: 600 }}>
            {id}
          </Link>
        ) : (
          <span
            className="tk-mono"
            style={{ fontWeight: 600, color: "var(--tk-ink-900)" }}
          >
            {id}
          </span>
        )}
        <span
          className="tk-meta"
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {description}
        </span>
      </div>
      <Badge tone={STATUS_TONE[status] || "success"}>{status}</Badge>
      <Icon name="chevron-right" size={16} color="var(--tk-ink-300)" />
    </div>
  );
}

function BreakdownRow({ label, value }) {
  const neg = value < 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "9px 0",
      }}
    >
      <span
        style={{
          font: "400 13px/20px var(--tk-font-sans)",
          color: "var(--tk-ink-400)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: "600 14px/20px var(--tk-font-sans)",
          color: neg ? "var(--tk-danger)" : "var(--tk-ink-900)",
        }}
      >
        {neg ? "- " : ""}
        {formatNaira(value == null ? null : Math.abs(value))}
      </span>
    </div>
  );
}

function TripAllocation({ payout }) {
  if (payout.partyType !== "company") return null;
  return (
    <SectionCard
      title={`Trip Allocation (${payout.allocations?.length ?? "—"})`}
      description="This wallet payout is attributed to job earnings oldest-first (FIFO); each allocation belongs to a job."
    >
      <div style={{ display: "grid", gap: "var(--tk-space-2)" }}>
        {(payout.allocations || []).map((allocation) => (
          <div
            key={allocation.key}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px,1fr) minmax(110px,1fr) auto",
              gap: "var(--tk-space-3)",
              alignItems: "center",
              padding: "var(--tk-space-3)",
              border: "1px solid var(--tk-line)",
              borderRadius: "var(--tk-r-md)",
            }}
          >
            <span>
              {allocation.jobId || payout.jobId ? <Link
                to={`${payoutJobUrl(allocation.jobId || payout.jobId)}${allocation.tripId ? `&tripId=${encodeURIComponent(allocation.tripId)}` : ""}`}
                className="tk-mono"
              >
                {allocation.tripLabel ?? allocation.tripId ?? "—"}
              </Link> : <span className="tk-mono">{allocation.tripLabel ?? allocation.tripId ?? "—"}</span>}
              <span className="tk-meta" style={{ display: "block" }}>
                {allocation.trip?.truckPlate ?? "—"}
              </span>
            </span>
            <span>
              <span className="tk-label">
                {allocation.trip?.driverName ?? "—"}
              </span>
              <span className="tk-meta" style={{ display: "block" }}>
                {allocation.trip?.status ?? "—"}
              </span>
            </span>
            <strong>{formatNaira(allocation.amount)}</strong>
          </div>
        ))}
        {!payout.allocations?.length && "—"}
      </div>
      <Banner
        tone={payout.approvalReady ? "success" : "warning"}
        style={{ marginTop: "var(--tk-space-3)" }}
        title={
          payout.approvalReady == null ? "—" : payout.approvalReady
            ? "Ready for approval"
            : `Payment held — ${payout.eligibility}`
        }
      >
        {payout.reconciliation?.ok == null ? "—" : payout.reconciliation.ok
          ? "The job earnings allocations cover the gross wallet payout."
          : (payout.reconciliation?.issues?.join(" ") || "Some payout funds are not attributable to job earnings.")}
      </Banner>
    </SectionCard>
  );
}

export function PayoutDetail() {
  const params = useParams(), search = useSearchParams();
  const payoutId = search.get("id") || params.payoutId || "";
  const source = search.get("source");
  const navigate = useNavigate();
  const detailQuery = useGetAdminPayoutDetailQuery({ id: payoutId, source }, { skip: !payoutId });
  const r = detailQuery.error ? null : detailQuery.currentData;
  const [approveWithdrawal, approveState] = useApproveAdminPayoutWithdrawalMutation();
  const [rejectWithdrawal, rejectState] = useRejectAdminPayoutWithdrawalMutation();
  const [requestInfo, infoState] = useRequestAdminPayoutInfoMutation();
  const [raiseIssue, issueState] = useRaiseAdminPayoutIssueMutation();
  const [saveNotes, notesState] = useUpdateAdminPayoutNotesMutation();
  const [readStatement, statementState] = useLazyGetAdminPayoutStatementQuery();
  const [readDocument, documentState] = useLazyGetAdminPayoutDocumentQuery();
  const busy = approveState.isLoading || rejectState.isLoading || infoState.isLoading || issueState.isLoading || notesState.isLoading || statementState.isFetching || documentState.isFetching || detailQuery.isFetching;
  const operationPending = useRef(false), flashTimer = useRef(null);

  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(null);
  const [remark, setRemark] = useState("");
  const [note, setNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [banner, setBanner] = useState(null);
  const [showAllDocs, setShowAllDocs] = useState(false);

  useEffect(() => {
    setMenu(false); setModal(null); setRemark(""); setNote(""); setRefundAmount(""); setBanner(null); setShowAllDocs(false);
    return () => clearTimeout(flashTimer.current);
  }, [payoutId, source]);

  if (!detailQuery.currentData && detailQuery.isFetching) return <>
    <Card><Skeleton width={180} height={26} /><div style={{ marginTop: 14 }}><Skeleton width="55%" height={14} /></div></Card>
    <DriverLoadingNotice>Loading payout details…</DriverLoadingNotice>
    <Card><Skeleton width="40%" height={20} /><div style={{ marginTop: 24 }}><Skeleton height={120} /></div></Card>
  </>;

  if (!r) {
    return (
      <Card>
        <span className="tk-body">{detailQuery.error ? getApiErrorMessage(detailQuery.error) : <>No payout found with ID {payoutId}.</>}</span>
        <div style={{ marginTop: 12 }}>
          <Button
            variant="outline"
            icon="arrow-left"
            onClick={() => navigate("/payouts")}
          >
            Back to Requested Payouts
          </Button>
        </div>
      </Card>
    );
  }

  function flash(text, tone = "success") {
    clearTimeout(flashTimer.current);
    setBanner({ text, tone });
    flashTimer.current = setTimeout(() => setBanner(null), 3500);
  }

  const unavailable = (feature) => flash(`${feature} is not available yet.`, "info");

  async function copy(value, message) {
    if (!navigator.clipboard) { unavailable("Copying to the clipboard"); return; }
    try { await navigator.clipboard.writeText(value); flash(message); }
    catch { flash("Could not copy to the clipboard.", "danger"); }
  }

  async function openDocument(document) {
    if (operationPending.current || busy) return;
    if (!document.url) { unavailable("Payout document download"); return; }
    operationPending.current = true;
    try { downloadPayoutFile(await readDocument({ id: r.id, source: r.source, url: document.url }, false).unwrap()); }
    catch (error) { flash(getApiErrorMessage(error), "danger"); }
    finally { operationPending.current = false; }
  }

  async function downloadStatement() {
    if (operationPending.current || busy) return;
    setMenu(false); operationPending.current = true;
    try { downloadPayoutFile(await readStatement({ id: r.id, source: r.source }, false).unwrap()); }
    catch (error) { flash(getApiErrorMessage(error), "danger"); }
    finally { operationPending.current = false; }
  }

  async function handleApprove() {
    if (operationPending.current || busy || !r.canApprove) return;
    operationPending.current = true;
    try {
      const result = await approveWithdrawal({ id: r.id, source: r.source, adminRemark: remark }).unwrap();
      flash(result.message);
    } catch (error) {
      flash(getApiErrorMessage(error), "danger");
    } finally {
      operationPending.current = false;
    }
  }

  async function handleDisapproveSubmit() {
    if (operationPending.current || busy || !r.canReject) return;
    operationPending.current = true;
    try {
      const result = await rejectWithdrawal({ id: r.id, source: r.source, reason: remark }).unwrap();
      setModal(null); setRemark(""); flash(result.message);
    } catch (error) { setModal(null); flash(getApiErrorMessage(error), "danger"); }
    finally { operationPending.current = false; }
  }

  async function handleRequestInfoSubmit() {
    if (operationPending.current || busy || !note.trim()) return;
    operationPending.current = true;
    try {
      const result = await requestInfo({ id: r.id, source: r.source, message: note }).unwrap();
      setModal(null); setNote(""); flash('Information request status: ' + result.status);
    } catch (error) { flash(getApiErrorMessage(error), "danger"); }
    finally { operationPending.current = false; }
  }

  async function handleIssueSubmit() {
    if (operationPending.current || busy || !note.trim()) return;
    operationPending.current = true;
    try {
      const result = await raiseIssue({ id: r.id, source: r.source, note }).unwrap();
      setModal(null); setNote(""); flash('Payout issue status: ' + result.status);
    } catch (error) { flash(getApiErrorMessage(error), "danger"); }
    finally { operationPending.current = false; }
  }

  async function handleNotesSubmit() {
    if (operationPending.current || busy) return;
    operationPending.current = true;
    try {
      await saveNotes({ id: r.id, source: r.source, note }).unwrap();
      setModal(null); setNote(""); flash("Notes saved.");
    } catch (error) { flash(getApiErrorMessage(error), "danger"); }
    finally { operationPending.current = false; }
  }

  async function handleRefundSubmit() {
    const value = Number(refundAmount);
    if (!value || value <= 0) return;
    setModal(null); unavailable("Creating a payout refund");
  }

  const [tileBg, tileFg, tileIcon] =
    TILE_TINT[r.status] || TILE_TINT["Pending Review"];
  const isDriver = r.partyType === "driver";
  const docs = showAllDocs ? r.documents : r.documents.slice(0, 2);

  // -------------------------------------------------------------------
  // Completed — Payout Details (093)
  // -------------------------------------------------------------------
  if (r.status === "Completed") {
    const payoutSteps = r.payoutSteps;
    const activity = r.activity;

    return (
      <>
        <PageHeader
          crumbs={["Business & Finance", "Payouts", r.id]}
          title="Payout Details"
          description="View complete information about this payout, including beneficiary, source, and transaction details."
          actions={
            <>
              <Button
                variant="outline"
                icon="printer"
                onClick={() => window.print()}
              >
                Print
              </Button>
              <Button
                variant="outline"
                icon="share-2"
                onClick={() => {
                  copy(window.location.href, "Link copied to clipboard.");
                }}
              >
                Share
              </Button>
              <span style={{ position: "relative" }}>
                <Button
                  variant="secondary"
                  iconRight="ellipsis-vertical"
                  onClick={() => setMenu((m) => !m)}
                />
                {menu && (
                  <span
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 44,
                      zIndex: 30,
                    }}
                    onMouseLeave={() => setMenu(false)}
                  >
                    <DropdownMenu
                      width={220}
                      items={[
                        {
                          label: "Copy Payout ID",
                          icon: "copy",
                          onClick: () => {
                            copy(r.id, "Payout ID copied.");
                            setMenu(false);
                          },
                        },
                        {
                          label: "Download Statement",
                          icon: "file-text",
                          onClick: downloadStatement,
                        },
                      ]}
                    />
                  </span>
                )}
              </span>
            </>
          }
        />

        {banner && <Banner tone={banner.tone} title={banner.text} />}

        <Card style={{ display: "grid", gap: 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) minmax(220px, 320px)",
              gap: 24,
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{ display: "flex", alignItems: "flex-start", gap: 14 }}
              >
                <span
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "var(--tk-r-lg)",
                    background: tileBg,
                    color: tileFg,
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                  }}
                >
                  <Icon name={tileIcon} size={24} />
                </span>
                <div style={{ display: "grid", gap: 6 }}>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  <div
                    style={{
                      font: "700 30px/36px var(--tk-font-sans)",
                      color: "var(--tk-ink-900)",
                    }}
                  >
                    {formatNaira(r.amount)}
                  </div>
                </div>
              </div>
              <div>
                <div
                  style={{
                    font: "600 15px/22px var(--tk-font-sans)",
                    color: "var(--tk-ink-900)",
                  }}
                >
                  {r.description}
                </div>
                <div className="tk-meta" style={{ marginTop: 3 }}>
                  {r.descriptionNote}
                </div>
              </div>
            </div>
            <div>
              <LabelValue
                label="Payout ID"
                value={
                  <CopyableId
                    id={r.id}
                    onCopy={(id) => copy(id, `${id} copied.`)}
                  />
                }
              />
              <LabelValue
                label="Date & Time"
                value={`${r.dateRequested}, ${r.dateRequestedTime}`}
              />
              <LabelValue
                label="Status"
                value={<Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>}
              />
              <LabelValue label="Payout Type" value={r.type} />
              <LabelValue
                label="Related Settlement"
                value={
                  r.relatedSettlement ? (
                    <Link
                      to={`/settlements/detail?id=${encodeURIComponent(r.relatedSettlement)}`}
                      className="tk-mono"
                    >
                      {r.relatedSettlement}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <LabelValue
                label="Related Transaction"
                value={
                  r.relatedTransaction ? (
                    <Link
                      to={payoutTransactionUrl(r.relatedTransaction)}
                      className="tk-mono"
                    >
                      {r.relatedTransaction}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
            </div>
          </div>
        </Card>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 380px",
            gap: "var(--tk-grid-gap)",
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: "var(--tk-grid-gap)" }}>
            <SectionCard
              title="Beneficiary Information"
              pad="none"
              style={{ padding: "4px var(--tk-card-pad) 8px" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                  }}
                >
                  <Avatar name={r.requester.name} size={44} />
                  <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        style={{
                          font: "600 14px/20px var(--tk-font-sans)",
                          color: "var(--tk-ink-900)",
                        }}
                      >
                        {r.requester.name}
                      </span>
                      <Badge>{r.requester.idBadge}</Badge>
                    </span>
                    <span className="tk-meta">{r.requester.phone}</span>
                    <span className="tk-meta">{r.requester.email}</span>
                  </div>
                </div>
                <div>
                  {!isDriver && (
                    <LabelValue
                      label="Company"
                      value={
                        r.companyId ? <Link
                          to={payoutCompanyUrl(r.companyId)}
                        >
                          {r.companyName || r.party}
                        </Link> : "—"
                      }
                    />
                  )}
                  <LabelValue label="Bank Name" value={r.payment.bank} />
                  <LabelValue
                    label="Account Number"
                    value={
                      <span className="tk-mono">{r.payment.accountNumber}</span>
                    }
                  />
                  <LabelValue
                    label="Account Name"
                    value={r.payment.accountName}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Job / Trip Information">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                }}
              >
                <div>
                  <LabelValue
                    label="Job ID"
                    value={
                      r.jobId ? <Link to={payoutJobUrl(r.jobId)} className="tk-mono">
                        {r.jobId}
                      </Link> : <span className="tk-mono">—</span>
                    }
                  />
                  <LabelValue
                    label="Trip ID"
                    value={<span className="tk-mono">{r.job.tripId}</span>}
                  />
                  <LabelValue label="Route" value={r.job.route} />
                  <LabelValue
                    label="Truck"
                    value={<span className="tk-mono">{r.job.truck}</span>}
                  />
                </div>
                <div>
                  <LabelValue label="Cargo Type" value={r.job.cargoType} />
                  <LabelValue label="Customer" value={r.job.customer} />
                </div>
              </div>
            </SectionCard>

            <TripAllocation payout={r} />

            <SectionCard
              title="Payout Breakdown"
              action={
                r.relatedSettlement && (
                  <Link to={`/settlements/detail?id=${encodeURIComponent(r.relatedSettlement)}`}>
                    View Settlement →
                  </Link>
                )
              }
            >
              {r.breakdown.map((b) => (
                <BreakdownRow key={b.label} label={b.label} value={b.value} />
              ))}
              {!r.breakdown.length && "—"}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginTop: 6,
                  padding: "10px 12px",
                  borderRadius: "var(--tk-r-sm)",
                  background: "var(--tk-surface-cool)",
                }}
              >
                <span
                  style={{
                    font: "600 14px/20px var(--tk-font-sans)",
                    color: "var(--tk-ink-900)",
                  }}
                >
                  Net Payout Amount
                </span>
                <span
                  style={{
                    font: "700 16px/22px var(--tk-font-sans)",
                    color: "var(--tk-ink-900)",
                  }}
                >
                  {formatNaira(r.netAmount)}
                </span>
              </div>
            </SectionCard>

            <SectionCard title="Payment Method">
              <LabelValue label="Method" value={r.payment.method} />
              <LabelValue label="Bank" value={r.payment.bank} />
              <LabelValue
                label="Account Number"
                value={
                  <span className="tk-mono">{r.payment.accountNumber}</span>
                }
              />
              <LabelValue label="Account Name" value={r.payment.accountName} />
              <LabelValue
                label="Reference"
                value={
                  <span className="tk-mono">{r.reference}</span>
                }
              />
            </SectionCard>

            <SectionCard
              title="Notes"
              action={
                <Button
                  variant="ghost"
                  icon="pencil"
                  onClick={() => { setNote(r.notes === "—" ? "" : r.notes); setModal("notes"); }}
                >
                  Edit
                </Button>
              }
            >
              <span className="tk-body">{r.notes}</span>
            </SectionCard>
          </div>

          <div
            style={{
              display: "grid",
              gap: "var(--tk-grid-gap)",
              alignContent: "start",
            }}
          >
            <SectionCard title="Payout Status">
              <StatusStepper steps={payoutSteps} />
              <Banner
                tone="success"
                style={{ marginTop: 14 }}
                title="Payout Completed"
              >
                {r.descriptionNote}
              </Banner>
            </SectionCard>

            <SectionCard
              title="Related Records"
              action={
                <a href="#" onClick={(e) => e.preventDefault()}>
                  View All
                </a>
              }
            >
              {r.relatedSettlement && (
                <RelatedRecordRow
                  icon="coins"
                  id={r.relatedSettlement}
                  description="—"
                  status="—"
                  to={`/settlements/detail?id=${encodeURIComponent(r.relatedSettlement)}`}
                />
              )}
              {r.relatedTransaction && (
                <RelatedRecordRow
                  icon="repeat"
                  id={r.relatedTransaction}
                  description="—"
                  status="—"
                  to={payoutTransactionUrl(r.relatedTransaction)}
                />
              )}
              {r.escrowId && (
                <RelatedRecordRow
                  icon="lock"
                  id={r.escrowId}
                  description="—"
                  status="—"
                  to={`/escrow/detail?id=${encodeURIComponent(r.escrowId)}`}
                />
              )}
              {r.jobId && <RelatedRecordRow
                icon="package"
                id={r.jobId}
                description={r.job.route}
                status={r.job.status}
                to={payoutJobUrl(r.jobId)}
              />}
              {r.job.tripId !== "—" && <RelatedRecordRow
                icon="radio-tower"
                id={r.job.tripId}
                description={r.job.route}
                status={r.job.status}
              />}
              {!r.relatedSettlement && !r.relatedTransaction && !r.escrowId && !r.jobId && r.job.tripId === "—" && "—"}
            </SectionCard>

            <SectionCard
              title="Activity Timeline"
              action={
                <a href="#" onClick={(e) => e.preventDefault()}>
                  View All
                </a>
              }
            >
              {activity.length ? <Timeline items={activity} /> : "—"}
            </SectionCard>

            <SectionCard title="Actions">
              <div style={{ display: "grid", gap: 10 }}>
                <Button icon="flag" fullWidth onClick={() => setModal("issue")}>
                  Raise an Issue
                </Button>
                <Button
                  variant="outline"
                  icon="rotate-ccw"
                  fullWidth
                  disabled
                  onClick={() => {
                    setRefundAmount(r.amount == null ? "" : String(r.amount));
                    setModal("refund");
                  }}
                >
                  Create Refund
                </Button>
                <Button
                  variant="outline"
                  icon="list"
                  fullWidth
                  disabled={!r.relatedSettlement}
                  onClick={() =>
                    r.relatedSettlement &&
                    navigate(`/settlements/detail?id=${encodeURIComponent(r.relatedSettlement)}`)
                  }
                >
                  View Settlement
                </Button>
              </div>
              {r.issueNotes?.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: "1px solid var(--tk-line)",
                  }}
                >
                  {r.issueNotes.map((n, i) => (
                    <div key={i} style={{ display: "grid", gap: 2 }}>
                      <span
                        style={{
                          font: "500 12px/17px var(--tk-font-sans)",
                          color: "var(--tk-ink-700)",
                        }}
                      >
                        {n.note}
                      </span>
                      <span className="tk-meta">{n.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        <Modal
          open={modal === "issue"}
          onClose={() => setModal(null)}
          title="Raise an Issue"
          description={`Flag ${r.id} for the finance team to review.`}
          footer={
            <>
              <Button variant="outline" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={busy || !note.trim()}
                onClick={handleIssueSubmit}
              >
                {busy ? "Submitting…" : "Submit Report"}
              </Button>
            </>
          }
        >
          <Textarea
            label="Describe the issue"
            rows={4}
            maxLength={280}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Wrong account credited, amount mismatch…"
          />
        </Modal>

        <Modal open={modal === "notes"} onClose={() => { if (!operationPending.current) setModal(null); }}
          title="Edit Notes"
          footer={<>
            <Button variant="outline" disabled={busy} onClick={() => setModal(null)}>Cancel</Button>
            <Button disabled={busy} onClick={handleNotesSubmit}>{busy ? "Saving…" : "Save"}</Button>
          </>}>
          <Textarea label="Notes" rows={4} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} />
        </Modal>

        <Modal
          open={modal === "refund"}
          onClose={() => setModal(null)}
          title="Create Refund"
          description={`Issue a refund against ${r.id}.`}
          footer={
            <>
              <Button variant="outline" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button
                disabled={
                  busy || !Number(refundAmount) || Number(refundAmount) <= 0
                }
                onClick={handleRefundSubmit}
              >
                {busy ? "Processing…" : "Create Refund"}
              </Button>
            </>
          }
        >
          <TextField
            label="Refund Amount (₦)"
            required
            type="number"
            min="1"
            max={r.amount}
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
          />
        </Modal>
      </>
    );
  }

  // -------------------------------------------------------------------
  // Pending / Approved / Processing / Rejected — Payout Request Details (092)
  // -------------------------------------------------------------------
  const approvalSteps = r.approvalSteps;
  const activity = r.activity;

  const canReview = r.status === "Pending Review" || r.status === "Processing";

  return (
    <>
      <PageHeader
        crumbs={["Business & Finance", "Payouts", "Requested Payouts", r.id]}
        title="Payout Request Details"
        description="Review the payout request, verify all information and take action."
      />

      {banner && <Banner tone={banner.tone} title={banner.text} />}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 380px",
          gap: "var(--tk-grid-gap)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "var(--tk-grid-gap)" }}>
          <Card style={{ display: "grid", gap: 0 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) minmax(220px, 320px)",
                gap: 24,
                alignItems: "start",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "flex-start", gap: 14 }}
              >
                <span
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "var(--tk-r-lg)",
                    background: tileBg,
                    color: tileFg,
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                  }}
                >
                  <Icon name={tileIcon} size={24} />
                </span>
                <div style={{ display: "grid", gap: 6 }}>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  <div
                    style={{
                      font: "700 26px/32px var(--tk-font-sans)",
                      color: "var(--tk-ink-900)",
                    }}
                  >
                    {formatNaira(r.amount)}
                  </div>
                  <div
                    style={{
                      font: "600 14px/20px var(--tk-font-sans)",
                      color: "var(--tk-ink-700)",
                    }}
                  >
                    {r.description}
                  </div>
                  <span className="tk-meta">
                    Requested on {r.dateRequested} at {r.dateRequestedTime}
                  </span>
                </div>
              </div>
              <div>
                <LabelValue
                  label="Payout ID"
                  value={
                    <CopyableId
                      id={r.id}
                      onCopy={(id) => copy(id, `${id} copied.`)}
                    />
                  }
                />
                <LabelValue label="Request Type" value={r.type} />
                <LabelValue
                  label="Status"
                  value={<Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>}
                />
                <LabelValue
                  label="Related Settlement"
                  value={
                    r.relatedSettlement ? (
                      <Link
                        to={`/settlements/detail?id=${encodeURIComponent(r.relatedSettlement)}`}
                        className="tk-mono"
                      >
                        {r.relatedSettlement}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <LabelValue
                  label="Related Transaction"
                  value={
                    r.relatedTransaction ? (
                      <Link
                        to={payoutTransactionUrl(r.relatedTransaction)}
                        className="tk-mono"
                      >
                        {r.relatedTransaction}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <LabelValue
                  label="Requested By"
                  value={`${r.requestedBy} (${r.requestedByRole})`}
                />
                <LabelValue
                  label="Date Requested"
                  value={`${r.dateRequested}, ${r.dateRequestedTime}`}
                />
              </div>
            </div>
          </Card>

          <SectionCard
            title="Requester Information"
            pad="none"
            style={{ padding: "4px var(--tk-card-pad) 8px" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                }}
              >
                <Avatar name={r.requester.name} size={44} />
                <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        font: "600 14px/20px var(--tk-font-sans)",
                        color: "var(--tk-ink-900)",
                      }}
                    >
                      {r.requester.name}
                    </span>
                    <Badge>{r.requester.idBadge}</Badge>
                  </span>
                  <span className="tk-meta">{r.requester.role}</span>
                  <span className="tk-meta">{r.requester.phone}</span>
                  <span className="tk-meta">{r.requester.email}</span>
                </div>
              </div>
              <div>
                <LabelValue
                  label={isDriver ? "Driver Status" : "Company Status"}
                  value={<Badge>{r.requester.status}</Badge>}
                />
                <LabelValue
                  label="Rating"
                  value={
                    typeof r.requester.rating === "number"
                      ? `${r.requester.rating} / 5`
                      : r.requester.rating
                  }
                />
                <LabelValue
                  label="Total Trips"
                  value={r.requester.totalTrips}
                />
                <LabelValue
                  label="Company (if any)"
                  value={
                    r.companyId ? (
                      <Link
                        to={payoutCompanyUrl(r.companyId)}
                      >
                        {r.requester.company}
                      </Link>
                    ) : (
                      r.requester.company
                    )
                  }
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Job / Trip Information">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div>
                <LabelValue
                  label="Job ID"
                  value={
                    r.jobId ? <Link to={payoutJobUrl(r.jobId)} className="tk-mono">
                      {r.jobId}
                    </Link> : <span className="tk-mono">—</span>
                  }
                />
                <LabelValue
                  label="Trip ID"
                  value={<span className="tk-mono">{r.job.tripId}</span>}
                />
                <LabelValue label="Route" value={r.job.route} />
                <LabelValue
                  label="Truck"
                  value={<span className="tk-mono">{r.job.truck}</span>}
                />
              </div>
              <div>
                <LabelValue label="Customer" value={r.job.customer} />
                <LabelValue label="Cargo Type" value={r.job.cargoType} />
                <LabelValue label="Trip Dates" value={r.job.tripDates} />
                <LabelValue
                  label="Status"
                  value={<Badge tone="success">{r.job.status}</Badge>}
                />
              </div>
            </div>
          </SectionCard>

          <TripAllocation payout={r} />

          <SectionCard
            title="Payout Breakdown"
            action={
              r.relatedSettlement && (
                <Link to={`/settlements/detail?id=${encodeURIComponent(r.relatedSettlement)}`}>
                  View Settlement →
                </Link>
              )
            }
          >
            {r.breakdown.map((b) => (
              <BreakdownRow key={b.label} label={b.label} value={b.value} />
            ))}
            {!r.breakdown.length && "—"}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginTop: 6,
                padding: "10px 12px",
                borderRadius: "var(--tk-r-sm)",
                background: "var(--tk-surface-cool)",
              }}
            >
              <span
                style={{
                  font: "600 14px/20px var(--tk-font-sans)",
                  color: "var(--tk-ink-900)",
                }}
              >
                Net Payout Amount
              </span>
              <span
                style={{
                  font: "700 16px/22px var(--tk-font-sans)",
                  color: "var(--tk-ink-900)",
                }}
              >
                {formatNaira(r.netAmount)}
              </span>
            </div>
          </SectionCard>

          <SectionCard title="Payment Details">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <LabelValue label="Payout Method" value={r.payment.method} />
              <LabelValue label="Bank Name" value={r.payment.bank} />
              <LabelValue
                label="Account Number"
                value={
                  <span className="tk-mono">{r.payment.accountNumber}</span>
                }
              />
              <LabelValue label="Account Name" value={r.payment.accountName} />
            </div>
          </SectionCard>

          <SectionCard title="Requester's Notes">
            <span className="tk-body">{r.notes}</span>
          </SectionCard>
        </div>

        <div
          style={{
            display: "grid",
            gap: "var(--tk-grid-gap)",
            alignContent: "start",
          }}
        >
          <SectionCard title="Approval Status">
            <StatusStepper steps={approvalSteps} />
          </SectionCard>

          <SectionCard
            title="Documents"
            action={
              r.documents.length > 2 && (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowAllDocs((s) => !s);
                  }}
                >
                  {showAllDocs
                    ? "Show Less"
                    : `View All (${r.documents.length})`}
                </a>
              )
            }
          >
            <div style={{ display: "grid", gap: 10 }}>
              {docs.map((d) => (
                <div
                  key={d.name}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <AttachmentCard
                    name={d.name}
                    size={d.file}
                    kind={d.kind}
                    onOpen={() => openDocument(d)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="ghost"
                    icon="download"
                    onClick={() => openDocument(d)}
                  />
                </div>
              ))}
              {!docs.length && "—"}
            </div>
          </SectionCard>

          <SectionCard title="Activity Timeline">
            {activity.length ? <Timeline items={activity} /> : "—"}
          </SectionCard>

          <SectionCard title="Admin Remarks (Optional)">
            <Textarea
              rows={3}
              placeholder="Add a note about your decision..."
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </SectionCard>

          <SectionCard title="Actions">
            {canReview ? (
              <div style={{ display: "grid", gap: 10 }}>
                <Button
                  icon="circle-check"
                  fullWidth
                  disabled={busy || !r.canApprove}
                  onClick={handleApprove}
                >
                  {busy
                    ? "Processing…"
                    : r.canApprove
                      ? "Approve Payout"
                      : "Approval Blocked"}
                </Button>
                {r.approvalReady === false && r.partyType === "company" && (
                  <span className="tk-meta">
                    Review bank details, reserved wallet funds and open issues before approving
                    this payout.
                  </span>
                )}
                <Button
                  variant="danger"
                  icon="x"
                  fullWidth
                  disabled={busy || !r.canReject}
                  onClick={() => setModal("disapprove")}
                >
                  Disapprove
                </Button>
                <Button
                  variant="outline"
                  icon="message-square"
                  fullWidth
                  onClick={() => setModal("requestInfo")}
                >
                  Request More Info
                </Button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <Banner
                  tone={r.status === "Rejected" ? "danger" : "info"}
                  title={
                    r.status === "Rejected"
                      ? "Payout Rejected"
                      : `Payout ${r.status}`
                  }
                >
                  {r.status === "Rejected"
                    ? r.adminRemark ?? "—"
                    : r.descriptionNote}
                </Banner>
                <Button
                  variant="outline"
                  icon="arrow-left"
                  fullWidth
                  onClick={() => navigate("/payouts")}
                >
                  Back to Requested Payouts
                </Button>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <Modal
        open={modal === "disapprove"}
        onClose={() => setModal(null)}
        title="Disapprove Payout"
        description={`Reject ${r.id} and notify the requester.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy || !r.canReject}
              onClick={handleDisapproveSubmit}
            >
              {busy ? "Processing…" : "Disapprove Payout"}
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason (optional)"
          rows={4}
          maxLength={280}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="e.g. Proof of delivery does not match trip manifest…"
        />
      </Modal>

      <Modal
        open={modal === "requestInfo"}
        onClose={() => setModal(null)}
        title="Request More Info"
        description={`Ask the requester for more details on ${r.id}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !note.trim()}
              onClick={handleRequestInfoSubmit}
            >
              {busy ? "Sending…" : "Send Request"}
            </Button>
          </>
        }
      >
        <Textarea
          label="What's missing?"
          rows={4}
          maxLength={280}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Please upload the signed delivery note…"
        />
      </Modal>
    </>
  );
}
