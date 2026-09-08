"use client";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "../router.js";
import {
  Badge,
  Banner,
  Button,
  DropdownMenu,
  Icon,
  Modal,
  Tabs,
  Timeline,
  ActivityFeed,
  AttachmentCard,
} from "../ds.js";
import "./Operations.css";

const STAGES = [
  "Pending Approval",
  "Published",
  "Bidding",
  "Assigned",
  "In Transit",
  "Completed",
];
const STAGE_ICONS = ["file-plus", "send", "gavel", "truck", "route", "circle-check"];
const statusTone = (s) =>
  ({
    "Pending Approval": "purple",
    Published: "info",
    Bidding: "purple",
    Assigned: "info",
    "In Transit": "success",
    Completed: "success",
    Rejected: "danger",
    Cancelled: "neutral",
  })[s] || "neutral";

const BASE_ROUTE = [
  { n: "1", label: "Apapa Port　→　Apapa Gate", distance: "3.5 km", duration: "25 mins" },
  { n: "2", label: "Apapa Gate　→　Customer Warehouse (Ikeja)", distance: "18.6 km", duration: "45 mins" },
  { n: "3", label: "Offload & Return　→　Container Return Depot", distance: "12.2 km", duration: "30 mins" },
];
const SEGMENT_FLOW = ["Planned", "In Progress", "Completed"];
// A job can have more than one trip when the forwarder requests more than one truck —
// each trip runs the same route independently with its own truck, driver and segments.
const INITIAL_TRIPS = [
  { id: "TRP-98231", truck: "LND-234-XZ", driver: "John Adewale", segments: BASE_ROUTE.map((s) => ({ ...s, status: "Planned" })) },
  { id: "TRP-98232", truck: "EKY-778-QP", driver: "Grace Okoro", segments: BASE_ROUTE.map((s) => ({ ...s, status: "Planned" })) },
];
const DRIVER_POOL = ["John Adewale", "Grace Okoro", "Ibrahim Musa", "Chidi Eze", "Ngozi Bello"];
const TRUCK_POOL = ["LND-234-XZ", "EKY-778-QP", "ABJ-330-LR", "KAN-512-DF", "PHC-904-WT"];

const INITIAL_DOCUMENTS = [
  { id: "d1", name: "Bill of Lading.pdf", kind: "pdf", size: "1.2 MB", status: "Verified", uploadedAt: "May 30, 2026" },
  { id: "d2", name: "Container Booking Note.pdf", kind: "pdf", size: "640 KB", status: "Verified", uploadedAt: "May 30, 2026" },
  { id: "d3", name: "TDO — Terminal Delivery Order.pdf", kind: "pdf", size: "480 KB", status: "Verified", uploadedAt: "May 30, 2026" },
  { id: "d4", name: "Customs Clearance Certificate.pdf", kind: "pdf", size: "890 KB", status: "Pending Review", uploadedAt: "May 30, 2026" },
  { id: "d5", name: "Weighbridge Ticket.jpg", kind: "image", size: "2.1 MB", status: "Verified", uploadedAt: "May 30, 2026" },
  { id: "d6", name: "Cargo Insurance Certificate.pdf", kind: "pdf", size: "310 KB", status: "Verified", uploadedAt: "May 30, 2026" },
];

const STAGE_PAYMENTS = [
  { label: "Stage 1: Mobilization", amount: "₦435,000", pct: "30%" },
  { label: "Stage 2: Delivery", amount: "₦435,000", pct: "30%" },
  { label: "Stage 3: Container Return", amount: "₦580,000", pct: "40%" },
];

export function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Overview");
  const displayId = jobId || "JOB-29821";
  const [status, setStatus] = useState("Pending Approval");
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [toast, setToast] = useState(null);

  const [trips, setTrips] = useState(INITIAL_TRIPS);
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [escrowFunded, setEscrowFunded] = useState(false);
  const [releasedStages, setReleasedStages] = useState([]);
  const [activityLog, setActivityLog] = useState([
    { text: "Job created and submitted for approval", actor: "Michael Adewale", time: "May 30, 2026 09:42 AM" },
    { text: "2 trucks assigned by forwarder (TRP-98231, TRP-98232)", actor: "Michael Adewale", time: "May 30, 2026 09:42 AM" },
    { text: "Documents uploaded (6/6)", actor: "Michael Adewale", time: "May 30, 2026 09:42 AM" },
  ]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function notify(tone, title) {
    setToast({ tone, title });
    setActivityLog((l) => [{ text: title, actor: "Admin", time: "Just now", tone: tone === "danger" ? "var(--tk-danger)" : tone === "warning" ? "var(--tk-warning)" : tone === "success" ? "var(--tk-success)" : undefined }, ...l]);
  }

  const facts = [
    // ["Customer / Forwarder", "Goodwill Forwarding Ltd.", "Lagos, Nigeria　● Verified"],
    ["Customer / Forwarder", "Michael Adewale", "+234 803 123 4567"],
    ["Trip Type", "Port-to-Destination", "Import (Container)"],
    ["Trucks Assigned", `${trips.length}`, trips.length > 1 ? "Multiple trucks requested by forwarder" : ""],
    ["Priority", "High ↑", ""],
    ["Origin", "Apapa Port, Lagos", "Nigeria"],
    ["Destination", "Ikeja Warehouse", "Lagos, Nigeria"],
    ["Container Type / Size", "40FT HC", "10 tonnes"],
    ["Cargo", "General Merchandise", "Dry goods in a sealed 40ft container."],
    ["TDO / Delivery Date", "May 31, 2026", "● Valid (≥24hrs)"],
    ["Job Value", "₦1,450,000", ""],
    ["Escrow Status", escrowFunded ? "Funded" : "Awaiting Funding", ""],
    ["Payment Model", "3-Stage Milestone", ""],
  ];
  const checks = [
    ["Customer Verification", "Verified"],
    ["Document Completeness", `Complete (${documents.filter((d) => d.status === "Verified").length}/${documents.length})`],
    ["TDO Validation", "Valid (≥24hrs)"],
    ["Container Booking Number", "Verified"],
    ["Fraud Risk Score", "Low Risk　23/100"],
  ];

  const stageIndex = STAGES.indexOf(status);
  const totalDistance = "34.3 km";
  const totalDuration = "1 hr 40 mins";
  const totalSegments = trips.reduce((n, t) => n + t.segments.length, 0);
  function tripStatus(trip) {
    const statuses = trip.segments.map((s) => s.status);
    if (statuses.every((s) => s === "Completed")) return "Completed";
    if (statuses.some((s) => s !== "Planned")) return "In Progress";
    return "Planned";
  }

  function approve() {
    setStatus("Published");
    setApproveOpen(false);
    notify("success", `${displayId} approved and published for bidding.`);
  }
  function reject() {
    setStatus("Rejected");
    setRejectOpen(false);
    notify("danger", `${displayId} was rejected.`);
  }
  function saveNote() {
    setSavedNote(note);
    notify("info", "Internal note saved.");
  }
  function advanceSegment(tripId, n) {
    const trip = trips.find((t) => t.id === tripId);
    const seg = trip?.segments.find((s) => s.n === n);
    setTrips((ts) => ts.map((t) => (t.id !== tripId ? t : {
      ...t,
      segments: t.segments.map((s) => {
        if (s.n !== n) return s;
        const next = SEGMENT_FLOW[Math.min(SEGMENT_FLOW.indexOf(s.status) + 1, SEGMENT_FLOW.length - 1)];
        return { ...s, status: next };
      }),
    })));
    notify("info", `${tripId} · Segment ${n} (${seg?.label.replace(/　/g, " ")}) updated.`);
  }
  function assignAdditionalTruck() {
    const idx = trips.length;
    const id = "TRP-" + (98230 + idx + 1);
    const truck = TRUCK_POOL[idx % TRUCK_POOL.length];
    const driver = DRIVER_POOL[idx % DRIVER_POOL.length];
    setTrips((ts) => [...ts, { id, truck, driver, segments: BASE_ROUTE.map((s) => ({ ...s, status: "Planned" })) }]);
    notify("success", `Additional truck assigned — ${id} (${truck}, ${driver}).`);
  }
  function reviewDocument(doc, approve) {
    setDocuments((docs) => docs.map((d) => (d.id === doc.id ? { ...d, status: approve ? "Verified" : "Rejected" } : d)));
    setReviewDoc(null);
    notify(approve ? "success" : "danger", `${doc.name} marked as ${approve ? "verified" : "rejected"}.`);
  }
  function fundEscrow() {
    setEscrowFunded(true);
    notify("success", "Escrow funded — payment stages can now be released.");
  }
  function releaseStage(i) {
    setReleasedStages((r) => [...r, i]);
    notify("success", `${STAGE_PAYMENTS[i].label} released (${STAGE_PAYMENTS[i].amount}).`);
  }

  return (
    <div className="operations-screen">
      <div className="screen-head">
        <div>
          <div className="tk-meta">Jobs & Trips　›　Jobs　›　{displayId}</div>
          <h1>
            {displayId}　<Badge tone={statusTone(status)}>{status}</Badge>
          </h1>
          <p>Import (Container)　•　Created on May 30, 2026 09:42 AM</p>
        </div>
        <div className="head-actions">
          <Button variant="outline" icon="arrow-left" onClick={() => navigate("/jobs")}>
            Back
          </Button>
          <span style={{ position: "relative" }}>
            <Button variant="outline" icon="ellipsis-vertical" onClick={() => setMoreOpen((o) => !o)}>
              More Actions
            </Button>
            {moreOpen && (
              <span style={{ position: "absolute", right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu
                  width={220}
                  items={[
                    { label: "Edit Job", icon: "pencil", onClick: () => { setMoreOpen(false); notify("info", "Editing is not available in this preview."); } },
                    { label: "Duplicate Job", icon: "copy", onClick: () => { setMoreOpen(false); notify("success", "Job duplicated as a draft."); } },
                    { label: "Print Job Sheet", icon: "printer", onClick: () => { setMoreOpen(false); window.print(); } },
                    { divider: true },
                    { label: "Flag for Review", icon: "flag", onClick: () => { setMoreOpen(false); notify("warning", `${displayId} flagged for operations review.`); } },
                    { label: "Cancel Job", icon: "ban", tone: "danger", onClick: () => { setMoreOpen(false); setStatus("Cancelled"); notify("danger", `${displayId} cancelled.`); } },
                  ]}
                />
              </span>
            )}
          </span>
          <Button variant="danger" icon="clock" disabled={status !== "Pending Approval"} onClick={() => setRejectOpen(true)}>
            Reject Job
          </Button>
          <Button icon="check" disabled={status !== "Pending Approval"} onClick={() => setApproveOpen(true)}>
            Approve Job
          </Button>
        </div>
      </div>

      {toast && (
        <Banner
          tone={toast.tone === "danger" ? "danger" : toast.tone === "warning" ? "warning" : toast.tone === "success" ? "success" : "info"}
          title={toast.title}
        />
      )}

      <Tabs
        items={[
          { value: "Overview", label: "Overview" },
          { value: "Segments", label: "Segments", count: totalSegments },
          { value: "Documents", label: "Documents", count: documents.length },
          { value: "Pricing & Payments", label: "Pricing & Payments" },
          { value: "Timeline", label: "Timeline" },
          { value: "Activity Log", label: "Activity Log" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "Overview" && (
        <div className="job-detail-grid">
          <div className="job-detail-col">
            <div className="ops-panel">
              <div className="ops-panel-head">
                <Icon name="clipboard-list" size={18} />
                <div><h3>Job Overview</h3></div>
              </div>
              <div className="overview-facts">
                {facts.map((f) => (
                  <div className="overview-fact" key={f[0]}>
                    <label>{f[0]}</label>
                    <strong>{f[1]}</strong>
                    <small>{f[2]}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="ops-panel">
              <div className="ops-panel-head">
                <Icon name="route" size={18} />
                <div><h3>Trips & Segments</h3><p>{trips.length} truck{trips.length === 1 ? "" : "s"} assigned to this job.</p></div>
                <Button variant="outline" icon="map-pin" onClick={() => setMapOpen(true)}>View on Map</Button>
              </div>
              {trips.map((t) => {
                const done = t.segments.filter((s) => s.status === "Completed").length;
                return (
                  <div className="segment-row" key={t.id} style={{ gridTemplateColumns: "80px 1fr auto auto" }}>
                    <b>{t.id}</b>
                    <span>{t.truck}　•　{t.driver}</span>
                    <span>{done}/{t.segments.length} segments</span>
                    <Badge tone={tripStatus(t) === "Completed" ? "success" : tripStatus(t) === "In Progress" ? "warning" : "info"}>{tripStatus(t)}</Badge>
                  </div>
                );
              })}
            </div>
            <div className="ops-panel">
              <div className="ops-panel-head">
                <Icon name="wallet-cards" size={18} />
                <div><h3>Financial Summary</h3></div>
              </div>
              <div className="finance-grid">
                {[...STAGE_PAYMENTS, { label: "Total Job Value", amount: "₦1,450,000", pct: "100% in Escrow" }].map((x) => (
                  <div className="finance-box" key={x.label}>
                    <small>{x.label}　{x.pct}</small>
                    <strong>{x.amount}</strong>
                    <small>{x.pct}</small>
                  </div>
                ))}
              </div>
              {!escrowFunded ? (
                <div className="approval-note">Escrow funding is required before this job can be published for bidding.</div>
              ) : (
                <div className="approval-note" style={{ background: "#f3faf6", color: "var(--tk-success)" }}>
                  Escrow is funded. See the Pricing & Payments tab to release milestone payments.
                </div>
              )}
            </div>
          </div>

          <div className="job-detail-col">
            <div className="ops-panel">
              <div className="ops-panel-head">
                <Icon name="chart-no-axes-column" size={18} />
                <div><h3>Job Status</h3></div>
              </div>
              <div className="status-flow">
                {STAGES.map((x, i) => (
                  <div className={"status-stage " + (i <= stageIndex ? "active" : "")} key={x}>
                    <i>{i + 1}</i>
                    {x}
                  </div>
                ))}
              </div>
              {status === "Pending Approval" && (
                <div className="approval-note">This job is awaiting admin approval.<br />Please review all documents and details before approving.</div>
              )}
              {status === "Rejected" && (
                <div className="approval-note" style={{ background: "#fdecec", color: "var(--tk-danger)" }}>This job was rejected and will not be published for bidding.</div>
              )}
              {status === "Cancelled" && (
                <div className="approval-note" style={{ background: "#f3f4f6", color: "var(--tk-ink-500)" }}>This job has been cancelled.</div>
              )}
              {status === "Published" && (
                <div className="approval-note" style={{ background: "#eef6ff", color: "var(--tk-blue)" }}>This job is published and open for carrier bidding.</div>
              )}
            </div>

            <div className="ops-panel">
              <div className="ops-panel-head">
                <Icon name="pin" size={18} />
                <div><h3>Approval Information</h3></div>
              </div>
              <div className="info-grid">
                <div><label>Submitted By</label><strong>Michael Adewale (Goodwill Forwarding Ltd.)</strong></div>
                <div></div>
                <div><label>Submitted At</label><strong>May 30, 2026 09:42 AM</strong></div>
                <div><label>SLA</label><strong>20 mins</strong></div>
                <div><label>Time Elapsed</label><strong style={{ color: "var(--tk-warning)" }}>12 mins</strong></div>
                <div><label>Assigned To</label><Badge tone="purple">Operations Team</Badge></div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label>Notes (Internal)</label>
                  <textarea
                    placeholder="Add internal notes (visible to admins only)..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    style={{ width: "100%", height: 55, border: "1px solid var(--tk-line-strong)", borderRadius: 8, padding: 10 }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <Button size="sm" variant="outline" disabled={note === savedNote} onClick={saveNote}>Save Note</Button>
                    {savedNote && note === savedNote && <span className="tk-meta">Saved</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="ops-panel">
              <div className="ops-panel-head">
                <Icon name="shield-check" size={18} />
                <div><h3>Risk & Compliance Checks</h3></div>
              </div>
              {checks.map((x, i) => (
                <div className="check-row" key={x[0]}>
                  <Icon name={i === 4 ? "triangle-alert" : "badge-check"} color={i === 4 ? "var(--tk-danger)" : "var(--tk-success)"} size={17} />
                  <span>{x[0]}</span>
                  <b>{x[1]}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "Segments" && (
        <div style={{ display: "grid", gap: 16 }}>
          {trips.map((t) => (
            <div className="ops-panel" key={t.id}>
              <div className="ops-panel-head">
                <Icon name="truck" size={18} />
                <div><h3>{t.id}</h3><p>{t.truck}　•　{t.driver}</p></div>
                <Badge tone={tripStatus(t) === "Completed" ? "success" : tripStatus(t) === "In Progress" ? "warning" : "info"} dot>{tripStatus(t)}</Badge>
                <Button variant="outline" icon="map-pin" onClick={() => setMapOpen(true)}>View on Map</Button>
              </div>
              <div style={{ display: "grid", gap: 12, padding: 16 }}>
                {t.segments.map((s) => (
                  <div key={s.n} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto auto", gap: 14, alignItems: "center", padding: "14px 16px", border: "1px solid var(--tk-line)", borderRadius: 10 }}>
                    <span className="segment-number">{s.n}</span>
                    <div style={{ display: "grid", gap: 4 }}>
                      <b style={{ color: "var(--tk-ink-900)" }}>{s.label}</b>
                      <span className="tk-meta">{s.distance}　•　{s.duration}</span>
                    </div>
                    <Badge tone={s.status === "Completed" ? "success" : s.status === "In Progress" ? "warning" : "info"} dot>{s.status}</Badge>
                    <Button size="sm" variant="outline" disabled={s.status === "Completed"} onClick={() => advanceSegment(t.id, s.n)}>
                      {s.status === "Planned" ? "Start Segment" : "Mark Complete"}
                    </Button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 24, padding: "12px 16px", background: "var(--tk-surface-sunk)", borderRadius: 10 }}>
                  <span className="tk-meta">Total Distance<br /><strong style={{ color: "var(--tk-ink-900)" }}>{totalDistance}</strong></span>
                  <span className="tk-meta">Total Est. Duration<br /><strong style={{ color: "var(--tk-ink-900)" }}>{totalDuration}</strong></span>
                  <span className="tk-meta">Total Segments<br /><strong style={{ color: "var(--tk-ink-900)" }}>{t.segments.length}</strong></span>
                </div>
              </div>
            </div>
          ))}
          <div className="ops-panel" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span className="tk-meta">Forwarder requesting an additional truck for this job?</span>
            <Button variant="outline" icon="plus" onClick={assignAdditionalTruck}>Assign Additional Truck</Button>
          </div>
        </div>
      )}

      {tab === "Documents" && (
        <div className="ops-panel">
          <div className="ops-panel-head">
            <Icon name="file-text" size={18} />
            <div><h3>Job Documents</h3><p>Verify all documents before approving this job.</p></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, padding: 16 }}>
            {documents.map((d) => (
              <div key={d.id} style={{ border: "1px solid var(--tk-line)", borderRadius: 10, padding: 12, display: "grid", gap: 10 }}>
                <AttachmentCard name={d.name} size={`${d.size}　•　${d.uploadedAt}`} kind={d.kind} onOpen={() => setReviewDoc(d)} style={{ border: 0, padding: 0 }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Badge tone={d.status === "Verified" ? "success" : d.status === "Rejected" ? "danger" : "warning"} dot>{d.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setReviewDoc(d)}>Review</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Pricing & Payments" && (
        <div className="job-detail-grid">
          <div className="job-detail-col">
            <div className="ops-panel">
              <div className="ops-panel-head">
                <Icon name="wallet-cards" size={18} />
                <div><h3>Milestone Payments</h3><p>3-Stage Milestone　•　Total Job Value ₦1,450,000</p></div>
              </div>
              <div style={{ display: "grid", gap: 10, padding: 16 }}>
                {STAGE_PAYMENTS.map((x, i) => {
                  const released = releasedStages.includes(i);
                  return (
                    <div key={x.label} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 14, alignItems: "center", padding: "12px 16px", border: "1px solid var(--tk-line)", borderRadius: 10 }}>
                      <div style={{ display: "grid", gap: 2 }}>
                        <b style={{ color: "var(--tk-ink-900)" }}>{x.label}</b>
                        <span className="tk-meta">{x.pct} of job value</span>
                      </div>
                      <strong style={{ color: "var(--tk-ink-900)" }}>{x.amount}</strong>
                      {released ? (
                        <Badge tone="success" dot>Released</Badge>
                      ) : (
                        <Button size="sm" disabled={!escrowFunded} onClick={() => releaseStage(i)}>Release</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="job-detail-col">
            <div className="ops-panel">
              <div className="ops-panel-head">
                <Icon name="shield-check" size={18} />
                <div><h3>Escrow</h3></div>
              </div>
              <div className="info-grid">
                <div><label>Status</label><Badge tone={escrowFunded ? "success" : "warning"}>{escrowFunded ? "Funded" : "Awaiting Funding"}</Badge></div>
                <div><label>Total in Escrow</label><strong>₦1,450,000</strong></div>
              </div>
              {!escrowFunded ? (
                <div style={{ padding: "0 14px 14px" }}>
                  <Button fullWidth onClick={fundEscrow}>Fund Escrow</Button>
                </div>
              ) : (
                <div className="approval-note" style={{ margin: 14, background: "#f3faf6", color: "var(--tk-success)" }}>
                  Escrow funded. Release stage payments as work is completed.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "Timeline" && (
        <div className="ops-panel">
          <div className="ops-panel-head">
            <Icon name="chart-no-axes-column" size={18} />
            <div><h3>Job Timeline</h3></div>
          </div>
          <div style={{ padding: 20 }}>
            <Timeline items={[
              { title: "Job Created", description: "Submitted by Michael Adewale (Goodwill Forwarding Ltd.)", time: "May 30, 09:42 AM", icon: "file-plus", state: "done" },
              ...STAGES.map((s, i) => ({
                title: s,
                icon: STAGE_ICONS[i],
                time: i < stageIndex ? "Completed" : i === stageIndex ? "In progress" : undefined,
                state: status === "Rejected" || status === "Cancelled" ? (i === 0 ? "done" : "pending") : i < stageIndex ? "done" : i === stageIndex ? "current" : "pending",
              })),
              ...(status === "Rejected" ? [{ title: "Rejected", description: "Job rejected by admin", icon: "circle-x", state: "danger", time: "Just now" }] : []),
              ...(status === "Cancelled" ? [{ title: "Cancelled", description: "Job cancelled by admin", icon: "circle-x", state: "danger", time: "Just now" }] : []),
            ]} />
          </div>
        </div>
      )}

      {tab === "Activity Log" && (
        <div className="ops-panel">
          <div className="ops-panel-head">
            <Icon name="scroll-text" size={18} />
            <div><h3>Activity Log</h3><p>Every action taken on this job, most recent first.</p></div>
          </div>
          <div style={{ padding: 20 }}>
            <ActivityFeed items={activityLog} />
          </div>
        </div>
      )}

      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Approve Job" description={`Approve ${displayId} and publish it for carrier bidding?`}
        footer={<>
          <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
          <Button icon="check" onClick={approve}>Approve & Publish</Button>
        </>}>
        <span className="tk-meta">This will move the job from Pending Approval to Published. Carriers will be able to submit bids once published.</span>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Job" description={`Reject ${displayId}?`}
        footer={<>
          <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button variant="danger" icon="clock" onClick={reject}>Reject Job</Button>
        </>}>
        <span className="tk-meta">This job will be marked as rejected and the forwarder will be notified. This action cannot be undone from this screen.</span>
      </Modal>

      <Modal open={mapOpen} onClose={() => setMapOpen(false)} title="Route Map" description={`Segment route for ${displayId}`} width={640}>
        <div style={{ height: 320, borderRadius: 10, border: "1.5px dashed var(--tk-line-strong)", background: "var(--tk-surface-sunk)", display: "grid", placeItems: "center", gap: 8, textAlign: "center", color: "var(--tk-ink-300)" }}>
          <Icon name="map" size={34} />
          <strong style={{ color: "var(--tk-ink-500)", font: "600 13px var(--tk-font-sans)" }}>Map view placeholder</strong>
          <span className="tk-meta">Apapa Port → Apapa Gate → Customer Warehouse (Ikeja) → Container Return Depot</span>
        </div>
      </Modal>

      <Modal open={!!reviewDoc} onClose={() => setReviewDoc(null)} title={reviewDoc?.name} description={reviewDoc ? `${reviewDoc.size} · Uploaded ${reviewDoc.uploadedAt}` : ""}
        footer={reviewDoc && <>
          <Button variant="danger" icon="circle-x" onClick={() => reviewDocument(reviewDoc, false)}>Reject</Button>
          <Button icon="circle-check" onClick={() => reviewDocument(reviewDoc, true)}>Verify</Button>
        </>}>
        {reviewDoc && (
          <div style={{ height: 220, borderRadius: 10, border: "1.5px dashed var(--tk-line-strong)", background: "var(--tk-surface-sunk)", display: "grid", placeItems: "center", gap: 8, textAlign: "center", color: "var(--tk-ink-300)" }}>
            <Icon name={reviewDoc.kind === "image" ? "image" : "file-text"} size={30} />
            <span className="tk-meta">Document preview placeholder</span>
            <Badge tone={reviewDoc.status === "Verified" ? "success" : reviewDoc.status === "Rejected" ? "danger" : "warning"}>{reviewDoc.status}</Badge>
          </div>
        )}
      </Modal>
    </div>
  );
}
