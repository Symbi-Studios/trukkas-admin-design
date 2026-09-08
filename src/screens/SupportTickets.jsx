"use client";

import { useMemo, useState } from "react";
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
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { createSupportTicket } from "../mock/api.js";
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
  const tickets = useCollection("supportTickets") || [];
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    customer: "",
    email: "",
    category: "Trips & Jobs",
    priority: "Medium",
    description: "",
  });
  const categories = [...new Set(tickets.map((t) => t.category))];
  const filtered = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (status === "All" || t.status === status) &&
          (priority === "All" || t.priority === priority) &&
          (category === "All" || t.category === category) &&
          (!q ||
            [t.id, t.subject, t.customer, t.company].some((v) =>
              v.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [tickets, q, status, priority, category],
  );
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const counts = {
    open: tickets.filter((t) => t.status === "Open").length,
    progress: tickets.filter((t) => t.status === "In Progress").length,
    pending: tickets.filter((t) => t.status === "Pending").length,
    resolved: tickets.filter(
      (t) => t.status === "Resolved" || t.status === "Closed",
    ).length,
  };

  async function submitTicket() {
    const ticket = await createSupportTicket(form);
    setCreate(false);
    navigate("/tickets/" + ticket.id);
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
          value={tickets.length}
          delta="12%"
          caption="from last 7 days"
        />
        <StatCard
          icon="circle-dot"
          tint="blue"
          label="Open"
          value={counts.open}
          delta="8%"
          caption="from last 7 days"
        />
        <StatCard
          icon="loader-circle"
          tint="purple"
          label="In Progress"
          value={counts.progress}
          delta="4%"
          caption="from last 7 days"
        />
        <StatCard
          icon="clock-3"
          tint="amber"
          label="Pending"
          value={counts.pending}
          delta="2%"
          caption="from last 7 days"
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Resolved"
          value={counts.resolved}
          delta="18%"
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
        <DataTable
          rows={paged}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate("/tickets/" + r.id)}
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
                    navigate("/tickets/" + r.id);
                  }}
                >
                  <Icon name="ellipsis-vertical" size={16} />
                </button>
              ),
            },
          ]}
        />
        {!paged.length && (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--tk-ink-400)",
            }}
          >
            No tickets match your filters.
          </div>
        )}
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPage={(p) =>
            setPage(
              Math.min(
                Math.max(p, 1),
                Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
              ),
            )
          }
        />
      </SectionCard>
      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title="New Support Ticket"
        description="Create a support request on behalf of a customer."
        width={580}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreate(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.subject || !form.customer}
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
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <TextField
              label="Customer"
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
            />
            <TextField
              label="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Select
              label="Category"
              value={form.category}
              options={categories}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <Select
              label="Priority"
              value={form.priority}
              options={["High", "Medium", "Low"]}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
          </div>
          <Textarea
            label="Description"
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
