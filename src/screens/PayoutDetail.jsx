"use client";

import { useState } from "react";
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
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import {
  approvePayoutRequest,
  disapprovePayoutRequest,
  requestPayoutInfo,
  raisePayoutIssue,
  createPayoutRefund,
} from "../mock/api.js";
import { formatNaira } from "../mock/format.js";
import { normalizePayouts } from "../domain/payouts.js";

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

const APPROVAL_STEPS = ["Submitted", "Under Review", "Approved", "Processed"];
const APPROVAL_STATE = {
  "Pending Review": ["done", "current", "pending", "pending"],
  Approved: ["done", "done", "done", "pending"],
  Rejected: ["done", "done", "danger", "pending"],
  Processing: ["done", "done", "done", "current"],
  Completed: ["done", "done", "done", "done"],
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
        {formatNaira(Math.abs(value))}
      </span>
    </div>
  );
}

function TripAllocation({ payout }) {
  if (payout.partyType !== "company") return null;
  return (
    <SectionCard
      title={`Trip Allocation (${payout.allocations?.length || 0})`}
      description="The company is paid once for the job, with the gross amount allocated across its truck trips."
    >
      <div style={{ display: "grid", gap: "var(--tk-space-2)" }}>
        {(payout.allocations || []).map((allocation) => (
          <div
            key={allocation.tripId}
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
              <Link
                to={`/jobs/${allocation.jobId || payout.jobId}?tripId=${allocation.tripId}`}
                className="tk-mono"
              >
                {allocation.tripId}
              </Link>
              <span className="tk-meta" style={{ display: "block" }}>
                {allocation.trip?.truckPlate || "Truck not resolved"}
              </span>
            </span>
            <span>
              <span className="tk-label">
                {allocation.trip?.driverName || "Driver not resolved"}
              </span>
              <span className="tk-meta" style={{ display: "block" }}>
                {allocation.trip?.status || "Legacy reference"}
              </span>
            </span>
            <strong>{formatNaira(allocation.amount)}</strong>
          </div>
        ))}
      </div>
      <Banner
        tone={payout.approvalReady ? "success" : "warning"}
        style={{ marginTop: "var(--tk-space-3)" }}
        title={
          payout.approvalReady
            ? "Ready for approval"
            : `Payment held — ${payout.eligibility}`
        }
      >
        {payout.reconciliation?.ok
          ? "Gross allocations and net payout reconcile."
          : payout.reconciliation?.issues?.join(" ")}
      </Banner>
    </SectionCard>
  );
}

export function PayoutDetail() {
  const { payoutId } = useParams();
  const navigate = useNavigate();
  const payoutRows = useCollection("payoutRequests") || [];
  const jobs = useCollection("jobs") || [];
  const rows = normalizePayouts(payoutRows, jobs);
  const r = rows.find((x) => x.id === payoutId);

  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(null);
  const [remark, setRemark] = useState("");
  const [note, setNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [showAllDocs, setShowAllDocs] = useState(false);

  if (!r) {
    return (
      <Card>
        <span className="tk-body">No payout found with ID {payoutId}.</span>
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
    setBanner({ text, tone });
    setTimeout(() => setBanner(null), 3500);
  }

  async function handleApprove() {
    setBusy(true);
    try {
      await approvePayoutRequest(r.id);
      flash(`${r.id} approved and paid out.`);
    } catch (error) {
      flash(
        error.message || "This payout is not ready for approval.",
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDisapproveSubmit() {
    setBusy(true);
    await disapprovePayoutRequest(r.id, remark.trim());
    setBusy(false);
    setModal(null);
    setRemark("");
    flash(`${r.id} disapproved.`);
  }

  async function handleRequestInfoSubmit() {
    if (!note.trim()) return;
    setBusy(true);
    await requestPayoutInfo(r.id, note.trim());
    setBusy(false);
    setModal(null);
    setNote("");
    flash("Requester notified — more information requested.");
  }

  async function handleIssueSubmit() {
    if (!note.trim()) return;
    setBusy(true);
    await raisePayoutIssue(r.id, note.trim());
    setBusy(false);
    setModal(null);
    setNote("");
    flash("Issue raised. Our finance team will review this payout.");
  }

  async function handleRefundSubmit() {
    const value = Number(refundAmount);
    if (!value || value <= 0) return;
    setBusy(true);
    await createPayoutRefund(r.id, value);
    setBusy(false);
    setModal(null);
    setRefundAmount("");
    flash(`Refund of ${formatNaira(value)} created against ${r.id}.`);
  }

  const [tileBg, tileFg, tileIcon] =
    TILE_TINT[r.status] || TILE_TINT["Pending Review"];
  const isDriver = r.partyType === "driver";
  const docs = showAllDocs ? r.documents : r.documents.slice(0, 2);

  // -------------------------------------------------------------------
  // Completed — Payout Details (093)
  // -------------------------------------------------------------------
  if (r.status === "Completed") {
    const payoutSteps = [
      {
        title: "Initiated",
        time: `${r.dateRequested} ${r.dateRequestedTime}`,
        state: "done",
        icon: "check",
      },
      { title: "Approved", time: r.approvedOn, state: "done", icon: "check" },
      { title: "Processing", time: r.approvedOn, state: "done", icon: "check" },
      { title: "Completed", time: r.processedOn, state: "done", icon: "check" },
    ];

    const activity = [
      {
        title: "Payout initiated",
        time: `${r.dateRequested} ${r.dateRequestedTime}`,
        description: "System created payout request.",
        state: "done",
        icon: "check",
      },
      {
        title: "Payout approved",
        time: r.approvedOn,
        description: "Approved by Trukkas Admin.",
        state: "done",
        icon: "check",
      },
      {
        title: "Payment processing",
        time: r.approvedOn,
        description: `Funds sent to ${r.payment.bank}.`,
        state: "done",
        icon: "banknote",
      },
      {
        title: "Payout completed",
        time: r.processedOn,
        description: `${isDriver ? "Driver's" : "Company's"} account credited successfully.`,
        state: "done",
        icon: "check",
      },
    ];

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
                  navigator.clipboard?.writeText(
                    typeof window !== "undefined" ? window.location.href : r.id,
                  );
                  flash("Link copied to clipboard.");
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
                            navigator.clipboard?.writeText(r.id);
                            setMenu(false);
                            flash("Payout ID copied.");
                          },
                        },
                        {
                          label: "Download Statement",
                          icon: "file-text",
                          onClick: () => {
                            setMenu(false);
                            flash("Preparing statement…");
                          },
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
                  {isDriver
                    ? "Final payout to driver"
                    : "Final payout to company"}{" "}
                  for {r.jobId}
                </div>
                <div className="tk-meta" style={{ marginTop: 3 }}>
                  Funds released from escrow to{" "}
                  {isDriver ? "driver's" : "company's"} wallet ({r.payment.bank}
                  ).
                </div>
              </div>
            </div>
            <div>
              <LabelValue
                label="Payout ID"
                value={
                  <CopyableId
                    id={r.id}
                    onCopy={(id) => flash(`${id} copied.`)}
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
                      to={`/settlements/${r.relatedSettlement}`}
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
                      to={`/transactions/${r.relatedTransaction}`}
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
                        <Link
                          to={`/companies/${encodeURIComponent(r.companyId || r.partyId)}?tab=payouts`}
                        >
                          {r.companyName || r.party}
                        </Link>
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
                      <Link to={`/jobs/${r.jobId}`} className="tk-mono">
                        {r.jobId}
                      </Link>
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
                  <Link to={`/settlements/${r.relatedSettlement}`}>
                    View Settlement →
                  </Link>
                )
              }
            >
              {r.breakdown.map((b) => (
                <BreakdownRow key={b.label} label={b.label} value={b.value} />
              ))}
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
                  {formatNaira(r.amount)}
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
                  <span className="tk-mono">PAYOUT-{r.id.split("-")[1]}</span>
                }
              />
            </SectionCard>

            <SectionCard
              title="Notes"
              action={
                <Button
                  variant="ghost"
                  icon="pencil"
                  onClick={() =>
                    flash("Notes editing is not available in this preview.")
                  }
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
                {`Funds have been successfully paid to the ${isDriver ? "driver's" : "company's"} bank account.`}
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
                  description={`Final settlement for ${r.jobId}`}
                  status="Completed"
                  to={`/settlements/${r.relatedSettlement}`}
                />
              )}
              {r.relatedTransaction && (
                <RelatedRecordRow
                  icon="repeat"
                  id={r.relatedTransaction}
                  description={`Escrow release to ${isDriver ? "driver" : "company"} (${formatNaira(r.amount)})`}
                  status="Completed"
                  to={`/transactions/${r.relatedTransaction}`}
                />
              )}
              {r.escrowId && (
                <RelatedRecordRow
                  icon="lock"
                  id={r.escrowId}
                  description={`Escrow for ${r.jobId}`}
                  status="Completed"
                  to={`/escrow/${r.escrowId}`}
                />
              )}
              <RelatedRecordRow
                icon="package"
                id={r.jobId}
                description={r.job.route}
                status="Completed"
                to={`/jobs/${r.jobId}`}
              />
              <RelatedRecordRow
                icon="radio-tower"
                id={r.job.tripId}
                description={r.job.route}
                status="Completed"
              />
            </SectionCard>

            <SectionCard
              title="Activity Timeline"
              action={
                <a href="#" onClick={(e) => e.preventDefault()}>
                  View All
                </a>
              }
            >
              <Timeline items={activity} />
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
                  onClick={() => {
                    setRefundAmount(String(r.amount));
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
                    navigate(`/settlements/${r.relatedSettlement}`)
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
  const approvalStates =
    APPROVAL_STATE[r.status] || APPROVAL_STATE["Pending Review"];
  const approvalIcons = [
    "check",
    "search",
    r.status === "Rejected" ? "x" : "check",
    "banknote",
  ];
  const approvalSteps = APPROVAL_STEPS.map((title, i) => ({
    title:
      i === 2 ? (r.status === "Rejected" ? "Rejected" : "Approved") : title,
    state: approvalStates[i],
    icon: approvalIcons[i],
  }));

  const activity = [
    {
      title: "Payout request submitted",
      time: `${r.dateRequested} ${r.dateRequestedTime}`,
      description: `Requested by ${r.requestedBy}.`,
      state: "done",
      icon: "check",
    },
    {
      title:
        r.status === "Rejected"
          ? "Disapproved"
          : r.status === "Pending Review"
            ? "Under review"
            : "Approved",
      description:
        r.status === "Rejected"
          ? r.adminRemark || "Rejected by admin."
          : r.status === "Pending Review"
            ? "Pending admin review."
            : "Approved by admin.",
      state:
        r.status === "Rejected"
          ? "danger"
          : r.status === "Pending Review"
            ? "current"
            : "done",
      icon: r.status === "Rejected" ? "x" : "check",
    },
    {
      title: "Payment processed",
      description:
        r.status === "Processing"
          ? "Payment is being processed."
          : "Awaiting processing.",
      state: r.status === "Processing" ? "current" : "pending",
      icon: "lock-open",
    },
  ];

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
                    {isDriver ? "Driver payout" : "Company payout"} for{" "}
                    {r.jobId}
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
                      onCopy={(id) => flash(`${id} copied.`)}
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
                        to={`/settlements/${r.relatedSettlement}`}
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
                        to={`/transactions/${r.relatedTransaction}`}
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
                    !isDriver ? (
                      <Link
                        to={`/companies/${encodeURIComponent(r.companyId || r.partyId)}?tab=payouts`}
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
                    <Link to={`/jobs/${r.jobId}`} className="tk-mono">
                      {r.jobId}
                    </Link>
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
                <Link to={`/settlements/${r.relatedSettlement}`}>
                  View Settlement →
                </Link>
              )
            }
          >
            {r.breakdown.map((b) => (
              <BreakdownRow key={b.label} label={b.label} value={b.value} />
            ))}
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
                {formatNaira(r.amount)}
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
                    onOpen={() => flash(`Downloading ${d.file}…`)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="ghost"
                    icon="download"
                    onClick={() => flash(`Downloading ${d.file}…`)}
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Activity Timeline">
            <Timeline items={activity} />
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
                  disabled={busy || !r.approvalReady}
                  onClick={handleApprove}
                >
                  {busy
                    ? "Processing…"
                    : r.approvalReady
                      ? "Approve Payout"
                      : "Approval Blocked"}
                </Button>
                {!r.approvalReady && r.partyType === "company" && (
                  <span className="tk-meta">
                    Complete and reconcile every included trip before approving
                    this payout.
                  </span>
                )}
                <Button
                  variant="danger"
                  icon="x"
                  fullWidth
                  disabled={busy}
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
                    ? r.adminRemark || "This request has been disapproved."
                    : "No further action needed right now."}
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
              disabled={busy}
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
