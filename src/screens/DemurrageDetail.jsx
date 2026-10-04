"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  Skeleton,
} from "../ds.js";
import {
  useGetAdminDemurrageDirectoryQuery, useGetAdminDemurrageCalculationQuery, useGetAdminDemurrageJobContextQuery,
  mergeDemurrageDetail, demurrageMoney as money, demurrageDays as days, demurrageJobUrl,
} from "../store/features/demurrage/demurrageApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverLoadingNotice } from "./DriversLoading.jsx";
export function DemurrageDetail() {
  const navigate = useNavigate(), params = useParams(), search = useSearchParams();
  const demurrageId = search.get("jobId") || search.get("id") || params.demurrageId || "";
  const directoryQuery = useGetAdminDemurrageDirectoryQuery();
  const matches = (directoryQuery.error ? [] : directoryQuery.currentData?.rows || []).filter((row) => row.jobApiId === demurrageId || (row.id !== "—" && row.id === demurrageId));
  const entry = matches.length === 1 ? matches[0] : null;
  const calculationQuery = useGetAdminDemurrageCalculationQuery(entry?.jobApiId, { skip: !entry });
  const jobQuery = useGetAdminDemurrageJobContextQuery(entry?.jobApiId, { skip: !entry });
  const r = useMemo(() => entry ? mergeDemurrageDetail(entry, calculationQuery.error ? null : calculationQuery.currentData, jobQuery.error ? null : jobQuery.currentData) : null,
    [entry, calculationQuery.currentData, calculationQuery.error, jobQuery.currentData, jobQuery.error]);
  const operationPending = useRef(false), toastTimer = useRef(null), noteDirty = useRef(false);
  const [tab, setTab] = useState("Overview"),
    [menu, setMenu] = useState(false),
    [note, setNote] = useState(""),
    [dispute, setDispute] = useState(false),
    [reason, setReason] = useState("Incorrect charge calculation"),
    [details, setDetails] = useState(""),
    [toast, setToast] = useState("");
  useEffect(() => {
    setTab("Overview"); setMenu(false); setDispute(false); setNote(""); setDetails(""); setToast("");
    setReason("Incorrect charge calculation"); noteDirty.current = false;
    return () => clearTimeout(toastTimer.current);
  }, [demurrageId]);
  useEffect(() => { if (!noteDirty.current && r) setNote(r.note); }, [r]);
  useEffect(() => {
    const error = calculationQuery.error || jobQuery.error;
    if (error) notify(getApiErrorMessage(error));
  }, [calculationQuery.error, jobQuery.error]);
  function notify(s) {
    clearTimeout(toastTimer.current);
    setToast(s);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }
  if ((!directoryQuery.currentData && directoryQuery.isFetching) || (entry && ((!calculationQuery.currentData && calculationQuery.isFetching) || (!jobQuery.currentData && jobQuery.isFetching)))) return <>
    <Card><Skeleton width={180} height={26} /><div style={{ marginTop: 14 }}><Skeleton width="55%" height={14} /></div></Card>
    <DriverLoadingNotice>Loading demurrage details…</DriverLoadingNotice>
    <Card><Skeleton width="40%" height={20} /><div style={{ marginTop: 24 }}><Skeleton height={120} /></div></Card>
  </>;
  if (!r)
    return (
      <Card>
        <p>{directoryQuery.error ? getApiErrorMessage(directoryQuery.error) : "Demurrage record not found."}</p>
        <Button variant="outline" onClick={() => navigate("/demurrage")}>
          Back to Demurrage
        </Button>
      </Card>
    );
  const subtotal = r.subtotal, vat = r.vat, invoiceRows = r.invoices;
  async function saveNote() {
    notify("Saving demurrage notes is not available yet.");
  }
  async function raiseDispute() {
    setDispute(false);
    notify("Raising a demurrage dispute is not available yet.");
  }
  function openInvoice(url) {
    if (!url || !/^https?:\/\//i.test(url)) { notify("Demurrage invoice download is not available yet."); return; }
    window.open(url, "_blank", "noopener,noreferrer");
  }
  async function recalculate() {
    if (operationPending.current || calculationQuery.isFetching || directoryQuery.isFetching) return;
    operationPending.current = true; setMenu(false);
    try {
      const result = await calculationQuery.refetch().unwrap();
      await directoryQuery.refetch().unwrap();
      notify(result.message || "Demurrage calculation refreshed.");
    } catch (error) { notify(getApiErrorMessage(error)); }
    finally { operationPending.current = false; }
  }
  return (
    <div className="grid grid-cols-1 gap-tk-section-gap min-w-0">
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
              onClick={() => openInvoice(r.invoiceUrl)}
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
                          setMenu(false);
                          notify("Marking demurrage as resolved is not available yet.");
                        },
                      },
                      {
                        label: "Recalculate Charge",
                        icon: "calculator",
                        onClick: recalculate,
                      },
                      {
                        label: "Email Customer",
                        icon: "mail",
                        onClick: () => {
                          setMenu(false);
                          notify("Emailing demurrage invoices is not available yet.");
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
        <div className="grid grid-cols-6 py-4 max-[1200px]:grid-cols-3 max-[1200px]:gap-4 max-[1200px]:[&>*:nth-child(3)]:border-r-0 max-[760px]:grid-cols-2 max-[760px]:[&>*:nth-child(3)]:border-r max-[760px]:[&>*:nth-child(2n)]:border-r-0 max-[480px]:grid-cols-1">
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
            sub={r.daysOver == null ? "—" : r.daysOver + " days overdue"}
          />
          <Head
            label="Charge Amount"
            value={money(r.charge)}
            sub={money(r.rate) + " / day"}
          />
          <Head
            label="Days Over"
            value={days(r.daysOver)}
            sub={r.overSince}
            danger
          />
          <Head label="Customer" value={r.customer} sub={r.customerType} />
        </div>
      </Card>
      <div className="grid grid-cols-[minmax(0,1fr)_310px] gap-4 items-start max-[1200px]:grid-cols-1">
        <div className="grid grid-cols-1 gap-3.5 content-start min-w-0">
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
              <div className="grid grid-cols-3 gap-3.5 max-[1200px]:grid-cols-2 max-[760px]:grid-cols-1">
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
                  <Row label="Free Days" value={days(r.freeDays)} />
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
                  <Row label="Rate Type" value={r.rateType} />
                </SectionCard>
                <SectionCard title="Charge Summary" icon="briefcase-business">
                  <Row label="Charge Start Date" value={r.chargeStart} />
                  <Row
                    label="Total Days Used"
                    value={days(r.daysUsed)}
                  />
                  <Row
                    label="Billable Days"
                    value={days(r.daysOver)}
                  />
                  <Row label="Daily Rate" value={money(r.rate)} />
                  <hr
                    style={{ border: 0, borderTop: "1px solid var(--tk-line)" }}
                  />
                  <Row label="Subtotal" value={money(subtotal)} />
                  <Row label="VAT (7.5%)" value={money(vat)} />
                  <div className="mt-2.25 -mx-tk-card-pad -mb-tk-card-pad px-tk-card-pad py-3 bg-tk-blue-soft text-tk-blue text-[11px] font-bold flex justify-between">
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
                  <Row label="Route" value={r.route} />
                  <Row
                    label="Assigned To"
                    value={r.assignedTo}
                  />
                  <Row label="Created On" value={r.createdOn} />
                  <Button
                    variant="outline"
                    fullWidth
                    style={{ marginTop: 8 }}
                    onClick={() => navigate(demurrageJobUrl(r.jobApiId))}
                  >
                    View Job Details
                  </Button>
                </SectionCard>
                <SectionCard title="Parties Involved">
                  <strong style={{ fontSize: 10 }}>Forwarder (Customer)</strong>
                  <Row
                    label={r.customer}
                    value={<Badge tone="success">{r.customerVerification}</Badge>}
                  />
                  <Row
                    label="Email"
                    value={r.customerEmail}
                  />
                  <Row label="Phone" value={r.customerPhone || "—"} />
                  <hr
                    style={{ border: 0, borderTop: "1px solid var(--tk-line)" }}
                  />
                  <strong style={{ fontSize: 10 }}>Shipping Line</strong>
                  <Row
                    label={r.shippingLine}
                    value={<Badge tone="success">{r.lineVerification}</Badge>}
                  />
                  <Row label="Email" value={r.lineEmail} />
                  <Row label="Phone" value={r.linePhone || "—"} />
                </SectionCard>
                <SectionCard title="Admin Notes">
                  <textarea
                    className="w-full box-border min-h-18 p-2.25 border border-tk-line-strong rounded-[7px] outline-none resize-y font-tk-sans text-tk-meta focus:border-tk-blue focus:shadow-tk-focus"
                    placeholder="Add a note about this demurrage (visible to admins only)..."
                    value={note}
                    onChange={(e) => { noteDirty.current = true; setNote(e.target.value); }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginTop: 9,
                    }}
                  >
                    <small className="tk-meta">Last updated {r.noteUpdatedAt}</small>
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
                  rowKey={(x, index) => x.id === "—" ? index : x.id}
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
                            onClick={() => openInvoice(x.url)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            icon="download"
                            aria-label="Download invoice"
                            onClick={() => openInvoice(x.url)}
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
                  View all invoices ({r.invoiceCount ?? "—"})
                </Button>
              </SectionCard>
            </>
          ) : (
            <TabContent
              tab={tab}
              r={r}
              invoices={invoiceRows}
              onDownload={openInvoice}
            />
          )}
        </div>
        <div className="grid grid-cols-1 gap-3.5 content-start min-w-0 max-[1200px]:grid-cols-2 max-[760px]:grid-cols-1">
          <SectionCard title="Demurrage Timeline">
            {[
              [
                "container",
                "Discharge Completed",
                r.timeline.dischargeCompleted.date,
                r.timeline.dischargeCompleted.detail,
              ],
              [
                "calendar",
                "Free Period Started",
                r.timeline.freeStarted.date,
                r.timeline.freeStarted.detail,
              ],
              [
                "circle-check",
                "Free Period Ended",
                r.timeline.freeEnded.date,
                r.timeline.freeEnded.detail,
              ],
              [
                "circle-alert",
                "Demurrage Started",
                r.timeline.chargeStarted.date,
                r.timeline.chargeStarted.detail,
              ],
              [
                "clock-3",
                "Current Status",
                r.timeline.current.date,
                r.timeline.current.detail,
              ],
              [
                "history",
                "Last Updated",
                r.timeline.updated.date,
                r.timeline.updated.detail,
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
                  {money(r.outstanding)}
                </b>
              }
            />
            <button
              className="w-full h-9 border-0 rounded-[7px] bg-[#e8224e] text-white text-[11px] font-semibold font-tk-sans cursor-pointer hover:bg-[#c91840]"
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
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </Modal>
      {toast && (
        <div className="fixed right-6 bottom-6 z-100 bg-tk-ink-900 text-white rounded-[9px] px-4 py-3 shadow-tk-menu text-xs font-medium font-tk-sans">
          {toast}
        </div>
      )}
    </div>
  );
}
function Head({ label, value, sub, link, danger }) {
  return (
    <div className="px-4.5 border-r border-tk-line last:border-r-0 max-[480px]:border-r-0! max-[480px]:border-b max-[480px]:border-tk-line max-[480px]:px-4 max-[480px]:py-2">
      <label className="block text-tk-meta text-tk-ink-400 mb-1.75">
        {label}
      </label>
      <strong
        className={
          "block text-[14px] text-tk-ink-900 whitespace-nowrap " +
          (danger ? "text-tk-danger" : link ? "text-tk-blue" : "")
        }
      >
        {value}
      </strong>
      <small className="tk-meta">{sub}</small>
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2.5 py-1.75 text-tk-meta text-tk-ink-500">
      <span>{label}</span>
      <strong className="text-right text-tk-ink-900">{value}</strong>
    </div>
  );
}
function Timeline({ icon, title, date, detail, danger }) {
  return (
    <div className="grid grid-cols-[25px_1fr] gap-2.25 relative py-2 after:content-[''] after:absolute after:left-3 after:top-8.5 after:-bottom-2.5 after:border-l after:border-dashed after:border-tk-blue last:after:hidden">
      <span
        className={
          "w-6.25 h-6.25 rounded-full grid place-items-center z-1 " +
          (danger
            ? "bg-tk-danger-soft text-tk-danger"
            : "bg-tk-blue-soft text-tk-blue")
        }
      >
        <Icon name={icon} size={12} />
      </span>
      <span>
        <strong
          className={
            "text-tk-meta " + (danger ? "text-tk-danger" : "text-tk-blue")
          }
        >
          {title}
        </strong>
        <small className="block text-tk-micro text-tk-ink-400 leading-3.5 mt-0.75">
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
        <Row label="Formula" value={r.formula} />
        <Row label="Daily Rate" value={money(r.rate)} />
        <Row label="Billable Days" value={r.daysOver ?? "—"} />
        <Row label="Calculated Total" value={money(r.charge)} />
      </>
    ),
    
    Disputes: (
      <p className="tk-meta">
        {r.disputeSummary}
      </p>
    ),
    History: (
      <>
        {[
          ["Created", r.history.created],
          ["Recalculated", r.history.recalculated],
          ["Customer notified", r.history.notified],
        ].map((x) => (
          <Row key={x[0]} label={x[0]} value={x[1]} />
        ))}
      </>
    ),
  };
  return <SectionCard title={tab}>{content[tab] ?? "—"}</SectionCard>;
}
