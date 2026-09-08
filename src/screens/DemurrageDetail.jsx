"use client";
import { useState } from "react";
import { useNavigate, useParams } from "../router.js";
import {
  PageHeader,
  Button,
  Card,
  SectionCard,
  Tabs,
  Badge,
  Icon,
  DataTable,
  DropdownMenu,
  Modal,
  Textarea,
  Select,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { updateDemurrage } from "../mock/api.js";
import "./Demurrage.css";
const money = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });
function download(name, text) {
  const u = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
}
export function DemurrageDetail() {
  const navigate = useNavigate(),
    { demurrageId } = useParams(),
    rows = useCollection("demurrage") || [],
    r = rows.find((x) => x.id === demurrageId),
    [tab, setTab] = useState("Overview"),
    [menu, setMenu] = useState(false),
    [note, setNote] = useState(r?.note || ""),
    [dispute, setDispute] = useState(false),
    [reason, setReason] = useState("Incorrect charge calculation"),
    [toast, setToast] = useState("");
  function notify(s) {
    setToast(s);
    setTimeout(() => setToast(""), 1600);
  }
  if (!r)
    return (
      <Card>
        <p>Demurrage record not found.</p>
        <Button variant="outline" onClick={() => navigate("/demurrage")}>
          Back to Demurrage
        </Button>
      </Card>
    );
  const subtotal = r.rate * r.daysOver,
    vat = subtotal,
    invoiceRows = [
      {
        id: "INV-2026-000112",
        date: "May 28, 2026",
        period: "May 22 – May 28, 2026",
        days: 7,
        rate: r.rate,
        amount: subtotal,
        status: r.paid ? "Paid" : "Unpaid",
      },
      {
        id: "INV-2026-000111",
        date: "May 22, 2026",
        period: "May 22, 2026",
        days: 1,
        rate: r.rate,
        amount: r.rate,
        status: r.paid ? "Paid" : "Unpaid",
      },
    ];
  async function saveNote() {
    await updateDemurrage(r.id, { note });
    notify("Admin note saved");
  }
  async function raiseDispute() {
    await updateDemurrage(r.id, {
      status: "Dispute",
      note: (r.note ? r.note + "\n" : "") + "Dispute: " + reason,
    });
    setDispute(false);
    notify("Dispute raised");
  }
  return (
    <div className="dem-page">
      <Button
        variant="outline"
        icon="arrow-left"
        style={{ justifySelf: "start" }}
        onClick={() => navigate("/demurrage")}
      >
        Back to Demurrage
      </Button>
      <PageHeader
        crumbs={["Finance", "Demurrage", r.id]}
        title="Demurrage Details"
        description="View demurrage charge information, calculation, and status."
        actions={
          <>
            <Button
              variant="outline"
              icon="download"
              onClick={() =>
                download(
                  r.id + "-invoice.txt",
                  `Demurrage Invoice\n${r.id}\n${r.jobId}\nTotal: ${money(r.charge)}`,
                )
              }
            >
              Download Invoice
            </Button>
            <Button
              variant="outline"
              icon="printer"
              onClick={() => window.print()}
            >
              Print
            </Button>
            <span style={{ position: "relative" }}>
              <Button
                variant="outline"
                iconRight="chevron-down"
                onClick={() => setMenu(!menu)}
              >
                More Actions
              </Button>
              {menu && (
                <span
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 44,
                    zIndex: 30,
                  }}
                >
                  <DropdownMenu
                    width={220}
                    items={[
                      {
                        label: "Mark as Resolved",
                        icon: "circle-check",
                        onClick: () => {
                          updateDemurrage(r.id, {
                            status: "Resolved",
                            paid: r.charge,
                          });
                          setMenu(false);
                          notify("Marked as resolved");
                        },
                      },
                      {
                        label: "Recalculate Charge",
                        icon: "calculator",
                        onClick: () => {
                          updateDemurrage(r.id, {
                            charge: r.rate * r.daysOver * 2,
                          });
                          setMenu(false);
                          notify("Charge recalculated");
                        },
                      },
                      {
                        label: "Email Customer",
                        icon: "mail",
                        onClick: () => {
                          setMenu(false);
                          notify("Invoice emailed to customer");
                        },
                      },
                      { divider: true },
                      {
                        label: "Raise Dispute",
                        icon: "shield-alert",
                        tone: "danger",
                        onClick: () => {
                          setMenu(false);
                          setDispute(true);
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
      <Card pad="none">
        <div className="dem-detail-head">
          <Head
            label="Demurrage ID"
            value={r.id}
            sub={"Reference: " + r.reference}
          />
          <Head label="Job ID" value={r.jobId} sub={r.jobType} link />
          <Head
            label="Status"
            value={
              <Badge
                tone={
                  r.status === "Active"
                    ? "danger"
                    : r.status === "Resolved"
                      ? "success"
                      : "purple"
                }
              >
                {r.status}
              </Badge>
            }
            sub={(r.daysOver || 0) + " days overdue"}
          />
          <Head
            label="Charge Amount"
            value={money(r.charge)}
            sub={money(r.rate) + " / day"}
          />
          <Head
            label="Days Over"
            value={(r.daysOver ?? 0) + " days"}
            sub={r.overSince}
            danger
          />
          <Head label="Customer" value={r.customer} sub={r.customerType} />
        </div>
      </Card>
      <div className="dem-layout">
        <div className="dem-main">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              "Overview",
              "Calculation",
              "Disputes",
              "History",
            ]}
          />
          {tab === "Overview" ? (
            <>
              <div className="dem-overview">
                <SectionCard title="Container & Voyage" icon="inbox">
                  <Row label="Container No." value={r.container} />
                  <Row label="Size / Type" value={r.size} />
                  <Row
                    label="Vessel / Voyage"
                    value={
                      <>
                        {r.vessel}
                        <br />
                        <small>{r.voyage}</small>
                      </>
                    }
                  />
                  <Row label="Discharge Port" value={r.dischargePort} />
                  <Row label="Discharge Date" value={r.dischargeDate} />
                </SectionCard>
                <SectionCard title="Demurrage Rule" icon="clipboard-list">
                  <Row label="Free Days" value={r.freeDays + " days"} />
                  <Row label="Free Period" value={r.freePeriod} />
                  <Row
                    label="Charge Start Date"
                    value={
                      <span style={{ color: "var(--tk-danger)" }}>
                        {r.chargeStart}
                      </span>
                    }
                  />
                  <Row
                    label="Applicable Rate"
                    value={money(r.rate) + " / day"}
                  />
                  <Row label="Rate Type" value="Standard Rate" />
                </SectionCard>
                <SectionCard title="Charge Summary" icon="briefcase-business">
                  <Row label="Charge Start Date" value={r.chargeStart} />
                  <Row
                    label="Total Days Used"
                    value={(r.daysUsed ?? 0) + " days"}
                  />
                  <Row
                    label="Billable Days"
                    value={(r.daysOver ?? 0) + " days"}
                  />
                  <Row label="Daily Rate" value={money(r.rate)} />
                  <hr
                    style={{ border: 0, borderTop: "1px solid var(--tk-line)" }}
                  />
                  <Row label="Subtotal" value={money(subtotal)} />
                  <Row label="VAT (7.5%)" value={money(vat)} />
                  <div className="dem-total">
                    <span>Total Charge</span>
                    <b>{money(r.charge)}</b>
                  </div>
                </SectionCard>
                <SectionCard title="Related Job">
                  <Row
                    label="Job ID"
                    value={
                      <span style={{ color: "var(--tk-blue)" }}>{r.jobId}</span>
                    }
                  />
                  <Row label="Job Type" value={r.jobType} />
                  <Row label="Route" value="Tin Can Port → Apapa Port" />
                  <Row
                    label="Assigned To"
                    value={r.assignedTo || "Speed Line Logistics"}
                  />
                  <Row label="Created On" value="May 12, 2026 · 09:15 AM" />
                  <Button
                    variant="outline"
                    fullWidth
                    style={{ marginTop: 8 }}
                    onClick={() => notify("Related job opened")}
                  >
                    View Job Details
                  </Button>
                </SectionCard>
                <SectionCard title="Parties Involved">
                  <strong style={{ fontSize: 10 }}>Forwarder (Customer)</strong>
                  <Row
                    label={r.customer}
                    value={<Badge tone="success">Verified</Badge>}
                  />
                  <Row
                    label="Email"
                    value={r.customerEmail || "operations@example.com"}
                  />
                  <Row label="Phone" value={r.customerPhone || "—"} />
                  <hr
                    style={{ border: 0, borderTop: "1px solid var(--tk-line)" }}
                  />
                  <strong style={{ fontSize: 10 }}>Shipping Line</strong>
                  <Row
                    label={r.shippingLine || "Mediterranean Shipping Co."}
                    value={<Badge tone="success">Verified</Badge>}
                  />
                  <Row label="Email" value={r.lineEmail || "lagos@msc.com"} />
                  <Row label="Phone" value={r.linePhone || "—"} />
                </SectionCard>
                <SectionCard title="Admin Notes">
                  <textarea
                    className="dem-note"
                    placeholder="Add a note about this demurrage (visible to admins only)..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginTop: 9,
                    }}
                  >
                    <small className="tk-meta">Last updated May 28, 2026</small>
                    <Button
                      size="sm"
                      variant="outline"
                      icon="save"
                      onClick={saveNote}
                    >
                      Save
                    </Button>
                  </div>
                </SectionCard>
              </div>
              <SectionCard title="Recent Demurrage Invoices" pad="none">
                <DataTable
                  rows={invoiceRows}
                  rowKey={(x) => x.id}
                  columns={[
                    {
                      key: "id",
                      header: "Invoice No.",
                      render: (x) => (
                        <span style={{ color: "var(--tk-blue)" }}>{x.id}</span>
                      ),
                    },
                    { key: "date", header: "Invoice Date" },
                    { key: "period", header: "Period" },
                    { key: "days", header: "Days" },
                    {
                      key: "rate",
                      header: "Daily Rate",
                      render: (x) => money(x.rate),
                    },
                    {
                      key: "amount",
                      header: "Amount",
                      render: (x) => money(x.amount),
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (x) => (
                        <Badge
                          tone={x.status === "Paid" ? "success" : "danger"}
                        >
                          {x.status}
                        </Badge>
                      ),
                    },
                    {
                      key: "x",
                      header: "Actions",
                      render: (x) => (
                        <span style={{ display: "flex", gap: 4 }}>
                          <Button
                            variant="outline"
                            size="sm"
                            icon="eye"
                            aria-label="Preview invoice"
                            onClick={() => notify("Invoice preview opened")}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            icon="download"
                            aria-label="Download invoice"
                            onClick={() =>
                              download(
                                x.id + ".txt",
                                `${x.id}\n${money(x.amount)}`,
                              )
                            }
                          />
                        </span>
                      ),
                    },
                  ]}
                />
                <Button
                  variant="ghost"
                  iconRight="arrow-right"
                  style={{ margin: 8 }}
                  onClick={() => setTab("Documents")}
                >
                  View all invoices (2)
                </Button>
              </SectionCard>
            </>
          ) : (
            <TabContent
              tab={tab}
              r={r}
              invoices={invoiceRows}
              onDownload={download}
            />
          )}
        </div>
        <div className="dem-rail">
          <SectionCard title="Demurrage Timeline">
            {[
              [
                "container",
                "Discharge Completed",
                "May 15, 2026 · 08:42 AM",
                "Container discharged at Apapa Port",
              ],
              [
                "calendar",
                "Free Period Started",
                "May 15, 2026",
                "7 days free period granted",
              ],
              [
                "circle-check",
                "Free Period Ended",
                "May 21, 2026 · 11:59 PM",
                "Free period has ended",
              ],
              [
                "circle-alert",
                "Demurrage Started",
                "May 22, 2026 · 12:00 AM",
                "Demurrage charge started",
              ],
              [
                "clock-3",
                "Current Status",
                "May 28, 2026 · 10:24 AM",
                (r.daysOver || 0) + " days overdue and ongoing",
              ],
              [
                "history",
                "Last Updated",
                "May 28, 2026 · 10:24 AM",
                "Demurrage recalculated",
              ],
            ].map((x, i) => (
              <Timeline
                key={x[1]}
                icon={x[0]}
                title={x[1]}
                date={x[2]}
                detail={x[3]}
                danger={i === 3}
              />
            ))}
          </SectionCard>
          <SectionCard
            title="Outstanding Summary"
            style={{ borderColor: "#f6c7cd", background: "#fffafa" }}
          >
            <Row label="Total Charge" value={money(r.charge)} />
            <Row label="Paid" value={money(r.paid)} />
            <Row
              label={<b>Outstanding</b>}
              value={
                <b style={{ color: "var(--tk-danger)" }}>
                  {money(r.charge - r.paid)}
                </b>
              }
            />
            <button
              className="dem-danger-button"
              onClick={() => setDispute(true)}
            >
              <Icon name="shield-alert" size={13} /> Raise Dispute
            </button>
          </SectionCard>
        </div>
      </div>
      <Modal
        open={dispute}
        onClose={() => setDispute(false)}
        title="Raise Demurrage Dispute"
        description="Flag this charge for review."
        width={520}
        footer={
          <>
            <Button variant="outline" onClick={() => setDispute(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={raiseDispute}>
              Raise Dispute
            </Button>
          </>
        }
      >
        <Select
          label="Dispute Reason"
          value={reason}
          options={[
            "Incorrect charge calculation",
            "Wrong discharge date",
            "Free days not applied",
            "Duplicate charge",
            "Other",
          ]}
          onChange={(e) => setReason(e.target.value)}
        />
        <Textarea
          label="Additional Details"
          rows={4}
          style={{ marginTop: 12 }}
          placeholder="Describe the issue..."
        />
      </Modal>
      {toast && <div className="dem-toast">{toast}</div>}
    </div>
  );
}
function Head({ label, value, sub, link, danger }) {
  return (
    <div className="dem-head-fact">
      <label>{label}</label>
      <strong
        style={{
          color: danger
            ? "var(--tk-danger)"
            : link
              ? "var(--tk-blue)"
              : undefined,
        }}
      >
        {value}
      </strong>
      <small className="tk-meta">{sub}</small>
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div className="dem-card-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Timeline({ icon, title, date, detail, danger }) {
  return (
    <div className="dem-timeline-item">
      <span
        className="node"
        style={
          danger
            ? { background: "var(--tk-danger-soft)", color: "var(--tk-danger)" }
            : {}
        }
      >
        <Icon name={icon} size={12} />
      </span>
      <span>
        <strong style={danger ? { color: "var(--tk-danger)" } : {}}>
          {title}
        </strong>
        <small>
          {date}
          <br />
          {detail}
        </small>
      </span>
    </div>
  );
}
function TabContent({ tab, r, invoices, onDownload }) {
  const content = {
    Calculation: (
      <>
        <Row label="Formula" value="Daily Rate × Billable Days + VAT" />
        <Row label="Daily Rate" value={money(r.rate)} />
        <Row label="Billable Days" value={r.daysOver} />
        <Row label="Calculated Total" value={money(r.charge)} />
      </>
    ),
    
    Disputes: (
      <p className="tk-meta">
        {r.status === "Dispute"
          ? "This charge is currently under dispute."
          : "No disputes have been raised for this charge."}
      </p>
    ),
    History: (
      <>
        {[
          ["Created", "May 22, 2026"],
          ["Recalculated", "May 28, 2026"],
          ["Customer notified", "May 28, 2026"],
        ].map((x) => (
          <Row key={x[0]} label={x[0]} value={x[1]} />
        ))}
      </>
    ),
  };
  return <SectionCard title={tab}>{content[tab]}</SectionCard>;
}
