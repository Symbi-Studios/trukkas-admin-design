"use client";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "../router.js";
import {
  PageHeader,
  Button,
  Card,
  SectionCard,
  Tabs,
  Badge,
  Icon,
  DropdownMenu,
  Modal,
  Textarea,
  DataTable,
  ProgressBar,
  Banner,
  BarChart,
  EmptyState,
  QuickActionsCard,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { updateMaintenance, setTruckStatus } from "../mock/api.js";
import "./Maintenance.css";
import "./MaintenanceDetail.css";

const STATUS_TONE = {
  Scheduled: "info",
  "In Progress": "warning",
  Completed: "success",
  Overdue: "danger",
  Cancelled: "neutral",
};
const STATUS_ICON = {
  Scheduled: "calendar-clock",
  "In Progress": "wrench",
  Completed: "circle-check",
  Overdue: "triangle-alert",
  Cancelled: "circle-x",
};
const RECORD_DATE_LABEL = {
  Scheduled: "Scheduled For",
  "In Progress": "Started On",
  Completed: "Date Completed",
  Overdue: "Was Due",
  Cancelled: "Cancelled On",
};
const ASSET_TYPE = {
  "40FT Trailer": "Truck (Prime Mover)",
  "20FT Container": "Truck (Container Chassis)",
  Flatbed: "Truck (Flatbed)",
  "40FT High Cube": "Truck (High Cube Trailer)",
  Tanker: "Truck (Tanker)",
  "45FT Container": "Truck (Container Chassis)",
};
const CHECKLISTS = {
  Preventive: [
    "Engine oil & filter replacement",
    "Air filter replacement",
    "Fuel filter replacement",
    "Brake inspection",
    "General safety inspection",
  ],
  Repair: [
    "Fault diagnosis",
    "Component replacement",
    "Function test",
    "Torque & leak check",
    "Road test",
  ],
  Inspection: [
    "Document verification",
    "Brake & tyre check",
    "Lighting & signals check",
    "Emissions check",
    "Roadworthiness sign-off",
  ],
  Breakdown: [
    "On-site diagnosis",
    "Recovery to service center",
    "Root cause repair",
    "Function test",
    "Return to service",
  ],
};
const PAST_HISTORY = [
  {
    date: "Jan 18, 2026",
    odometer: 365420,
    serviceType: "Repair",
    description: "Brake system repair",
    serviceCenter: "TruckCare Plus",
    status: "Completed",
  },
  {
    date: "Nov 02, 2025",
    odometer: 340100,
    serviceType: "Preventive",
    description: "Full vehicle inspection",
    serviceCenter: "AutoCare Lagos",
    status: "Completed",
  },
  {
    date: "Jul 15, 2025",
    odometer: 300560,
    serviceType: "Preventive",
    description: "Oil change, filter replacement",
    serviceCenter: "QuickFix Auto",
    status: "Completed",
  },
  {
    date: "May 03, 2025",
    odometer: 260210,
    serviceType: "Inspection",
    description: "Regulatory inspection",
    serviceCenter: "Lagos Vehicle Test Centre",
    status: "Completed",
  },
];
const UPCOMING_TEMPLATE = [
  {
    title: "Tyre Rotation & Balancing",
    type: "Preventive",
    offsetKm: 15000,
    hint: "Due shortly after the next service",
  },
  {
    title: "Annual Roadworthiness Inspection",
    type: "Inspection",
    offsetKm: null,
    hint: "Due later in the year",
  },
];
const MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];

function seed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function monthlyKm(plate) {
  const s = seed(plate);
  return MONTH_LABELS.map((_, i) => 3800 + ((s >> (i * 3)) % 6) * 750 + i * 90);
}
function km(n) {
  return n == null ? "—" : n.toLocaleString("en-NG") + " km";
}
function dl(r) {
  const u = URL.createObjectURL(
    new Blob([
      `${r.id}\n${r.plate}\n${r.description}\nOdometer: ${km(r.currentOdometer)}\nNext due: ${km(r.nextDueOdometer)} or ${r.nextDueDate}`,
    ]),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = r.id + ".txt";
  a.click();
  URL.revokeObjectURL(u);
}

export function MaintenanceDetail() {
  const navigate = useNavigate(),
    { maintenanceId } = useParams(),
    rows = useCollection("maintenance") || [],
    r = rows.find((x) => x.id === maintenanceId),
    [tab, setTab] = useState("Overview"),
    [menuOpen, setMenuOpen] = useState(false),
    [flagOpen, setFlagOpen] = useState(false),
    [flagReason, setFlagReason] = useState(""),
    [suspendOpen, setSuspendOpen] = useState(false),
    [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function notify(tone, title) {
    setToast({ tone, title });
  }

  if (!r) {
    return (
      <Card>
        <span className="tk-body">
          No maintenance record found with ID {maintenanceId}.
        </span>
        <div style={{ marginTop: 12 }}>
          <Button
            variant="outline"
            icon="arrow-left"
            onClick={() => navigate("/maintenance")}
          >
            Back to Maintenance
          </Button>
        </div>
      </Card>
    );
  }

  const isOverdue = r.status === "Overdue";
  const isInProgress = r.status === "In Progress";
  const assetStatus = isInProgress ? "In Maintenance" : "Active";
  const fitForRoad = !isOverdue;
  const maintStatusLabel = isOverdue
    ? "Overdue"
    : isInProgress
      ? "Maintenance In Progress"
      : "Up to Date";
  const maintStatusTone = isOverdue
    ? "danger"
    : isInProgress
      ? "warning"
      : "success";
  const maintStatusDesc = isOverdue
    ? "This asset has overdue maintenance and requires immediate attention."
    : isInProgress
      ? "A maintenance job is currently in progress for this asset."
      : "This asset has met all required maintenance based on kilometres and time intervals.";
  const remainingKm =
    r.nextDueOdometer != null
      ? Math.max(0, r.nextDueOdometer - r.currentOdometer)
      : null;
  const scaleMax = Math.max(
    600000,
    Math.ceil(
      ((r.nextDueOdometer || r.currentOdometer || 100000) * 1.2) / 50000,
    ) * 50000,
  );
  const compliance = [
    {
      label: "Maintenance Compliant",
      hint: "All mandatory maintenance completed",
      ok: !isOverdue,
    },
    {
      label: "Eligible for Jobs",
      hint: "This asset can be assigned to new jobs",
      ok: !isOverdue && !isInProgress,
    },
    {
      label: "No Open Maintenance Issues",
      hint: "No unresolved maintenance items",
      ok: !isOverdue && !isInProgress,
    },
  ];
  const checklist = CHECKLISTS[r.type] || CHECKLISTS.Preventive;
  const historyRows = [
    {
      n: 1,
      date: r.dueDate,
      odometer: r.currentOdometer,
      serviceType: r.type,
      description: r.description,
      serviceCenter: r.serviceCenter,
      status: r.status,
      self: true,
    },
    ...PAST_HISTORY.map((h, i) => ({ n: i + 2, ...h, self: false })),
  ];
  const upcoming = [
    {
      title: `${r.type} Maintenance`,
      type: r.type,
      dueDate: r.nextDueDate,
      dueOdometer: r.nextDueOdometer,
    },
    ...UPCOMING_TEMPLATE.map((u) => ({
      title: u.title,
      type: u.type,
      dueOdometer:
        u.offsetKm != null && r.nextDueOdometer != null
          ? r.nextDueOdometer + u.offsetKm
          : null,
      hint: u.hint,
    })),
  ];
  const monthly = monthlyKm(r.plate);
  const avgMonthlyKm = Math.round(
    monthly.reduce((a, b) => a + b, 0) / monthly.length,
  );

  async function markCompleted() {
    await updateMaintenance(r.id, { status: "Completed" });
    setMenuOpen(false);
    notify("success", "Maintenance marked as completed.");
  }
  async function startMaintenance() {
    await updateMaintenance(r.id, { status: "In Progress" });
    setMenuOpen(false);
    notify("info", "Maintenance started.");
  }
  async function submitFlag() {
    await updateMaintenance(r.id, {
      flagged: true,
      flagReason: flagReason.trim(),
    });
    setFlagOpen(false);
    setFlagReason("");
    notify("warning", `${r.id} flagged for review.`);
  }
  async function confirmSuspend() {
    await setTruckStatus(r.plate, "Inactive");
    setSuspendOpen(false);
    notify("danger", `${r.plate} has been suspended from active duty.`);
  }

  return (
    <div className="maint-page">
      <PageHeader
        crumbs={["Fleet Management", "Maintenance", r.id]}
        title="Maintenance Record Details"
        description="View the complete maintenance record, service history and asset status for compliance and safety oversight."
        actions={
          <>
            <Button
              variant="outline"
              icon="arrow-left"
              onClick={() => navigate("/maintenance")}
            >
              Back to Maintenance
            </Button>
            <Button
              variant="outline"
              icon="truck"
              onClick={() => navigate("/fleet/" + encodeURIComponent(r.plate))}
            >
              View Asset Profile
            </Button>
            <span style={{ position: "relative" }}>
              <Button
                variant="outline"
                iconRight="chevron-down"
                onClick={() => setMenuOpen((v) => !v)}
              >
                More Actions
              </Button>
              {menuOpen && (
                <span
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 44,
                    zIndex: 30,
                  }}
                >
                  <DropdownMenu
                    width={230}
                    items={[
                      {
                        label: "Print Record",
                        icon: "printer",
                        onClick: () => {
                          setMenuOpen(false);
                          window.print();
                        },
                      },
                      {
                        label: "Download Record",
                        icon: "download",
                        onClick: () => {
                          setMenuOpen(false);
                          dl(r);
                        },
                      },
                      { divider: true },
                      ...(r.status === "Scheduled"
                        ? [
                            {
                              label: "Start Maintenance",
                              icon: "play",
                              onClick: startMaintenance,
                            },
                          ]
                        : []),
                      ...(r.status === "Scheduled" || r.status === "In Progress"
                        ? [
                            {
                              label: "Mark Completed",
                              icon: "circle-check",
                              onClick: markCompleted,
                            },
                          ]
                        : []),
                      { divider: true },
                      {
                        label: "Flag for Review",
                        icon: "flag",
                        tone: "danger",
                        onClick: () => {
                          setMenuOpen(false);
                          setFlagOpen(true);
                        },
                      },
                      {
                        label: "Suspend Asset",
                        icon: "ban",
                        tone: "danger",
                        onClick: () => {
                          setMenuOpen(false);
                          setSuspendOpen(true);
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

      {toast && <Banner tone={toast.tone} title={toast.title} />}

      <Card pad="none">
        <div className="mdet-hero">
          <div
            className="mdet-hero-left"
            style={{
              flexDirection: "column",
              alignItems: "stretch",
              padding: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 20,
                alignItems: "center",
                padding: 20,
              }}
            >
              <div className="mdet-photo">
                <Icon name="truck" size={40} />
                <span className="mdet-photo-badge">
                  <Badge
                    tone={assetStatus === "Active" ? "success" : "warning"}
                    dot
                  >
                    {assetStatus}
                  </Badge>
                </span>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 className="tk-title" style={{ fontSize: 20 }}>
                    {r.plate}
                  </h2>
                  <Badge
                    tone={assetStatus === "Active" ? "success" : "warning"}
                  >
                    {assetStatus}
                  </Badge>
                </div>
                <div className="tk-meta" style={{ marginTop: 4 }}>
                  {ASSET_TYPE[r.truckType] || `Truck (${r.truckType})`}
                </div>
              </div>
            </div>
            <div className="mdet-hero-facts">
              <div className="mdet-fact">
                <span className="ico">
                  <Icon name="building-2" size={16} />
                </span>
                <span>
                  <div
                    style={{
                      font: "600 13px/18px var(--tk-font-sans)",
                      color: "var(--tk-ink-900)",
                    }}
                  >
                    {r.company}
                  </div>
                  <div className="tk-meta">Trucking Company</div>
                </span>
              </div>
              <div className="mdet-fact">
                <span className="ico">
                  <Icon name="car" size={16} />
                </span>
                <span>
                  <div
                    style={{
                      font: "600 13px/18px var(--tk-font-sans)",
                      color: "var(--tk-ink-900)",
                    }}
                  >
                    {r.makeModel}
                  </div>
                  <div className="tk-meta">Make / Model</div>
                </span>
              </div>
              <div className="mdet-fact">
                <span className="ico">
                  <Icon name="scan-line" size={16} />
                </span>
                <span>
                  <div
                    style={{
                      font: "600 13px/18px var(--tk-font-sans)",
                      color: "var(--tk-ink-900)",
                    }}
                  >
                    {r.vin}
                  </div>
                  <div className="tk-meta">VIN / Chassis No.</div>
                </span>
              </div>
              <div className="mdet-fact">
                <span className="ico">
                  <Icon name="badge-check" size={16} />
                </span>
                <span>
                  <div
                    style={{
                      font: "600 13px/18px var(--tk-font-sans)",
                      color: "var(--tk-ink-900)",
                    }}
                  >
                    {r.truckRef}
                  </div>
                  <div className="tk-meta">Trukkas Asset ID</div>
                </span>
              </div>
            </div>
          </div>
          <div className={`mdet-fit ${fitForRoad ? "" : "tone-danger"}`}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Icon
                name={fitForRoad ? "circle-check" : "triangle-alert"}
                size={20}
                color={fitForRoad ? "var(--tk-success)" : "var(--tk-danger)"}
              />
              <div>
                <div
                  style={{
                    font: "700 15px/20px var(--tk-font-sans)",
                    color: fitForRoad
                      ? "var(--tk-success)"
                      : "var(--tk-danger)",
                  }}
                >
                  {fitForRoad ? "Fit for Road" : "Not Fit for Road"}
                </div>
                <div
                  style={{
                    font: "400 12px/17px var(--tk-font-sans)",
                    color: "var(--tk-ink-500)",
                  }}
                >
                  {fitForRoad
                    ? "All required maintenance up to date."
                    : "Overdue maintenance must be resolved."}
                </div>
              </div>
            </div>
            <div>
              <div className="mdet-fit-row">
                <span>Next Due</span>
                <strong style={{ color: "var(--tk-ink-900)" }}>
                  {km(r.nextDueOdometer)}
                </strong>
              </div>
              <div className="mdet-fit-row">
                <span>Estimated</span>
                <strong style={{ color: "var(--tk-ink-900)" }}>
                  {r.nextDueDate}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          "Overview",
          "Maintenance History",
          "Upcoming Maintenance",
          "KM & Usage",
          "Documents",
        ]}
      />

      {tab === "Overview" && (
        <div className="mdet-layout">
          <div className="mdet-main">
            <div className="mdet-row1">
              <SectionCard title="Asset Information">
                <InfoRow
                  icon="file-text"
                  label="Registration No."
                  value={r.plate}
                />
                <InfoRow
                  icon="truck"
                  label="Asset Type"
                  value={ASSET_TYPE[r.truckType] || r.truckType}
                />
                <InfoRow icon="car" label="Make / Model" value={r.makeModel} />
                <InfoRow
                  icon="calendar"
                  label="Year of Manufacture"
                  value={r.year}
                />
                <InfoRow
                  icon="building-2"
                  label="Trucking Company"
                  value={r.company}
                />
                <InfoRow
                  icon="map-pin"
                  label="Current Location"
                  value={r.location}
                />
                <InfoRow
                  icon="circle-dot"
                  label="Status"
                  value={
                    <Badge
                      tone={assetStatus === "Active" ? "success" : "warning"}
                      dot
                    >
                      {assetStatus}
                    </Badge>
                  }
                />
                <InfoRow
                  icon="gauge"
                  label="Odometer (Current)"
                  value={km(r.currentOdometer)}
                />
                <InfoRow
                  icon="clock-3"
                  label="Last Updated"
                  value={r.lastUpdated}
                />
              </SectionCard>

              <SectionCard title="Maintenance Status">
                <Banner tone={maintStatusTone} title={maintStatusLabel}>
                  {maintStatusDesc}
                </Banner>
                <div className="mdet-status-grid">
                  <div className="mdet-status-box">
                    <span
                      className="tk-meta"
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Icon name="calendar" size={13} /> Last Maintenance
                    </span>
                    <strong
                      style={{ font: "600 14px/20px var(--tk-font-sans)" }}
                    >
                      {PAST_HISTORY[0].date}
                    </strong>
                    <span className="tk-meta">
                      at {km(PAST_HISTORY[0].odometer)}
                    </span>
                    <div style={{ marginTop: 4 }}>
                      <span className="tk-meta">Service Type:</span>{" "}
                      <Badge tone="info">{PAST_HISTORY[0].serviceType}</Badge>
                    </div>
                  </div>
                  <div className="mdet-status-box">
                    <span
                      className="tk-meta"
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Icon name="calendar-clock" size={13} /> Next Due
                    </span>
                    <strong
                      style={{ font: "600 14px/20px var(--tk-font-sans)" }}
                    >
                      {r.nextDueDate}
                    </strong>
                    <span className="tk-meta">at {km(r.nextDueOdometer)}</span>
                    <div
                      style={{
                        marginTop: 4,
                        color: "var(--tk-success)",
                        font: "600 12px/17px var(--tk-font-sans)",
                      }}
                    >
                      {r.nextDueDays != null
                        ? `In ${r.nextDueDays} days / ${km(remainingKm)}`
                        : "Not yet scheduled"}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Recent Maintenance Record">
              <div className="mdet-record-grid">
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        background: `var(--tk-${maintStatusTone === "success" ? "success" : maintStatusTone}-soft)`,
                      }}
                    >
                      <Icon
                        name={STATUS_ICON[r.status]}
                        size={17}
                        color={`var(--tk-${maintStatusTone === "success" ? "success" : maintStatusTone})`}
                      />
                    </span>
                    <strong
                      style={{
                        font: "600 15px/20px var(--tk-font-sans)",
                        color: "var(--tk-ink-900)",
                        flex: 1,
                      }}
                    >
                      {r.type} Maintenance
                    </strong>
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  </div>
                  <InfoRow icon="hash" label="Maintenance ID" value={r.id} />
                  <InfoRow
                    icon="building-2"
                    label="Service Center"
                    value={r.serviceCenter}
                  />
                  <InfoRow
                    icon="calendar"
                    label={RECORD_DATE_LABEL[r.status]}
                    value={r.dueDate}
                  />
                  <InfoRow
                    icon="badge"
                    label="Service Type"
                    value={<Badge tone="info">{r.type}</Badge>}
                  />
                  <InfoRow
                    icon="gauge"
                    label="Odometer Reading"
                    value={km(r.currentOdometer)}
                  />
                  <InfoRow
                    icon="calendar-clock"
                    label="Next Due"
                    value={`${km(r.nextDueOdometer)} or ${r.nextDueDate}`}
                  />
                </div>
                <div>
                  <span className="tk-meta">Service Items Performed</span>
                  {checklist.map((c) => (
                    <div className="mdet-checklist-row" key={c}>
                      <Icon
                        name={
                          r.status === "Completed" || r.status === "In Progress"
                            ? "circle-check"
                            : "circle"
                        }
                        size={14}
                        color={
                          r.status === "Completed"
                            ? "var(--tk-success)"
                            : "var(--tk-ink-300)"
                        }
                      />
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Maintenance History"
              action={
                <button
                  style={{
                    border: 0,
                    background: "none",
                    color: "var(--tk-blue)",
                    cursor: "pointer",
                  }}
                  onClick={() => setTab("Maintenance History")}
                >
                  View All
                </button>
              }
              pad="none"
            >
              <HistoryTable
                rows={historyRows}
                onView={(row) =>
                  notify(
                    "info",
                    row.self
                      ? "You are viewing this record."
                      : "Historical record — read only.",
                  )
                }
              />
            </SectionCard>
          </div>

          <div className="mdet-rail">
            <SectionCard title="Compliance & Eligibility">
              {compliance.map((c) => (
                <div className="mdet-compliance-row" key={c.label}>
                  <Icon
                    name={c.ok ? "circle-check" : "circle-x"}
                    size={18}
                    color={c.ok ? "var(--tk-success)" : "var(--tk-danger)"}
                  />
                  <div>
                    <strong
                      style={{
                        display: "block",
                        font: "600 13px/18px var(--tk-font-sans)",
                        color: c.ok ? "var(--tk-success)" : "var(--tk-danger)",
                      }}
                    >
                      {c.label}
                    </strong>
                    <span className="tk-meta">{c.hint}</span>
                  </div>
                </div>
              ))}
            </SectionCard>

            <SectionCard title="KM-Based Maintenance Schedule">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span className="tk-meta">
                  Current:{" "}
                  <strong style={{ color: "var(--tk-ink-900)" }}>
                    {km(r.currentOdometer)}
                  </strong>
                </span>
                <span className="tk-meta">
                  Next Due:{" "}
                  <strong style={{ color: "var(--tk-ink-900)" }}>
                    {km(r.nextDueOdometer)}
                  </strong>
                </span>
              </div>
              <ProgressBar
                value={r.currentOdometer}
                max={scaleMax}
                color="var(--tk-blue)"
              />
              <div className="mdet-km-scale">
                <span>0 km</span>
                <span>{scaleMax.toLocaleString("en-NG")} km</span>
              </div>
              <Banner tone="info" style={{ marginTop: 12 }}>
                Next maintenance is due at {km(r.nextDueOdometer)} or by{" "}
                {r.nextDueDate}, whichever comes first.
              </Banner>
            </SectionCard>

            <QuickActionsCard
              title="Quick Actions"
              items={[
                {
                  label: "View Maintenance History",
                  icon: "history",
                  onClick: () => setTab("Maintenance History"),
                },
                {
                  label: "View Upcoming Maintenance",
                  icon: "calendar-clock",
                  onClick: () => setTab("Upcoming Maintenance"),
                },
                {
                  label: "View Documents",
                  icon: "file-text",
                  onClick: () => setTab("Documents"),
                },
                {
                  label: "View Asset Profile",
                  icon: "truck",
                  onClick: () =>
                    navigate("/fleet/" + encodeURIComponent(r.plate)),
                },
                {
                  label: "Flag for Review",
                  icon: "flag",
                  tone: "danger",
                  onClick: () => setFlagOpen(true),
                },
                {
                  label: "Suspend Asset",
                  icon: "ban",
                  tone: "danger",
                  onClick: () => setSuspendOpen(true),
                },
              ]}
            />
          </div>
        </div>
      )}

      {tab === "Maintenance History" && (
        <SectionCard
          title="Maintenance History"
          count={historyRows.length}
          pad="none"
        >
          <HistoryTable
            rows={historyRows}
            onView={(row) =>
              notify(
                "info",
                row.self
                  ? "You are viewing this record."
                  : "Historical record — read only.",
              )
            }
          />
        </SectionCard>
      )}

      {tab === "Upcoming Maintenance" && (
        <SectionCard title="Upcoming Maintenance">
          {upcoming.map((u, i) => (
            <div className="mdet-upcoming-row" key={u.title + i}>
              <span className="mdet-upcoming-ico">
                <Icon
                  name={u.type === "Inspection" ? "shield-check" : "wrench"}
                  size={16}
                />
              </span>
              <div style={{ flex: 1 }}>
                <strong
                  style={{
                    display: "block",
                    font: "600 13px/18px var(--tk-font-sans)",
                    color: "var(--tk-ink-900)",
                  }}
                >
                  {u.title}
                </strong>
                <span className="tk-meta">
                  {u.dueDate ? `Due ${u.dueDate}` : u.hint}
                  {u.dueOdometer != null ? ` · at ${km(u.dueOdometer)}` : ""}
                </span>
              </div>
              <Badge tone="info">{u.type}</Badge>
            </div>
          ))}
        </SectionCard>
      )}

      {tab === "KM & Usage" && (
        <div className="mdet-main">
          <div className="mdet-stat-row">
            <StatBox
              icon="gauge"
              label="Current Odometer"
              value={km(r.currentOdometer)}
            />
            <StatBox
              icon="calendar-clock"
              label="Next Due In"
              value={r.nextDueDays != null ? `${r.nextDueDays} days` : "—"}
              caption={km(remainingKm)}
            />
            <StatBox
              icon="trending-up"
              label="Avg. Monthly Distance"
              value={km(avgMonthlyKm)}
            />
          </div>
          <SectionCard title="KM-Based Maintenance Schedule">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span className="tk-meta">
                Current:{" "}
                <strong style={{ color: "var(--tk-ink-900)" }}>
                  {km(r.currentOdometer)}
                </strong>
              </span>
              <span className="tk-meta">
                Next Due:{" "}
                <strong style={{ color: "var(--tk-ink-900)" }}>
                  {km(r.nextDueOdometer)}
                </strong>
              </span>
            </div>
            <ProgressBar
              value={r.currentOdometer}
              max={scaleMax}
              color="var(--tk-blue)"
            />
            <div className="mdet-km-scale">
              <span>0 km</span>
              <span>{scaleMax.toLocaleString("en-NG")} km</span>
            </div>
          </SectionCard>
          <SectionCard title="Monthly Distance Covered">
            <BarChart
              series={[
                { name: "Distance", color: "var(--tk-blue)", points: monthly },
              ]}
              labels={MONTH_LABELS}
              format={(v) => Math.round(v / 1000) + "k"}
            />
          </SectionCard>
        </div>
      )}

      {tab === "Documents" && (
        <SectionCard title={`Documents (${r.attachments.length})`}>
          {r.attachments.length === 0 ? (
            <EmptyState
              icon="file-text"
              title="No documents"
              description="No documents have been attached to this maintenance record."
            />
          ) : (
            r.attachments.map((x) => (
              <button
                className="maint-attachment"
                style={{
                  width: "100%",
                  border: 0,
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                }}
                key={x[0]}
                onClick={() => dl({ ...r, id: x[0] })}
              >
                <span className="ico">
                  <Icon name="file-text" size={13} />
                </span>
                <span>
                  <strong>{x[0]}</strong>
                  <small className="tk-meta" style={{ display: "block" }}>
                    {x[1]}
                  </small>
                </span>
              </button>
            ))
          )}
        </SectionCard>
      )}

      <Modal
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        title="Flag for Review"
        description={`Flag ${r.id} for compliance review.`}
        width={480}
        footer={
          <>
            <Button variant="outline" onClick={() => setFlagOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" icon="flag" onClick={submitFlag}>
              Flag Record
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          rows={4}
          placeholder="Why is this record being flagged for review?"
          value={flagReason}
          onChange={(e) => setFlagReason(e.target.value)}
        />
      </Modal>

      <Modal
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        title="Suspend Asset"
        description={`Suspend ${r.plate} from active duty? It will no longer be eligible for new jobs until reactivated.`}
        width={460}
        footer={
          <>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" icon="ban" onClick={confirmSuspend}>
              Suspend Asset
            </Button>
          </>
        }
      />
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="maint-info" style={{ alignItems: "center" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Icon name={icon} size={13} color="var(--tk-ink-300)" />
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function StatBox({ icon, label, value, caption }) {
  return (
    <Card style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: "var(--tk-r-lg)",
          background: "var(--tk-blue-soft)",
          color: "var(--tk-blue)",
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        <Icon name={icon} size={18} />
      </span>
      <span>
        <span className="tk-meta" style={{ display: "block" }}>
          {label}
        </span>
        <strong
          style={{
            font: "700 16px/22px var(--tk-font-sans)",
            color: "var(--tk-ink-900)",
          }}
        >
          {value}
        </strong>
        {caption && (
          <span className="tk-meta" style={{ display: "block" }}>
            {caption}
          </span>
        )}
      </span>
    </Card>
  );
}

function HistoryTable({ rows, onView }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.n}
      columns={[
        { key: "n", header: "#", width: 32 },
        { key: "date", header: "Date" },
        {
          key: "odometer",
          header: "Odometer (km)",
          render: (r) => r.odometer.toLocaleString("en-NG"),
        },
        {
          key: "serviceType",
          header: "Service Type",
          render: (r) => <Badge tone="info">{r.serviceType}</Badge>,
        },
        { key: "description", header: "Description" },
        { key: "serviceCenter", header: "Service Center" },
        {
          key: "status",
          header: "Status",
          render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>,
        },
        {
          key: "actions",
          header: "Actions",
          render: (r) => (
            <Button
              size="sm"
              variant="outline"
              icon="eye"
              onClick={() => onView(r)}
            >
              View
            </Button>
          ),
        },
      ]}
    />
  );
}
