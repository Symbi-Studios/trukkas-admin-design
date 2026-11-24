"use client";
import { useEffect, useState } from "react";
import { useNavigate } from "../router.js";
import { Modal, Button, TextField, SearchField, DataTable, Pagination, Badge, EmptyState } from "../ds.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
import {
  maintenanceError, maintenanceHref, maintenanceWindow,
  useGetAdminMaintenanceServiceCentersQuery, useGetAdminMaintenanceCalendarQuery,
} from "../store/features/maintenance/maintenanceApi.js";

function ReadError({ error, retry }) {
  return <><EmptyState icon="wrench" title={maintenanceError(error)} /><Button variant="outline" onClick={retry}>Retry</Button></>;
}
export function MaintenanceActionDialogs({ kind, ...props }) {
  if (kind === "centers") return <ServiceCenters {...props} />;
  if (kind === "calendar") return <MaintenanceCalendar {...props} />;
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
