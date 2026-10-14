"use client";
import { useEffect, useState } from "react";
import { useNavigate } from "../router.js";
import { Modal, Button, TextField, SearchField, DataTable, Pagination, Badge, EmptyState } from "../ds.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
import {
  maintenanceError, maintenanceHref, maintenanceWindow,
  useGetAdminMaintenanceServiceCentersQuery, useGetAdminMaintenanceCalendarQuery,
  useGetAdminMaintenancePoliciesQuery, useUpdateAdminMaintenancePoliciesMutation,
} from "../store/features/maintenance/maintenanceApi.js";

function ReadError({ error, retry }) {
  return <><EmptyState icon="wrench" title={maintenanceError(error)} /><Button variant="outline" onClick={retry}>Retry</Button></>;
}
export function MaintenanceActionDialogs({ kind, ...props }) {
  if (kind === "centers") return <ServiceCenters {...props} />;
  if (kind === "calendar") return <MaintenanceCalendar {...props} />;
  if (kind === "policies") return <MaintenancePolicies {...props} />;
  return null;
}
function ServiceCenters({ owner, onClose }) {
  const [page, setPage] = useState(1), [search, setSearch] = useState("");
  const query = useGetAdminMaintenanceServiceCentersQuery({ owner, page, limit: 10, search }, { refetchOnMountOrArgChange: true });
  const data = query.error ? null : query.currentData;
  return <Modal open onClose={onClose} title="Service Centers" width={760} footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
    <SearchField value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search service centers..." />
    {query.isFetching ? <DriverTableLoading columns={2} label="Loading service centers" /> : query.error ? <ReadError error={query.error} retry={query.refetch} /> : !data?.rows.length ? <EmptyState icon="building-2" title="No service centers found" /> : <DataTable rows={data.rows} rowKey={row => row.id} columns={[{ key: "name", header: "Name" }, { key: "location", header: "Location" }]} />}
    <Pagination page={page} pageSize={10} total={data?.total ?? "—"} pageCount={data?.totalPages ?? null} onPage={value => { if (data?.totalPages != null) setPage(Math.max(1, Math.min(value, Math.max(1, data.totalPages)))); }} />
  </Modal>;
}
function MaintenanceCalendar({ owner, onClose }) {
  const navigate = useNavigate();
  const initial = maintenanceWindow(30);
  const [from, setFrom] = useState(initial.dateFrom.slice(0, 10)), [to, setTo] = useState(initial.dateTo.slice(0, 10));
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && Number.isFinite(days) && days >= 0 && days < 92;
  const query = useGetAdminMaintenanceCalendarQuery({ owner, from, to }, { skip: !valid, refetchOnMountOrArgChange: true });
  const rows = query.error ? [] : query.currentData || [];
  return <Modal open onClose={onClose} title="Maintenance Calendar" width={960} footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
    <div className="maint-form-grid"><TextField type="date" label="From" value={from} onChange={event => setFrom(event.target.value)} /><TextField type="date" label="To" value={to} onChange={event => setTo(event.target.value)} /></div>
    {!valid ? <EmptyState icon="calendar" title="Choose a date range of up to 92 days" /> : query.isFetching ? <DriverTableLoading columns={5} label="Loading maintenance calendar" /> : query.error ? <ReadError error={query.error} retry={query.refetch} /> : !rows.length ? <EmptyState icon="calendar" title="No maintenance scheduled in this range" /> : <DataTable rows={rows} rowKey={row => row.id} columns={[
      { key: "calendarDate", header: "Date" }, { key: "reference", header: "Maintenance ID" }, { key: "plate", header: "Truck" },
      { key: "description", header: "Description" }, { key: "status", header: "Status", render: row => <Badge>{row.status}</Badge> },
      { key: "actions", header: "Actions", render: row => <Button size="sm" variant="outline" onClick={() => { onClose(); navigate(maintenanceHref(row.id)); }}>View</Button> },
    ]} />}
  </Modal>;
}
function MaintenancePolicies({ owner, role, onClose }) {
  const query = useGetAdminMaintenancePoliciesQuery({ owner }, { refetchOnMountOrArgChange: true });
  const [save, state] = useUpdateAdminMaintenancePoliciesMutation();
  const [values, setValues] = useState({ overdueGraceDays: "", dueSoonDays: "", mileageLimitKm: "" });
  const [error, setError] = useState(null);
  useEffect(() => {
    if (query.currentData && !query.error) setValues(Object.fromEntries(Object.entries(query.currentData).map(([key, value]) => [key, value ?? ""])));
  }, [query.currentData, query.error]);
  const canWrite = role === "SUPER_ADMIN";
  const edit = key => event => setValues(current => ({ ...current, [key]: event.target.value }));
  async function submit() {
    if (!canWrite || state.isLoading) return;
    setError(null);
    try { await save(values).unwrap(); onClose(); }
    catch (failure) { setError(failure); }
  }
  return <Modal open onClose={onClose} title="Maintenance Rules" width={560} footer={<><Button variant="outline" disabled={state.isLoading} onClick={onClose}>Cancel</Button><Button disabled={!canWrite || query.isFetching || !!query.error || state.isLoading || Object.values(values).some(value => value === "")} onClick={submit}>Save Changes</Button></>}>
    {query.isFetching ? <DriverTableLoading columns={2} label="Loading maintenance rules" /> : query.error ? <ReadError error={query.error} retry={query.refetch} /> : <div className="maint-form">
      <TextField label="Overdue Grace Days (0–60)" type="number" min={0} max={60} value={values.overdueGraceDays} disabled={!canWrite} onChange={edit("overdueGraceDays")} />
      <TextField label="Due Soon Days (1–90)" type="number" min={1} max={90} value={values.dueSoonDays} disabled={!canWrite} onChange={edit("dueSoonDays")} />
      <TextField label="Mileage Limit (500–100,000 km)" type="number" min={500} max={100000} value={values.mileageLimitKm} disabled={!canWrite} onChange={edit("mileageLimitKm")} />
    </div>}
    {error && <EmptyState icon="wrench" title={maintenanceError(error)} />}
  </Modal>;
}
