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
  Avatar,
  Icon,
  DropdownMenu,
  Modal,
  Textarea,
  DataTable,
  TextField,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { updateMaintenance } from "../mock/api.js";
import "./Maintenance.css";
const money = (n) =>
  n == null
    ? "—"
    : "₦" + Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 });
function dl(r) {
  const u = URL.createObjectURL(
    new Blob([
      `${r.id}\n${r.plate}\n${r.description}\n${money(r.estimatedCost)}`,
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
    [menu, setMenu] = useState(false),
    [noteOpen, setNoteOpen] = useState(false),
    [note, setNote] = useState(""),
    [costOpen, setCostOpen] = useState(false),
    [cost, setCost] = useState(r?.actualCost || ""),
    [toast, setToast] = useState("");
  function notify(s) {
    setToast(s);
    setTimeout(() => setToast(""), 1600);
  }
  if (!r) return <Card>Maintenance record not found.</Card>;
  const completed = r.status === "Completed";
  async function addNote() {
    await updateMaintenance(r.id, {
      notes: (r.notes ? r.notes + "\n" : "") + note,
    });
    setNote("");
    setNoteOpen(false);
    notify("Note added");
  }
  return (
    <div className="maint-page">
      <PageHeader
        crumbs={["Fleet", "Maintenance", "Maintenance Details"]}
        title="View Maintenance"
        description="Detailed information about this maintenance activity."
        actions={
          <>
            <Button
              variant="outline"
              icon="printer"
              onClick={() => window.print()}
            >
              Print
            </Button>
            <Button variant="outline" icon="download" onClick={() => dl(r)}>
              Download
            </Button>
            <span style={{ position: "relative" }}>
              <Button
                variant="outline"
                iconRight="chevron-down"
                onClick={() => setMenu(!menu)}
              >
                Actions
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
                        label: "Start Maintenance",
                        icon: "play",
                        onClick: () => {
                          updateMaintenance(r.id, { status: "In Progress" });
                          setMenu(false);
                          notify("Maintenance started");
                        },
                      },
                      {
                        label: "Mark Completed",
                        icon: "circle-check",
                        onClick: () => {
                          setMenu(false);
                          setCostOpen(true);
                        },
                      },
                      {
                        label: "Reschedule",
                        icon: "calendar-clock",
                        onClick: () => {
                          setMenu(false);
                          notify("Maintenance rescheduled");
                        },
                      },
                      { divider: true },
                      {
                        label: "Cancel Maintenance",
                        icon: "circle-x",
                        tone: "danger",
                        onClick: () => {
                          updateMaintenance(r.id, { status: "Cancelled" });
                          setMenu(false);
                          notify("Maintenance cancelled");
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
      <div className="maint-detail-grid">
        <div className="maint-detail-main">
          <Card pad="none">
            <div className="maint-entity">
              <div className="maint-truck-hero">
                <span className="maint-truck-round">
                  <Icon name="truck" size={40} />
                </span>
                <div>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <h2>{r.plate}</h2>
                    <Badge tone="success">Active</Badge>
                  </div>
                  <strong style={{ fontSize: 11 }}>{r.truckType}</strong>
                  <div className="tk-meta" style={{ margin: "7px 0" }}>
                    {r.truckRef}
                  </div>
                  <strong style={{ fontSize: 10 }}>{r.company}</strong>
                  <div className="tk-meta">{r.companyId}</div>
                </div>
              </div>
              <Hero label="Maintenance ID" value={r.id} />
              <Hero label="Status" value={<Badge>{r.status}</Badge>} />
              <Hero
                label="Priority"
                value={
                  <>
                    <i
                      style={{
                        display: "inline-block",
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "var(--tk-blue)",
                        marginRight: 6,
                      }}
                    />
                    {r.priority}
                  </>
                }
              />
              <Hero label="Type" value={<Badge tone="info">{r.type}</Badge>} />
              <Hero
                label="Due Date"
                value={
                  <>
                    {r.dueDate}
                    <Badge
                      tone="info"
                      style={{ display: "flex", marginTop: 5 }}
                    >
                      {r.dueLabel} left
                    </Badge>
                  </>
                }
              />
              <Hero label="Created On" value={r.createdOn} />
              <Hero
                label="Created By"
                value={
                  <span
                    style={{ display: "flex", gap: 7, alignItems: "center" }}
                  >
                    <Avatar name={r.createdBy} size={27} />
                    {r.createdBy}
                  </span>
                }
              />
            </div>
          </Card>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              "Overview",
              "Work Details",
              "Parts & Costs",
              "Service History",
              "Documents",
              "Notes & Logs",
            ]}
          />
          {tab === "Overview" ? (
            <div className="maint-overview">
              <div className="maint-left">
                <SectionCard title="Maintenance Information">
                  <Info label="Type" value={r.type} />
                  <Info label="Category" value={r.category} />
                  <Info label="Description" value={r.description} />
                  <Info label="Service Center" value={r.serviceCenter} />
                  <Info label="Location" value={r.location} />
                  <Info label="Odometer" value={r.odometer} />
                  <Info label="Engine Hours" value={r.engineHours} />
                  <Info label="Schedule Based On" value={r.scheduleBasedOn} />
                  <Info label="Last Maintenance" value={r.lastMaintenance} />
                  <Info label="Next Maintenance" value={r.nextMaintenance} />
                </SectionCard>
                <SectionCard title="Truck Location">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.3fr 1fr",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div className="maint-map" />
                    <div>
                      <strong style={{ fontSize: 10 }}>Maintenance Hub</strong>
                      <p className="tk-meta">
                        Apapa, Lagos State
                        <br />
                        Nigeria
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        icon="map-pin"
                        onClick={() => notify("Map opened")}
                      >
                        View on Map
                      </Button>
                    </div>
                  </div>
                </SectionCard>
                <SectionCard title="Service Checklist" pad="none">
                  <div style={{ padding: "0 12px 10px" }}>
                    {r.checklist.slice(0, 4).map((x, i) => (
                      <button
                        className="maint-check"
                        style={{
                          width: "100%",
                          borderLeft: 0,
                          borderRight: 0,
                          borderTop: 0,
                          background: "transparent",
                          textAlign: "left",
                        }}
                        key={x}
                        onClick={() => {
                          const checked = [...(r.checked || [])];
                          const next = checked.includes(i)
                            ? checked.filter((n) => n !== i)
                            : [...checked, i];
                          updateMaintenance(r.id, { checked: next });
                        }}
                      >
                        <span
                          style={{
                            color: (r.checked || []).includes(i)
                              ? "var(--tk-success)"
                              : "var(--tk-ink-700)",
                          }}
                        >
                          <Icon
                            name={
                              (r.checked || []).includes(i)
                                ? "circle-check"
                                : "circle"
                            }
                            size={11}
                          />{" "}
                          {x}
                        </span>
                        <span>
                          {(r.checked || []).includes(i)
                            ? "Completed"
                            : "Pending"}
                        </span>
                      </button>
                    ))}
                    <div style={{ marginTop: 8, fontSize: 9 }}>
                      {(r.checked || []).length} of {r.checklist.length}{" "}
                      completed{" "}
                      <span style={{ float: "right" }}>
                        {Math.round(
                          ((r.checked || []).length / r.checklist.length) * 100,
                        )}
                        %
                      </span>
                    </div>
                  </div>
                </SectionCard>
              </div>
              <div className="maint-left">
                <SectionCard title="Status & Progress">
                  <div className="maint-progress-flow">
                    {["Scheduled", "In Progress", "Completed", "Verified"].map(
                      (x, i) => (
                        <div
                          className={
                            "maint-stage " +
                            (i <=
                            [
                              "Scheduled",
                              "In Progress",
                              "Completed",
                              "Verified",
                            ].indexOf(r.status)
                              ? "active"
                              : "")
                          }
                          key={x}
                        >
                          <i>
                            <Icon
                              name={
                                i === 0
                                  ? "calendar"
                                  : i === 1
                                    ? "wrench"
                                    : i === 2
                                      ? "check"
                                      : "shield-check"
                              }
                              size={13}
                            />
                          </i>
                          {x}
                        </div>
                      ),
                    )}
                  </div>
                  <hr
                    style={{ border: 0, borderTop: "1px solid var(--tk-line)" }}
                  />
                  <h4 style={{ margin: "10px 0 4px", fontSize: 11 }}>
                    Timeline
                  </h4>
                  {[
                    ["Maintenance Scheduled", r.createdOn],
                    [
                      "Started",
                      r.status === "Scheduled" ? "Not started" : "Just now",
                    ],
                    ["Completed", completed ? "Just now" : "Not completed"],
                    [
                      "Verified",
                      r.status === "Verified" ? "Just now" : "Not verified",
                    ],
                  ].map((x, i) => (
                    <div className="maint-time-row" key={x[0]}>
                      <i
                        style={{
                          background:
                            i === 0 ? "var(--tk-blue)" : "var(--tk-neutral)",
                        }}
                      />
                      <span>
                        <strong>{x[0]}</strong>
                        <small className="tk-meta">{x[1]}</small>
                      </span>
                      {i === 0 && (
                        <span>
                          {r.createdBy}
                          <br />
                          <small>{r.creatorId}</small>
                        </span>
                      )}
                    </div>
                  ))}
                </SectionCard>
                <SectionCard
                  title="Notes"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      icon="plus"
                      onClick={() => setNoteOpen(true)}
                    >
                      Add Note
                    </Button>
                  }
                >
                  <p
                    style={{
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "var(--tk-ink-700)",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {r.notes || "No notes added."}
                  </p>
                </SectionCard>
              </div>
            </div>
          ) : (
            <TabPanel tab={tab} r={r} notify={notify} />
          )}
          <div className="maint-driver-due">
            <span className="maint-driver-icon">
              <Icon name="clock-3" size={22} />
            </span>
            <div>
              <strong>Driver Due for Maintenance</strong>
              <small className="tk-meta">
                This driver has a vehicle due for maintenance.
              </small>
            </div>
            <div>
              <span className="tk-meta">Driver</span>
              <br />
              <strong>{r.driver}</strong>
              <br />
              <small>{r.driverId}</small>
            </div>
            <div>
              <span className="tk-meta">Truck</span>
              <br />
              <strong style={{ color: "var(--tk-blue)" }}>{r.plate}</strong>
              <br />
              <small>{r.truckType}</small>
            </div>
            <div>
              <span className="tk-meta">Maintenance Due</span>
              <br />
              <strong>{r.dueDate}</strong>
              <br />
              <Badge tone="info">{r.dueLabel} left</Badge>
            </div>
            <div>
              <span className="tk-meta">Status</span>
              <br />
              <Badge>{r.status}</Badge>
            </div>
            <Button
              variant="outline"
              iconRight="chevron-right"
              className="w-fit"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              View Maintenance
            </Button>
          </div>
        </div>
        <div className="maint-detail-rail">
          <SectionCard title="Maintenance Summary">
            <Info label="Maintenance ID" value={r.id} />
            <Info label="Status" value={r.status} />
            <Info label="Priority" value={r.priority} />
            <Info label="Type" value={r.type} />
            <Info
              label="Due Date"
              value={
                <span style={{ color: "var(--tk-blue)" }}>
                  {r.dueDate} ({r.dueLabel} left)
                </span>
              }
            />
            <Info label="Total Estimated Cost" value={money(r.estimatedCost)} />
            <Info label="Total Actual Cost" value={money(r.actualCost)} />
            <Info label="Created On" value={r.createdOn} />
          </SectionCard>
          <SectionCard title="Cost Summary">
            <Info label="Estimated Cost" value={money(r.estimatedCost)} />
            <Info label="Parts Cost (Est.)" value={money(r.partsCost)} />
            <Info label="Labor Cost (Est.)" value={money(r.laborCost)} />
            <Info label="Other Cost (Est.)" value={money(r.otherCost)} />
            <div className="maint-cost-total">
              <Info
                label={<b>Total Estimated</b>}
                value={
                  <b style={{ color: "var(--tk-blue)" }}>
                    {money(r.estimatedCost)}
                  </b>
                }
              />
            </div>
          </SectionCard>
          <SectionCard
            title="Attachments (2)"
            action={
              <button
                style={{
                  border: 0,
                  background: "none",
                  color: "var(--tk-blue)",
                }}
                onClick={() => setTab("Documents")}
              >
                View all
              </button>
            }
          >
            {r.attachments.map((x) => (
              <button
                className="maint-attachment"
                style={{
                  width: "100%",
                  border: 0,
                  background: "transparent",
                  textAlign: "left",
                }}
                key={x[0]}
                onClick={() => dl({ ...r, id: x[0] })}
              >
                <span className="ico">
                  <Icon name="files" size={13} />
                </span>
                <span>
                  <strong>{x[0]}</strong>
                  <small className="tk-meta" style={{ display: "block" }}>
                    {x[1]}
                  </small>
                </span>
              </button>
            ))}
          </SectionCard>
          <SectionCard title="Related Information">
            <Action
              label="Truck"
              value={`${r.plate} (${r.truckType})`}
              onClick={() => navigate("/fleet")}
            />
            <Action
              label="Truck Company"
              value={r.company}
              onClick={() => navigate("/companies/" + r.companyId)}
            />
            <Action
              label="Driver"
              value={`${r.driver} (${r.driverId})`}
              onClick={() => navigate("/drivers/" + r.driverId)}
            />
            <Action
              label="Service Center"
              value={r.serviceCenter}
              onClick={() => notify("Service center opened")}
            />
          </SectionCard>
        </div>
      </div>
      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add Maintenance Note"
        width={500}
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!note.trim()} onClick={addNote}>
              Add Note
            </Button>
          </>
        }
      >
        <Textarea
          rows={5}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add maintenance note..."
        />
      </Modal>
      <Modal
        open={costOpen}
        onClose={() => setCostOpen(false)}
        title="Complete Maintenance"
        width={480}
        footer={
          <>
            <Button variant="outline" onClick={() => setCostOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                updateMaintenance(r.id, {
                  status: "Completed",
                  actualCost: +cost || r.estimatedCost,
                });
                setCostOpen(false);
                notify("Maintenance completed");
              }}
            >
              Complete
            </Button>
          </>
        }
      >
        <TextField
          label="Actual Cost"
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
      </Modal>
      {toast && <div className="maint-toast">{toast}</div>}
    </div>
  );
}
function Hero({ label, value }) {
  return (
    <div className="maint-hero-fact">
      <label>{label}</label>
      <strong>{value}</strong>
    </div>
  );
}
function Info({ label, value }) {
  return (
    <div className="maint-info">
      <span className="tk-meta">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Action({ label, value, onClick }) {
  return (
    <button className="maint-action" onClick={onClick}>
      <span style={{ fontSize: 11, color: "var(--tk-ink-400)", width: 70 }}>
        {label}
      </span>
      <span>
        <strong style={{ color: "var(--tk-blue)" }}>{value}</strong>
      </span>
      <Icon name="chevron-right" size={12} />
    </button>
  );
}
function TabPanel({ tab, r, notify }) {
  if (tab === "Work Details")
    return (
      <SectionCard title="Work Details">
        <Info label="Service Center" value={r.serviceCenter} />
        <Info label="Description" value={r.description} />
        <Info label="Current Status" value={<Badge>{r.status}</Badge>} />
        <Button
          style={{ marginTop: 10 }}
          onClick={() => notify("Work order updated")}
        >
          Update Work Order
        </Button>
      </SectionCard>
    );
  if (tab === "Parts & Costs")
    return (
      <SectionCard title="Parts & Costs">
        <Info label="Parts" value={money(r.partsCost)} />
        <Info label="Labor" value={money(r.laborCost)} />
        <Info label="Other" value={money(r.otherCost)} />
        <Info label="Estimated Total" value={money(r.estimatedCost)} />
      </SectionCard>
    );
  if (tab === "Service History")
    return (
      <SectionCard title="Service History">
        <DataTable
          rows={[
            {
              date: "Apr 20, 2026",
              service: "Preventive maintenance",
              cost: 175000,
            },
            { date: "Jan 12, 2026", service: "Tyre replacement", cost: 220000 },
          ]}
          columns={[
            { key: "date", header: "Date" },
            { key: "service", header: "Service" },
            { key: "cost", header: "Cost", render: (x) => money(x.cost) },
          ]}
        />
      </SectionCard>
    );
  if (tab === "Documents")
    return (
      <SectionCard title="Documents">
        {r.attachments.map((x) => (
          <div className="maint-attachment" key={x[0]}>
            <Icon name="file-text" />
            <span>
              <strong>{x[0]}</strong>
              <small className="tk-meta">{x[1]}</small>
            </span>
          </div>
        ))}
      </SectionCard>
    );
  return (
    <SectionCard title="Notes & Logs">
      <p style={{ whiteSpace: "pre-line", fontSize: 10 }}>{r.notes}</p>
      <Info label="Created" value={r.createdOn} />
      <Info label="Created By" value={r.createdBy} />
    </SectionCard>
  );
}
