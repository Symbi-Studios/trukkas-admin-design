"use client";

import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from 'next/navigation';
import { useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  SearchField,
  DataTable,
  Pagination,
  Badge,
  Avatar,
  Icon,
  Modal,
  Select,
  TextField,
  Textarea,
  Skeleton,
} from "../ds.js";
import {
  useGetAdminSupportTicketDirectoryQuery, useGetAdminSupportTicketStatsQuery, useGetAdminTicketAgentsQuery,
  useCreateAdminSupportTicketMutation,
  ticketWithAgents, ticketSummary, ticketDetailUrl, TICKET_PRIORITY_CODES, TICKET_STATUS_CODES, TICKET_CATEGORY_CODES,
} from "../store/features/tickets/ticketsApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
import "./Support.css";

const PAGE_SIZE = 6;
const statusTone = {
  Open: "info",
  "In Progress": "purple",
  Pending: "warning",
  Resolved: "success",
  Closed: "neutral",
};
const priorityTone = { High: "danger", Medium: "warning", Low: "neutral" };

export function SupportTickets() {
  const navigate = useNavigate();
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const searchParams = useSearchParams();
  const assignedTo = searchParams.get('assignedTo') === 'me' ? 'me' : undefined;
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [assignedTo]);
  const [create, setCreate] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    customer: "",
    email: "",
    category: "General",
    priority: "Medium",
    description: "",
  });
  const [createTicket, createState] = useCreateAdminSupportTicketMutation();
  const creating = createState.isLoading;
  const createLock = useRef(false), currentOwner = useRef(admin?.id);
  currentOwner.current = admin?.id;
  useEffect(() => { if (!authenticated) setCreate(false); }, [authenticated]);
  useEffect(() => { const timer = setTimeout(() => setSearch(q.trim()), 250); return () => clearTimeout(timer); }, [q]);
  const directory = useGetAdminSupportTicketDirectoryQuery(assignedTo ? { assignedTo } : undefined, { skip: !authenticated });
  const serverFilters = Boolean(search || priority !== "All" || status !== "All" || category !== "All");
  const searched = useGetAdminSupportTicketDirectoryQuery({ search, priority: TICKET_PRIORITY_CODES[priority], status: TICKET_STATUS_CODES[status], category: TICKET_CATEGORY_CODES[category], ...(assignedTo ? { assignedTo } : {}) }, { skip: !authenticated || !serverFilters });
  const statsQuery = useGetAdminSupportTicketStatsQuery(undefined, { skip: !authenticated });
  const agentsQuery = useGetAdminTicketAgentsQuery(undefined, { skip: !authenticated });
  const agents = authenticated && !agentsQuery.error ? agentsQuery.currentData : undefined;
  const tickets = authenticated && !directory.error ? directory.currentData : undefined;
  const source = serverFilters ? searched : directory;
  const rows = authenticated && !source.error ? source.currentData : undefined;
  const loading = authenticated && (source.isFetching || q.trim() !== search);
  const summary = ticketSummary(tickets, authenticated && !statsQuery.error ? statsQuery.currentData : undefined);
  const value = (content) => statsQuery.isFetching ? <Skeleton as="span" width={54} height={23} /> : content;
  const categories = Object.keys(TICKET_CATEGORY_CODES);
  const filtersAvailable = Boolean(rows);
  const filtered = rows || [];
  const total = filtersAvailable ? filtered.length : null;
  const pageCount = total == null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paged = filtersAvailable ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((ticket) => ticketWithAgents(ticket, agents)) : [];
  useEffect(() => { if (pageCount != null && page > pageCount) setPage(pageCount); }, [page, pageCount]);

  async function submitTicket() {
    if (createLock.current || creating || !authenticated) return;
    const owner = admin?.id;
    createLock.current = true;
    try {
      const saved = await createTicket({ values: form }).unwrap();
      if (currentOwner.current !== owner) return;
      setCreate(false);
      setForm({ subject: '', customer: '', email: '', category: 'General', priority: 'Medium', description: '' });
      navigate(ticketDetailUrl(saved.id));
    } catch (error) { if (currentOwner.current === owner) window.alert(getApiErrorMessage(error)); }
    finally { createLock.current = false; }
  }

  return (
    <div className="support-page">
      <PageHeader
        crumbs={["Support System", "Tickets"]}
        title="Support Tickets"
        description="View, manage and respond to customer support requests."
        actions={
          <Button icon="plus" onClick={() => setCreate(true)}>
            New Ticket
          </Button>
        }
      />
      <div className="support-stats">
        <StatCard
          icon="ticket"
          label="Total Tickets"
          value={value(summary.total)}
          delta={summary.changes.total.delta}
          direction={summary.changes.total.direction}
          caption="from last 7 days"
        />
        <StatCard
          icon="circle-dot"
          tint="blue"
          label="Open"
          value={value(summary.open)}
          delta={summary.changes.open.delta}
          direction={summary.changes.open.direction}
          caption="from last 7 days"
        />
        <StatCard
          icon="loader-circle"
          tint="purple"
          label="In Progress"
          value={value(summary.progress)}
          delta={summary.changes.progress.delta}
          direction={summary.changes.progress.direction}
          caption="from last 7 days"
        />
        <StatCard
          icon="clock-3"
          tint="amber"
          label="Pending"
          value={value(summary.pending)}
          delta={summary.changes.pending.delta}
          direction={summary.changes.pending.direction}
          caption="from last 7 days"
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Resolved"
          value={value(summary.resolved)}
          delta={summary.changes.resolved.delta}
          direction={summary.changes.resolved.direction}
          caption="from last 7 days"
        />
      </div>
      <SectionCard title="" pad="none">
        <div className="support-toolbar">
          <SearchField
            className="grow"
            style={{ flex: 1, minWidth: 240 }}
            placeholder="Search tickets, customers, subjects..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Filter by status"
            className="support-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {[
              "All",
              "Open",
              "In Progress",
              "Pending",
              "Resolved",
              "Closed",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Filter by priority"
            className="support-select"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
          >
            {["All", "High", "Medium", "Low"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Filter by category"
            className="support-select"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option>All</option>
            {categories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <Button
            variant="outline"
            icon="rotate-ccw"
            onClick={() => {
              setQ("");
              setStatus("All");
              setPriority("All");
              setCategory("All");
              setPage(1);
            }}
          >
            Reset
          </Button>
        </div>
        {loading ? <DriverTableLoading columns={7} label="Loading tickets" /> : <DataTable
          rows={paged}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(ticketDetailUrl(r.id))}
          columns={[
            {
              key: "subject",
              header: "Ticket",
              render: (r) => (
                <span className="support-title-cell">
                  <strong>{r.subject}</strong>
                  <small>
                    {r.id} · {r.customer}
                  </small>
                </span>
              ),
            },
            {
              key: "category",
              header: "Category",
              render: (r) => <Badge tone="info">{r.category}</Badge>,
            },
            {
              key: "priority",
              header: "Priority",
              render: (r) => (
                <Badge tone={priorityTone[r.priority]} dot>
                  {r.priority}
                </Badge>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={statusTone[r.status]} dot>
                  {r.status}
                </Badge>
              ),
            },
            {
              key: "assignee",
              header: "Assigned To",
              render: (r) => (
                <span className="support-person">
                  <Avatar name={r.assignee} size={24} />
                  <span>{r.assignee}</span>
                </span>
              ),
            },
            { key: "updated", header: "Last Updated" },
            {
              key: "actions",
              header: "Actions",
              width: 54,
              render: (r) => (
                <button
                  className="support-row-action"
                  aria-label={"Open " + r.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(ticketDetailUrl(r.id));
                  }}
                >
                  <Icon name="ellipsis-vertical" size={16} />
                </button>
              ),
            },
          ]}
        />}
        {!loading && !paged.length && (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--tk-ink-400)",
            }}
          >
            {source.error ? getApiErrorMessage(source.error) : !filtersAvailable ? "—" : "No tickets match your filters."}
          </div>
        )}
        <Pagination
          page={page}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
          total={total}
          onPage={(p) =>
            pageCount != null && setPage(
              Math.min(
                Math.max(p, 1),
                pageCount,
              ),
            )
          }
        />
      </SectionCard>
      <Modal
        open={create}
        onClose={() => { if (!creating) setCreate(false); }}
        title="New Support Ticket"
        description="Create a support request on behalf of a customer."
        width={580}
        footer={
          <>
            <Button variant="outline" disabled={creating} onClick={() => setCreate(false)}>
              Cancel
            </Button>
            <Button
              disabled={creating || !authenticated || !form.subject.trim() || !form.email.trim() || !form.description.trim() || !TICKET_CATEGORY_CODES[form.category]}
              onClick={submitTicket}
            >
              Create Ticket
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <TextField
            label="Subject"
            value={form.subject}
            disabled={creating}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <TextField
              label="Customer"
              value={form.customer}
              disabled={creating}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
            />
            <TextField
              label="Email"
              value={form.email}
              disabled={creating}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Select
              label="Category"
              value={form.category}
              disabled={creating}
              options={categories}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <Select
              label="Priority"
              value={form.priority}
              disabled={creating}
              options={["High", "Medium", "Low"]}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
          </div>
          <Textarea
            label="Description"
            rows={4}
            value={form.description}
            disabled={creating}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
