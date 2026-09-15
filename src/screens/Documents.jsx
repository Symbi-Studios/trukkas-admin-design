"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  DropdownMenu,
  EmptyState,
  FilterSelect,
  IconButton,
  Modal,
  PageHeader,
  Pagination,
  SearchField,
  StatCard,
  TableToolbar,
  Tabs,
  Textarea,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import {
  approveOperationalDocument,
  bulkReviewOperationalDocuments,
  rejectOperationalDocument,
} from "../mock/api.js";
import {
  canAdminReview,
  documentStatusTone,
  groupDocumentsByJob,
} from "../domain/documents.js";
import "./Documents.css";

const requirementLabels = {
  tdo: "TDO",
  customs_gate_pass: "Customs Gate Pass",
  exit_note: "Exit Note",
  indemnity_letter: "Indemnity Letter",
  confirmation_letter: "Confirmation Letter",
};

const formatTime = (value) =>
  value === "—" ? "—" : value?.replace(/ \d{2}:\d{2} [AP]M$/, "") || "—";

export function Documents() {
  const navigate = useNavigate();
  const documents = useCollection("documents");
  const jobs = useCollection("jobs");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All document types");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [companyFilter, setCompanyFilter] = useState("All companies");
  const [openFilter, setOpenFilter] = useState(null);
  const [expandedJob, setExpandedJob] = useState("JOB-29818");
  const [selected, setSelected] = useState([]);
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const grouped = useMemo(
    () => groupDocumentsByJob(jobs, documents),
    [jobs, documents],
  );
  const companies = useMemo(
    () => [...new Set(grouped.map((item) => item.company))],
    [grouped],
  );
  const allTypes = useMemo(
    () => [...new Set(documents.map((item) => item.requirement))],
    [documents],
  );
  const allStatuses = useMemo(
    () => [...new Set(documents.map((item) => item.status))],
    [documents],
  );
  const totals = useMemo(
    () =>
      documents.reduce(
        (out, item) => {
          out.total += 1;
          if (item.status === "Approved") out.approved += 1;
          else if (item.status === "Rejected") out.rejected += 1;
          else if (item.status === "Missing") out.missing += 1;
          else out.pending += 1;
          return out;
        },
        { total: 0, approved: 0, pending: 0, rejected: 0, missing: 0 },
      ),
    [documents],
  );

  const filtered = useMemo(
    () =>
      grouped
        .map((entry) => {
          const query = search.toLowerCase();
          const jobText = [entry.id, entry.company, entry.job.route]
            .join(" ")
            .toLowerCase();
          const scopedDocuments = entry.documents.filter(
            (doc) =>
              (typeFilter === "All document types" ||
                doc.requirement === typeFilter) &&
              (statusFilter === "All statuses" ||
                doc.status === statusFilter) &&
              (!query ||
                jobText.includes(query) ||
                `${doc.name} ${requirementLabels[doc.requirement]}`
                  .toLowerCase()
                  .includes(query)),
          );
          return { ...entry, visibleDocuments: scopedDocuments };
        })
        .filter((entry) => {
          if (
            companyFilter !== "All companies" &&
            entry.company !== companyFilter
          )
            return false;
          if (!entry.visibleDocuments.length) return false;
          if (
            tab === "missing" &&
            !entry.visibleDocuments.some((doc) => doc.status === "Missing")
          )
            return false;
          if (
            tab === "status" &&
            !entry.visibleDocuments.some((doc) =>
              ["Pending Review", "Re-upload Requested", "Rejected"].includes(
                doc.status,
              ),
            )
          )
            return false;
          return true;
        }),
    [grouped, search, companyFilter, typeFilter, statusFilter, tab],
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const reviewableSelected = documents.filter(
    (doc) => selected.includes(doc.id) && canAdminReview(doc),
  );

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("All document types");
    setStatusFilter("All statuses");
    setCompanyFilter("All companies");
    setTab("all");
    setOpenFilter(null);
    setPage(1);
  };
  const selectFilter = (setter, value) => {
    setter(value);
    setOpenFilter(null);
    setPage(1);
  };
  const openAction = (kind, docs) => {
    setReason("");
    setAction({ kind, docs });
  };
  const completeAction = async () => {
    if (!action) return;
    const ids = action.docs.map((doc) => doc.id);
    if (action.kind === "approve")
      await bulkReviewOperationalDocuments(ids, "approve");
    else
      await bulkReviewOperationalDocuments(
        ids,
        action.kind === "request" ? "request-reupload" : "reject",
        reason,
      );
    setSelected([]);
    setAction(null);
    setNotice(
      action.kind === "approve"
        ? "Document approval completed."
        : action.kind === "request"
          ? "Re-upload request sent to the forwarder."
          : "Document rejection recorded.",
    );
  };

  const columns = [
    {
      key: "expand",
      header: "",
      width: 36,
      render: (row) => (
        <IconButton
          label={expandedJob === row.id ? "Collapse job" : "Expand job"}
          icon={expandedJob === row.id ? "chevron-down" : "chevron-right"}
          onClick={() => setExpandedJob(expandedJob === row.id ? null : row.id)}
        />
      ),
    },
    {
      key: "id",
      header: "Job ID",
      width: 115,
      render: (row) => (
        <div>
          <strong className="documents-job-id">{row.id}</strong>
          <div>
            <Badge
              tone={
                row.job.status === "Delivered"
                  ? "success"
                  : row.job.status === "Cancelled"
                    ? "danger"
                    : "warning"
              }
            >
              {row.job.status || "In transit"}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      key: "route",
      header: "Route",
      width: 165,
      render: (row) => (
        <div>
          <strong>{row.job.route || "—"}</strong>
          <small>{row.job.origin || "Nigeria"}</small>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      width: 180,
      render: (row) => (
        <div className="documents-company">
          <Avatar name={row.company} size={28} />
          <span>{row.company}</span>
        </div>
      ),
    },
    {
      key: "jobType",
      header: "Job type",
      width: 110,
      render: (row) => (
        <Badge tone={row.jobType === "Import" ? "info" : "neutral"}>
          {row.jobType}
        </Badge>
      ),
    },
    {
      key: "total",
      header: "Documents",
      align: "center",
      render: (row) => <strong>{row.summary.total}</strong>,
    },
    {
      key: "approved",
      header: "Approved",
      align: "center",
      render: (row) => (
        <span className="documents-count is-approved">
          ● {row.summary.approved}
        </span>
      ),
    },
    {
      key: "pending",
      header: "Pending",
      align: "center",
      render: (row) => (
        <span className="documents-count is-pending">
          ● {row.summary.pending}
        </span>
      ),
    },
    {
      key: "rejected",
      header: "Rejected",
      align: "center",
      render: (row) => (
        <span className="documents-count is-rejected">
          ● {row.summary.rejected}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Last updated",
      width: 125,
      render: (row) => formatTime(row.updatedAt),
    },
  ];

  return (
    <div className="documents-screen">
      <PageHeader
        crumbs={[{ label: "Operations" }, { label: "Documents" }]}
        title="Documents"
        description="Review job documents and follow up on missing submissions."
        actions={<FilterSelect label="May 24 – May 30, 2026" icon="calendar" />}
      />

      {notice && (
        <Banner tone="success" onClose={() => setNotice("")}>
          {notice}
        </Banner>
      )}
      <div className="documents-stats-grid">
        <StatCard
          icon="file-text"
          label="Total Documents"
          value={totals.total.toLocaleString()}
          trend="Job documents tracked"
          tint="blue"
          delta="14.6%"
          caption="vs previous week"
        />
        <StatCard
          icon="circle-check"
          label="Approved Documents"
          value={totals.approved.toLocaleString()}
          trend="Ready for job progression"
          tint="green"
          delta="15.3%"
          caption="vs previous week"
        />
        <StatCard
          icon="clock"
          label="Pending Review"
          value={totals.pending.toLocaleString()}
          trend="Includes re-upload requests"
          tint="amber"
          delta="8.1%"
          caption="vs previous week"
        />
        <StatCard
          icon="circle-x"
          label="Rejected Documents"
          value={totals.rejected.toLocaleString()}
          trend="Requires follow-up"
          tint="red"
          delta="2.4%"
          direction="down"
          caption="vs previous week"
        />
      </div>

      <Tabs
        value={tab}
        onChange={(value) => {
          setTab(value);
          setPage(1);
        }}
        items={[
          { value: "all", label: "All Jobs" },
          { value: "type", label: "By Document Type" },
          { value: "status", label: "By Status" },
          {
            value: "missing",
            label: "Missing Documents",
            count: totals.missing,
          },
        ]}
      />
      <Card className="documents-table-card" pad="none">
        <TableToolbar
          style={{ padding: "var(--tk-space-4) var(--tk-card-pad-tight)" }}
          search={
            <SearchField
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by Job ID, document name, company, route..."
            />
          }
          filters={
            <div className="documents-filter-buttons">
              <DocumentFilter
                label={
                  typeFilter === "All document types"
                    ? typeFilter
                    : requirementLabels[typeFilter]
                }
                active={typeFilter !== "All document types"}
                open={openFilter === "type"}
                onToggle={() =>
                  setOpenFilter(openFilter === "type" ? null : "type")
                }
                items={["All document types", ...allTypes].map((value) => ({
                  label:
                    value === "All document types"
                      ? value
                      : requirementLabels[value],
                  icon: value === typeFilter ? "check" : undefined,
                  onClick: () => selectFilter(setTypeFilter, value),
                }))}
              />
              <DocumentFilter
                label={statusFilter}
                active={statusFilter !== "All statuses"}
                open={openFilter === "status"}
                onToggle={() =>
                  setOpenFilter(openFilter === "status" ? null : "status")
                }
                items={["All statuses", ...allStatuses].map((value) => ({
                  label: value,
                  icon: value === statusFilter ? "check" : undefined,
                  onClick: () => selectFilter(setStatusFilter, value),
                }))}
              />
              <DocumentFilter
                label={companyFilter}
                active={companyFilter !== "All companies"}
                open={openFilter === "company"}
                align="right"
                onToggle={() =>
                  setOpenFilter(openFilter === "company" ? null : "company")
                }
                items={["All companies", ...companies].map((value) => ({
                  label: value,
                  icon: value === companyFilter ? "check" : undefined,
                  onClick: () => selectFilter(setCompanyFilter, value),
                }))}
              />
            </div>
          }
          trailing={
            reviewableSelected.length ? (
              <Button
                size="sm"
                onClick={() => openAction("approve", reviewableSelected)}
              >
                Approve selected ({reviewableSelected.length})
              </Button>
            ) : null
          }
          onClear={
            search ||
            typeFilter !== "All document types" ||
            statusFilter !== "All statuses" ||
            companyFilter !== "All companies"
              ? resetFilters
              : undefined
          }
        />
        {paged.length ? (
          <DataTable
            columns={columns}
            rows={paged}
            rowKey={(row) => row.id}
            coloredHeader
            tableLayout="fixed"
            expandedRowKeys={expandedJob ? [expandedJob] : []}
            renderExpandedRow={(row) => (
              <ExpandedJob
                row={row}
                selected={selected}
                setSelected={setSelected}
                navigate={navigate}
                onAction={openAction}
              />
            )}
          />
        ) : (
          <EmptyState
            icon="file-text"
            title="No job documents found"
            description="Try adjusting the current filters."
          />
        )}
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          pageCount={Math.max(1, Math.ceil(filtered.length / pageSize))}
          onPage={setPage}
          onPageSize={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      </Card>

      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        title={
          action?.kind === "approve"
            ? "Approve document"
            : action?.kind === "request"
              ? "Request re-upload"
              : "Reject document"
        }
      >
        <p className="tk-muted">
          {action?.kind === "approve"
            ? `Approve ${action?.docs.length || 0} selected document(s)?`
            : "Add a clear reason for the forwarder. This is saved with the document."}
        </p>
        {action?.kind !== "approve" && (
          <Textarea
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain what needs to be corrected…"
          />
        )}
        <div className="documents-modal-actions">
          <Button variant="secondary" onClick={() => setAction(null)}>
            Cancel
          </Button>
          <Button
            variant={action?.kind === "reject" ? "danger" : "primary"}
            onClick={completeAction}
            disabled={action?.kind !== "approve" && !reason.trim()}
          >
            {action?.kind === "approve"
              ? "Approve"
              : action?.kind === "request"
                ? "Send request"
                : "Reject document"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default Documents;

function DocumentFilter({
  label,
  active,
  open,
  onToggle,
  items,
  align = "left",
}) {
  return (
    <span className="documents-filter-menu">
      <FilterSelect label={label} active={active} onClick={onToggle} />
      {open && (
        <span className={`documents-filter-dropdown is-${align}`}>
          <DropdownMenu width={220} items={items} />
        </span>
      )}
    </span>
  );
}

function ExpandedJob({ row, selected, setSelected, navigate, onAction }) {
  const shownDocuments = row.visibleDocuments || row.documents;
  const reviewable = shownDocuments.filter(canAdminReview);
  const documentColumns = [
    {
      key: "index",
      header: "#",
      width: 44,
      render: (doc) => shownDocuments.indexOf(doc) + 1,
    },
    {
      key: "name",
      header: "Document",
      width: 200,
      render: (doc) => (
        <div>
          <strong>{doc.name}</strong>
          {doc.status !== "Missing" && (
            <small>
              {doc.fileSize} · v{doc.version}
            </small>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Document type",
      width: 145,
      render: (doc) => (
        <Badge tone="neutral">{requirementLabels[doc.requirement]}</Badge>
      ),
    },
    {
      key: "uploadedBy",
      header: "Uploaded by",
      width: 160,
      render: (doc) => (
        <div>
          {doc.uploadedBy}
          <small>{doc.uploadedByRole}</small>
        </div>
      ),
    },
    {
      key: "uploadedAt",
      header: "Date uploaded",
      width: 135,
      render: (doc) => formatTime(doc.uploadedAt),
    },
    {
      key: "status",
      header: "Status",
      width: 145,
      render: (doc) => (
        <Badge tone={documentStatusTone(doc.status)}>{doc.status}</Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: 245,
      render: (doc) => (
        <div className="documents-row-actions">
          <Button
            size="sm"
            variant="secondary"
            disabled={doc.status === "Missing"}
            onClick={() => navigate(`/documents/${doc.id}`)}
          >
            View
          </Button>
          {canAdminReview(doc) && (
            <>
              <Button size="sm" onClick={() => onAction("approve", [doc])}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onAction("request", [doc])}
              >
                Re-upload
              </Button>
              <IconButton
                label="Reject document"
                icon="x"
                onClick={() => onAction("reject", [doc])}
              />
            </>
          )}
        </div>
      ),
    },
  ];
  return (
    <div className="documents-expanded">
      <div className="documents-expanded-head">
        <div>
          <h2>Documents for {row.id}</h2>
          <p>
            {row.job.route || "Route unavailable"} · {row.company}
          </p>
        </div>
        <div className="documents-summary">
          <span>{row.summary.total} Total</span>
          <span className="is-approved">● {row.summary.approved} Approved</span>
          <span className="is-pending">● {row.summary.pending} Pending</span>
          <span className="is-rejected">● {row.summary.rejected} Rejected</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(`/jobs/${row.id}`)}
        >
          View Job Details
        </Button>
      </div>
      {row.jobType === "Export" && (
        <Banner tone="info">
          Export documents are reviewed by the trucking company. Admins can view
          their status but cannot approve or reject them.
        </Banner>
      )}
      <DataTable
        columns={documentColumns}
        rows={shownDocuments}
        rowKey={(doc) => doc.id}
        selectable
        selected={selected}
        onSelect={setSelected}
        tableLayout="fixed"
        coloredHeader
      />
      {reviewable.length > 1 && (
        <div className="documents-expanded-footer">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAction("request", reviewable)}
          >
            Request re-upload for pending documents
          </Button>
        </div>
      )}
    </div>
  );
}
