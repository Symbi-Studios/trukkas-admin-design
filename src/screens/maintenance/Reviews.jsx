"use client";
import { useState } from "react";
import { useNavigate } from "../../router.js";
import { Badge, Button, DataTable, Icon, LabelValue, Modal, Pagination, SectionCard, TextField, Textarea } from "../../ds.js";
import { DriverTableLoading } from "../DriversLoading.jsx";
import {
  maintenanceError, maintenanceHref, useGetAdminMaintenanceQuery, useGetAdminMaintenanceSubmissionsQuery,
  useReviewAdminMaintenanceRequestMutation, useVerifyAdminMaintenanceCompletionMutation,
} from "../../store/features/maintenance/maintenanceApi.js";
import { ReadState, ReasonModal, km, naira } from "./shared.jsx";

const TYPE_TONE = { Preventive: "info", Repair: "orange", Inspection: "success", Breakdown: "danger" };

/**
 * Two queues an admin clears:
 * 1. Service requests a company raised, approved into the schedule or declined (live).
 * 2. Completed servicing a company submitted, verified before any restriction is cleared (proposed).
 */
export function Reviews({ owner, authenticated, canWrite, notify }) {
  return (
    <div className="maint-main">
      <CompletionQueue owner={owner} authenticated={authenticated} canWrite={canWrite} notify={notify} />
      <RequestQueue owner={owner} authenticated={authenticated} canWrite={canWrite} notify={notify} />
    </div>
  );
}

function RequestQueue({ owner, authenticated, canWrite, notify }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const list = useGetAdminMaintenanceQuery({ owner, tab: "requested", page, limit: 10 }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const [review, reviewState] = useReviewAdminMaintenanceRequestMutation();
  const [approving, setApproving] = useState(null);
  const [declining, setDeclining] = useState(null);
  const [error, setError] = useState("");
  const rows = list.error ? [] : list.currentData?.rows || [];

  async function decide(payload, done) {
    if (!canWrite) return notify("Your account cannot review maintenance requests.");
    setError("");
    try { await review(payload).unwrap(); done(); notify(payload.decision === "approve" ? "Request approved and scheduled." : "Request declined. The company has been told why."); }
    catch (err) { setError(maintenanceError(err)); }
  }

  return (
    <SectionCard
      title="Service Requests"
      description="Companies request servicing; approving it puts it on the schedule."
      count={list.currentData?.pagination.total ?? undefined}
      pad="none"
    >
      {list.isFetching ? <DriverTableLoading columns={6} label="Loading requests" /> : list.error ? <ReadState error={list.error} retry={list.refetch} /> : !rows.length ? (
        <div className="maint-clear" style={{ padding: 20 }}><Icon name="circle-check" size={16} color="var(--tk-success)" /> No requests waiting.</div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(maintenanceHref(r.id))}
          columns={[
            { key: "truck", header: "Truck", render: (r) => <span className="maint-cell"><strong>{r.plate}</strong><small>{r.company}</small></span> },
            { key: "type", header: "Type", render: (r) => <Badge tone={TYPE_TONE[r.type]}>{r.type}</Badge> },
            { key: "description", header: "Work requested", render: (r) => <span style={{ fontSize: 12 }}>{r.description}</span> },
            { key: "due", header: "Requested for", render: (r) => <span className="maint-cell"><strong>{r.dueDate}</strong><small>{r.serviceCenter}</small></span> },
            { key: "cost", header: "Est. cost", render: (r) => naira(r.estimatedCost) },
            { key: "x", header: "", render: (r) => canWrite ? (
              <span style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="outline" onClick={() => { setError(""); setDeclining(r); }}>Decline</Button>
                <Button size="sm" icon="check" onClick={() => { setError(""); setApproving(r); }}>Approve</Button>
              </span>
            ) : null },
          ]}
        />
      )}
      {(list.currentData?.pagination.totalPages || 1) > 1 && <Pagination page={page} pageCount={list.currentData.pagination.totalPages} pageSize={10} total={list.currentData.pagination.total} onPage={setPage} />}
      {approving && <ApproveModal record={approving} busy={reviewState.isLoading} error={error} onClose={() => setApproving(null)} onConfirm={(values) => decide({ id: approving.id, decision: "approve", ...values }, () => setApproving(null))} />}
      <ReasonModal
        open={!!declining}
        title={`Decline ${declining?.reference || "request"}`}
        description="The company sees this reason and can raise a new request."
        confirmLabel="Decline request"
        tone="danger"
        busy={reviewState.isLoading}
        error={error}
        onClose={() => setDeclining(null)}
        onConfirm={(reason) => decide({ id: declining.id, decision: "reject", reason }, () => setDeclining(null))}
      />
    </SectionCard>
  );
}

function ApproveModal({ record, busy, error, onClose, onConfirm }) {
  const [values, setValues] = useState({ dueDate: record.dueAt?.slice(0, 10) || "", serviceCenterName: record.serviceCenter === "—" ? "" : record.serviceCenter, serviceCenterLocation: record.location === "—" ? "" : record.location, notes: "" });
  const set = (key) => (e) => setValues({ ...values, [key]: e.target.value });
  return (
    <Modal
      open
      onClose={() => { if (!busy) onClose(); }}
      title={`Approve ${record.reference}`}
      description={`${record.plate} · ${record.company}. Adjust the date or workshop if needed; the company is notified.`}
      width={560}
      footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || !values.dueDate} onClick={() => onConfirm(values)}>{busy ? "Approving…" : "Approve and schedule"}</Button></>}
    >
      <div className="maint-form">
        <TextField label="Scheduled date" type="date" value={values.dueDate} onChange={set("dueDate")} />
        <div className="maint-form-grid">
          <TextField label="Workshop" maxLength={120} value={values.serviceCenterName} onChange={set("serviceCenterName")} />
          <TextField label="Workshop location" maxLength={200} value={values.serviceCenterLocation} onChange={set("serviceCenterLocation")} />
        </div>
        <Textarea label="Note to the company (optional)" rows={2} maxLength={2000} value={values.notes} onChange={set("notes")} />
        {error && <span role="alert" className="tk-meta" style={{ color: "var(--tk-danger)" }}>{error}</span>}
      </div>
    </Modal>
  );
}

function CompletionQueue({ owner, authenticated, canWrite, notify }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const query = useGetAdminMaintenanceSubmissionsQuery({ owner, page, limit: 10 }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const [verify, verifyState] = useVerifyAdminMaintenanceCompletionMutation();
  const [open, setOpen] = useState(null);
  const [returning, setReturning] = useState(null);
  const [error, setError] = useState("");
  const rows = query.error ? [] : query.currentData?.rows || [];

  async function decide(record, decision, reason) {
    if (!canWrite) return notify("Your account cannot verify maintenance.");
    setError("");
    try {
      await verify({ id: record.id, decision, reason }).unwrap();
      setOpen(null); setReturning(null);
      notify(decision === "verify" ? `${record.plate} verified. Requirements recalculated and any restriction it satisfied is lifted.` : "Sent back to the company with your note.");
    } catch (err) { setError(maintenanceError(err)); }
  }

  return (
    <SectionCard
      title="Completions to Verify"
      description="A truck is only cleared after Trukkas checks the service record and invoice."
      count={query.currentData?.pagination.total ?? undefined}
      pad="none"
    >
      {query.isFetching ? <DriverTableLoading columns={6} label="Loading submissions" /> : query.error ? <ReadState error={query.error} retry={query.refetch} title="Completion verification is coming" /> : !rows.length ? (
        <div className="maint-clear" style={{ padding: 20 }}><Icon name="circle-check" size={16} color="var(--tk-success)" /> Nothing waiting for verification.</div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setOpen(r)}
          columns={[
            { key: "truck", header: "Truck", render: (r) => <span className="maint-cell"><strong>{r.plate}</strong><small>{r.company}</small></span> },
            { key: "work", header: "Work performed", render: (r) => <span style={{ fontSize: 12 }}>{r.completion?.workPerformed || r.description}</span> },
            { key: "odo", header: "Odometer", render: (r) => km(r.completion?.odometer) },
            { key: "cost", header: "Cost", render: (r) => naira(r.completion?.actualCost) },
            { key: "docs", header: "Invoice", render: (r) => r.completion?.documents.length ? <Badge tone="success">{r.completion.documents.length} file{r.completion.documents.length > 1 ? "s" : ""}</Badge> : <Badge tone="danger">Missing</Badge> },
            { key: "x", header: "", render: (r) => <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setOpen(r); }}>Review</Button> },
          ]}
        />
      )}
      {(query.currentData?.pagination.totalPages || 1) > 1 && <Pagination page={page} pageCount={query.currentData.pagination.totalPages} pageSize={10} total={query.currentData.pagination.total} onPage={setPage} />}
      {open && (
        <Modal
          open
          onClose={() => { if (!verifyState.isLoading) setOpen(null); }}
          title={`Verify ${open.reference}`}
          description={`${open.plate} · ${open.company} · submitted ${open.completion?.submittedAt || "—"} by ${open.completion?.submittedBy || "—"}`}
          width={620}
          footer={<>
            <Button variant="outline" onClick={() => navigate(maintenanceHref(open.id))}>Open record</Button>
            <span style={{ flex: 1 }} />
            <Button variant="danger" disabled={!canWrite || verifyState.isLoading} onClick={() => { setError(""); setReturning(open); }}>Send back</Button>
            <Button icon="shield-check" disabled={!canWrite || verifyState.isLoading || !open.completion?.documents.length} onClick={() => decide(open, "verify")}>{verifyState.isLoading ? "Verifying…" : "Verify and clear"}</Button>
          </>}
        >
          <div className="maint-verify">
            <LabelValue label="Work performed" value={open.completion?.workPerformed || "—"} layout="stack" />
            <div className="maint-verify-grid">
              <LabelValue label="Completed on" value={open.completion?.completedAt || "—"} layout="stack" />
              <LabelValue label="Odometer at service" value={km(open.completion?.odometer)} layout="stack" />
              <LabelValue label="Workshop" value={open.completion?.workshop || "—"} layout="stack" />
              <LabelValue label="Actual cost" value={naira(open.completion?.actualCost)} layout="stack" />
              <LabelValue label="Next due (distance)" value={km(open.completion?.nextDueKm)} layout="stack" />
              <LabelValue label="Next due (date)" value={open.completion?.nextDueDate || "—"} layout="stack" />
            </div>
            <div>
              <span className="tk-meta">Supporting documents</span>
              {open.completion?.documents.length ? open.completion.documents.map((doc) => (
                <a key={doc.id} className="maint-attachment" href={doc.url || undefined} target="_blank" rel="noreferrer">
                  <span className="ico"><Icon name="file-text" size={14} /></span><strong>{doc.name}</strong>
                </a>
              )) : <div className="maint-clear" style={{ color: "var(--tk-danger)" }}>No invoice attached. Send it back to request one.</div>}
            </div>
            {error && <span role="alert" className="tk-meta" style={{ color: "var(--tk-danger)" }}>{error}</span>}
          </div>
        </Modal>
      )}
      <ReasonModal
        open={!!returning}
        title="Send back to the company"
        description="The record returns to In Progress. Say what is missing or wrong."
        label="What needs fixing"
        confirmLabel="Send back"
        tone="danger"
        busy={verifyState.isLoading}
        error={error}
        onClose={() => setReturning(null)}
        onConfirm={(reason) => decide(returning, "return", reason)}
      />
    </SectionCard>
  );
}
