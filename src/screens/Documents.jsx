"use client";

import { useEffect, useMemo, useState } from "react";
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
  Skeleton,
  StatCard,
  TableToolbar,
  Tabs,
  Textarea,
} from "../ds.js";
import {
  useApproveAdminDocumentMutation,
  useApproveAdminJobDocumentsMutation,
  useGetAdminDocReviewQueueQuery,
  useGetAdminDocReviewStatsQuery,
  useGetAdminDocReviewDetailQuery,
  useRejectAdminDocumentMutation,
  useRejectAdminJobDocumentsMutation,
} from "../store/features/documents/documentsApi.js";
import { canAdminReview, documentStatusTone } from "../domain/documents.js";
import "./Documents.css";

const requirementLabels = {
  tdo: "TDO",
  customs_gate_pass: "Customs Gate Pass",
  exit_note: "Exit Note",
  indemnity_letter: "Indemnity Letter",
  confirmation_letter: "Confirmation Letter",
};

const statusOptions = [
  ["All statuses", "all"],
  ["Awaiting approval", "awaiting"],
  ["Approved", "approved"],
  ["Rejected", "rejected"],
];

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-NG", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function canReviewDocument(document) {
  return Boolean(document?.id) && canAdminReview(document);
}

function requestError(error) {
  const message = error?.data?.message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.join(" ");
  return error?.status === 403 ? "Your account cannot review these documents." : "The request could not be completed.";
}

function DocumentsLoading() {
  return (
    <div className="documents-screen" aria-busy="true" role="status" aria-label="Loading documents">
      <Card><Skeleton width={180} height={26} /></Card>
      <div className="documents-stats-grid">{Array.from({ length: 4 }, (_, index) => <Card key={index}><Skeleton width="55%" height={14} /><div style={{ marginTop: 16 }}><Skeleton width={70} height={28} /></div></Card>)}</div>
      <Card><Skeleton height={320} /></Card>
    </div>
  );
}

export function Documents() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All document types");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [companyFilter, setCompanyFilter] = useState("All companies");
  const [openFilter, setOpenFilter] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const queueStatus = statusOptions.find(([label]) => label === statusFilter)?.[1] || "all";
  const {
    currentData: queue,
    isLoading: queueLoading,
    isFetching: queueFetching,
    error: queueError,
    refetch: refetchQueue,
  } = useGetAdminDocReviewQueueQuery({ status: queueStatus, search, page, limit: pageSize }, {
    refetchOnMountOrArgChange: true,
  });
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } =
    useGetAdminDocReviewStatsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [approveJob] = useApproveAdminJobDocumentsMutation();
  const [rejectJob] = useRejectAdminJobDocumentsMutation();
  const [approveDocument] = useApproveAdminDocumentMutation();
  const [rejectDocument] = useRejectAdminDocumentMutation();

  const grouped = queue?.rows || [];
  const companies = useMemo(
    () => [...new Set(grouped.map((item) => item.company))],
    [grouped],
  );
  const allTypes = useMemo(
    () => [...new Set(grouped.flatMap((item) => item.documentTypes))],
    [grouped],
  );
  const totals = stats?.documentCounts;

  const filtered = useMemo(
    () =>
      grouped.filter((entry) =>
        (companyFilter === "All companies" || entry.company === companyFilter) &&
        (typeFilter === "All document types" || entry.documentTypes.includes(typeFilter)) &&
        (tab !== "status" || statusFilter !== "All statuses" || ["awaiting", "rejected"].includes(entry.job.statusCode.toLowerCase())) &&
        (tab !== "missing" || (entry.summary.missing != null && entry.summary.missing > 0)),
      ),
    [grouped, companyFilter, typeFilter, statusFilter, tab],
  );

  const reviewableSelected = selectedDocs.filter(canReviewDocument);

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setTypeFilter("All document types");
    setStatusFilter("All statuses");
    setCompanyFilter("All companies");
    setTab("all");
    setOpenFilter(null);
    setPage(1);
    setSelectedDocs([]);
  };
  const selectFilter = (setter, value) => {
    setter(value);
    setOpenFilter(null);
    setPage(1);
  };
  const openAction = (kind, docs) => {
    setReason("");
    setAction(kind === "approveJob" || kind === "rejectJob" ? { kind, jobId: docs.jobId } : { kind, docs });
  };
  const completeAction = async () => {
    if (!action || submitting) return;
    setSubmitting(true);
    let completed = 0;
    try {
      if (action.kind === "approveJob") await approveJob(action.jobId).unwrap();
      else if (action.kind === "rejectJob") await rejectJob({ jobId: action.jobId, reason: reason.trim() }).unwrap();
      else for (const doc of action.docs) {
        if (action.kind === "approve") await approveDocument({ jobId: doc.jobId, documentId: doc.id }).unwrap();
        else await rejectDocument({ jobId: doc.jobId, documentId: doc.id, reason: reason.trim() }).unwrap();
        completed += 1;
        setSelectedDocs((current) => current.filter((item) => item.rowKey !== doc.rowKey));
        setAction((current) => current?.docs ? { ...current, docs: current.docs.filter((item) => item.rowKey !== doc.rowKey) } : current);
      }
      setSelectedDocs([]);
      setAction(null);
      setNotice({ tone: "success", title: action.kind === "approveJob" ? "Job documents approved." : action.kind === "rejectJob" ? "Job documents rejected." : action.kind === "approve" ? "Document approval completed." : action.kind === "request" ? "Re-upload request sent to the forwarder." : "Document rejection recorded." });
    } catch (error) {
      setNotice({ tone: "danger", title: completed ? `${completed} document(s) updated before the request stopped. ${requestError(error)}` : requestError(error) });
    } finally {
      setSubmitting(false);
    }
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
          onClick={() => {
            setExpandedJob(expandedJob === row.id ? null : row.id);
            setSelectedDocs([]);
          }}
        />
      ),
    },
    {
      key: "id",
      header: "Job ID",
      width: 115,
      render: (row) => (
        <div>
          <strong className="documents-job-id">{row.displayId}</strong>
          <div>
            <Badge
              tone={
                row.job.statusCode === "approved"
                  ? "success"
                  : row.job.statusCode === "rejected"
                    ? "danger"
                    : "warning"
              }
            >
              {row.job.status}
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
          {row.job.origin && <small>{row.job.origin}</small>}
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
          <span>{row.company || "—"}</span>
        </div>
      ),
    },
    {
      key: "jobType",
      header: "Job type",
      width: 110,
      render: (row) => (
        row.jobType ? <Badge tone={row.jobType === "Import" ? "info" : "neutral"}>{row.jobType}</Badge> : "—"
      ),
    },
    {
      key: "total",
      header: "Documents",
      align: "center",
      render: (row) => <strong>{row.summary.total ?? "—"}</strong>,
    },
    {
      key: "approved",
      header: "Approved",
      align: "center",
      render: (row) => (
        <span className="documents-count is-approved">
          ● {row.summary.approved ?? "—"}
        </span>
      ),
    },
    {
      key: "pending",
      header: "Pending",
      align: "center",
      render: (row) => (
        <span className="documents-count is-pending">
          ● {row.summary.pending ?? "—"}
        </span>
      ),
    },
    {
      key: "rejected",
      header: "Rejected",
      align: "center",
      render: (row) => (
        <span className="documents-count is-rejected">
          ● {row.summary.rejected ?? "—"}
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

  if (!queue && queueLoading && !stats) return <DocumentsLoading />;

  return (
    <div className="documents-screen">
      <PageHeader
        crumbs={[{ label: "Operations" }, { label: "Documents" }]}
        title="Documents"
        description="Review job documents and follow up on missing submissions."
        actions={<FilterSelect label="All Dates" icon="calendar" />}
      />

      {notice && (
        <Banner tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.title}
        </Banner>
      )}
      {queueError && <div className="documents-error"><Banner tone="danger" title={queueError.status === 403 ? "Access denied to the document queue." : "Unable to load the document queue."} /><Button variant="outline" onClick={refetchQueue}>Retry</Button></div>}
      {statsError && <div className="documents-error"><Banner tone="warning" title="Document review stats are unavailable." /><Button variant="outline" onClick={refetchStats}>Retry stats</Button></div>}
      <div className="documents-stats-grid">
        <StatCard
          icon="file-text"
          label="Total Documents"
          value={statsLoading ? "…" : totals?.total?.toLocaleString() ?? "—"}
          tint="blue"
          caption="All job documents"
        />
        <StatCard
          icon="circle-check"
          label="Approved Documents"
          value={statsLoading ? "…" : totals?.approved?.toLocaleString() ?? "—"}
          tint="green"
          caption={stats?.approvedJobsToday == null ? "Document count unavailable" : `${stats.approvedJobsToday} jobs approved today`}
        />
        <StatCard
          icon="clock"
          label="Pending Review"
          value={statsLoading ? "…" : totals?.pending?.toLocaleString() ?? stats?.awaitingJobs?.toLocaleString() ?? "—"}
          tint="amber"
          caption={totals?.pending == null ? "Jobs awaiting approval" : "Documents awaiting review"}
        />
        <StatCard
          icon="circle-x"
          label="Rejected Documents"
          value={statsLoading ? "…" : totals?.rejected?.toLocaleString() ?? "—"}
          tint="red"
          caption={stats?.rejectedJobsToday == null ? "Document count unavailable" : `${stats.rejectedJobsToday} jobs rejected today`}
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
            count: totals?.missing ?? undefined,
          },
        ]}
      />
      <Card className="documents-table-card" pad="none">
        <TableToolbar
          style={{ padding: "var(--tk-space-4) var(--tk-card-pad-tight)" }}
          search={
            <SearchField
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
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
                    : requirementLabels[typeFilter] || typeFilter
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
                      : requirementLabels[value] || value,
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
                items={statusOptions.map(([value]) => ({
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
                items={["All companies", ...companies.filter(Boolean)].map((value) => ({
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
            searchInput ||
            typeFilter !== "All document types" ||
            statusFilter !== "All statuses" ||
            companyFilter !== "All companies"
              ? resetFilters
              : undefined
          }
        />
        {queueFetching ? (
          <div className="documents-table-loading" role="status" aria-label="Loading document queue" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => <div className="documents-loading-row" key={index}><Skeleton width="13%" height={14} /><Skeleton width="24%" height={14} /><Skeleton width="18%" height={14} /><Skeleton width="12%" height={14} /></div>)}
          </div>
        ) : queueError ? (
          <EmptyState icon="file-text" title={queueError.status === 403 ? "Access denied" : "Document queue unavailable"} description="Please try again." />
        ) : filtered.length ? (
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(row) => row.id}
            coloredHeader
            tableLayout="fixed"
            expandedRowKeys={expandedJob ? [expandedJob] : []}
            renderExpandedRow={(row) => (
              <ExpandedJob
                row={row}
                selected={selectedDocs}
                setSelected={setSelectedDocs}
                navigate={navigate}
                onAction={openAction}
              />
            )}
          />
        ) : (
          <EmptyState
            icon="file-text"
            title={tab === "missing" && grouped.length && grouped.every((row) => row.summary.missing == null) ? "Missing document data unavailable" : "No job documents found"}
            description={tab === "missing" && grouped.length && grouped.every((row) => row.summary.missing == null) ? "The queue response needs a missing document count for each job." : "Try adjusting the current filters."}
          />
        )}
        <Pagination
          page={queue?.pagination.page || page}
          pageSize={pageSize}
          total={queue?.pagination.total ?? 0}
          pageCount={Math.max(1, queue?.pagination.totalPages || 1)}
          onPage={(value) => setPage(Math.min(Math.max(1, value), Math.max(1, queue?.pagination.totalPages || 1)))}
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
          action?.kind === "approveJob"
            ? "Approve job documents"
            : action?.kind === "rejectJob"
              ? "Reject job documents"
              : action?.kind === "approve"
            ? "Approve document"
            : action?.kind === "request"
              ? "Request re-upload"
              : "Reject document"
        }
      >
        <p className="tk-muted">
          {action?.kind === "approveJob"
            ? "Validate all required documents and advance this job?"
            : action?.kind === "rejectJob"
              ? "This returns the job to draft. Add a reason for the forwarder."
              : action?.kind === "approve"
            ? `Approve ${action?.docs.length || 0} selected document(s)?`
            : "Add a clear reason for the forwarder. This is saved with the document."}
        </p>
        {action?.kind !== "approve" && action?.kind !== "approveJob" && (
          <Textarea
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain what needs to be corrected…"
          />
        )}
        <div className="documents-modal-actions">
          <Button variant="secondary" onClick={() => setAction(null)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={action?.kind === "reject" || action?.kind === "rejectJob" ? "danger" : "primary"}
            onClick={completeAction}
            disabled={submitting || (action?.kind !== "approve" && action?.kind !== "approveJob" && !reason.trim())}
          >
            {submitting ? "Saving…" : action?.kind === "approveJob"
              ? "Approve job"
              : action?.kind === "rejectJob"
                ? "Reject job"
                : action?.kind === "approve"
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
  const { currentData: detail, isLoading, isFetching, error, refetch } = useGetAdminDocReviewDetailQuery(row.id, {
    refetchOnMountOrArgChange: true,
  });
  const shownDocuments = detail?.documents || [];
  const reviewable = shownDocuments.filter(canReviewDocument);
  const summary = detail?.summary || row.summary;
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
          {(doc.fileSize || doc.version) && (
            <small>
              {[doc.fileSize, doc.version ? `v${doc.version}` : null].filter(Boolean).join(" · ")}
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
        <Badge tone="neutral">{requirementLabels[doc.requirement] || doc.name}</Badge>
      ),
    },
    {
      key: "uploadedBy",
      header: "Uploaded by",
      width: 160,
      render: (doc) => (
        <div>
          {doc.uploadedBy || "—"}
          {doc.uploadedByRole && <small>{doc.uploadedByRole}</small>}
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
            disabled={!doc.url}
            onClick={() => navigate(`/documents/detail?jobId=${encodeURIComponent(doc.jobId)}&documentId=${encodeURIComponent(doc.id || doc.rowKey)}`)}
          >
            View
          </Button>
          {canReviewDocument(doc) && (
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
          <h2>Documents for {row.displayId}</h2>
          <p>
            {row.job.route || "Route unavailable"} · {row.company || "—"}
          </p>
        </div>
        <div className="documents-summary">
          <span>{summary.total ?? "—"} Total</span>
          <span className="is-approved">● {summary.approved ?? "—"} Approved</span>
          <span className="is-pending">● {summary.pending ?? "—"} Pending</span>
          <span className="is-rejected">● {summary.rejected ?? "—"} Rejected</span>
        </div>
        {detail && !isFetching && row.job.statusCode?.toLowerCase() === "awaiting" && row.jobType !== "Export" && <>
          <Button size="sm" onClick={() => onAction("approveJob", { jobId: row.id })}>Approve job documents</Button>
          <Button size="sm" variant="danger" onClick={() => onAction("rejectJob", { jobId: row.id })}>Reject job documents</Button>
        </>}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(`/jobs/detail?id=${encodeURIComponent(row.id)}`)}
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
      {(isLoading || isFetching) && <div className="documents-expanded-loading" role="status" aria-label="Loading job documents"><Skeleton height={210} /></div>}
      {error && <div className="documents-error"><Banner tone="danger" title={error.status === 403 ? "Access denied to these job documents." : "Unable to load job documents."} /><Button variant="outline" onClick={refetch}>Retry</Button></div>}
      {!error && !isLoading && !isFetching && shownDocuments.length === 0 && <EmptyState icon="file-text" title="No documents available" description="This job has no documents in the review response." />}
      {!error && !isLoading && !isFetching && shownDocuments.length > 0 && <DataTable
        columns={documentColumns}
        rows={shownDocuments}
        rowKey={(doc) => doc.rowKey}
        selectable={reviewable.length > 0}
        selected={selected.map((doc) => doc.rowKey)}
        onSelect={(ids) => setSelected(shownDocuments.filter((doc) => ids.includes(doc.rowKey) && canReviewDocument(doc)))}
        tableLayout="fixed"
        coloredHeader
      />}
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
