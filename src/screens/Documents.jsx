"use client";

import { usePageSearchState } from '../components/PageSearch.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';
import { DateRangeFilter, EMPTY_RANGE, isRangeSet, rangeParams } from '../components/DateRangeFilter.jsx';


import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
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
  ViewToggle,
  Textarea,
  StatsPanel,
  DocumentPreview,
  NotAvailable,
  RouteStack,
} from "../ds.js";
import {
  useApproveAdminDocumentMutation,
  useApproveAdminJobDocumentsMutation,
  useGetAdminDocReviewQueueQuery,
  useGetAdminDocReviewStatsQuery,
  useGetAdminDocReviewDetailQuery,
  useGetAdminDocReviewFilterOptionsQuery,
  documentTime,
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
  ["Needs attention", "all"],
  ["Missing Documents", "all"],
  ["Awaiting approval", "awaiting"],
  ["Approved", "approved"],
  ["Rejected", "rejected"],
];

function formatTime(value) {
  return documentTime(value);
}

function canReviewDocument(document) {
  return Boolean(document?.id) && document.canReview === true && canAdminReview(document);
}

function requestError(error) {
  return getApiErrorMessage(error, error?.status === 403 ? "Your account cannot review these documents." : "The request could not be completed.");
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
  const owner = useSelector((state) => state.auth.admin?.id);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const [searchInput, setSearchInput] = usePageSearchState("", () => setPage(1));
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All document types");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [companyFilter, setCompanyFilter] = useState("All companies");
  const [updated, setUpdated] = useState(EMPTY_RANGE);
  const [openFilter, setOpenFilter] = useState(null);
  const [openJob, setOpenJob] = useState(null);
  const [tableView, setTableView] = useState("list");
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
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
  const { currentData: options, error: optionsError } = useGetAdminDocReviewFilterOptionsQuery(owner, { skip: !authenticated });
  const {
    currentData: queue,
    isLoading: queueLoading,
    isFetching: queueFetching,
    error: queueError,
    refetch: refetchQueue,
  } = useGetAdminDocReviewQueueQuery({ owner, status: queueStatus, search, page, limit: pageSize,
    documentType: typeFilter === "All document types" ? undefined : typeFilter,
    companyId: companyFilter === "All companies" ? undefined : companyFilter,
    missing: statusFilter === "Missing Documents" ? true : undefined,
    attentionOnly: statusFilter === "Needs attention",
    ...rangeParams(updated),
  }, {
    skip: !authenticated || search !== searchInput.trim(),
    refetchOnMountOrArgChange: true,
  });
  const { currentData: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } =
    useGetAdminDocReviewStatsQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const [approveJob] = useApproveAdminJobDocumentsMutation();
  const [rejectJob] = useRejectAdminJobDocumentsMutation();
  const [approveDocument] = useApproveAdminDocumentMutation();
  const [rejectDocument] = useRejectAdminDocumentMutation();

  const grouped = authenticated && !queueError ? queue?.rows || [] : [];
  const companies = authenticated && !optionsError ? options?.companies || [] : [];
  const allTypes = authenticated && !optionsError ? options?.types || [] : [];
  const totals = authenticated && !statsError ? stats?.documentCounts : null;
  const filtered = grouped;
  const loadingQueue = queueFetching || authenticated && search !== searchInput.trim();
  useEffect(() => { setSelectedDocs([]); setAction(null); }, [searchInput, typeFilter, statusFilter, companyFilter, page, pageSize, owner]);

  const reviewableSelected = selectedDocs.filter(canReviewDocument);

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setTypeFilter("All document types");
    setStatusFilter("All statuses");
    setCompanyFilter("All companies");
    setUpdated(EMPTY_RANGE);
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
      key: "id",
      header: "Job",
      width: "16%",
      render: (row) => (
        <span className="tk-cell-id">
          <strong>{row.displayId}</strong>
          <small>{row.updatedAt ? "Updated " + formatTime(row.updatedAt) : "No updates yet"}</small>
        </span>
      ),
    },
    {
      key: "route",
      header: "Route",
      width: "28%",
      render: (row) => {
        const [from, to] = (row.job.route || "").split(/\s*(?:→|->)\s*/);
        return row.job.route ? <RouteStack from={from || row.job.origin} to={to} /> : <NotAvailable />;
      },
    },
    {
      key: "company",
      header: "Forwarder",
      width: "20%",
      render: (row) => (
        <span className="tk-cell-person">
          <Avatar name={row.company || "?"} size={30} />
          <span><strong title={row.company}>{row.company || "Unknown"}</strong></span>
        </span>
      ),
    },
    {
      key: "jobType",
      header: "Job type",
      width: "12%",
      render: (row) => (row.jobType ? <Badge tone={row.jobKind === "Import" ? "info" : "neutral"}>{row.jobType}</Badge> : <NotAvailable />),
    },
    {
      key: "approval",
      header: "Document approval",
      width: "18%",
      render: (row) => {
        const approval = approvalStatus(row);
        return <Badge tone={approval.tone} dot>{approval.label}</Badge>;
      },
    },
  ];

  if (!queue && queueLoading && !stats) return <DocumentsLoading />;

  return (
    <div className="documents-screen">
      <PageHeader
        crumbs={[{ label: "Operations" }, { label: "Documents" }]}
        title="Documents"
        description="Review job documents and follow up on missing submissions."
      />

      {notice && (
        <Banner tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.title}
        </Banner>
      )}
      {queueError && <div className="documents-error"><Banner tone="danger" title={queueError.status === 403 ? "Access denied to the document queue." : "Unable to load the document queue."} /><Button variant="outline" onClick={refetchQueue}>Retry</Button></div>}
      {statsError && <div className="documents-error"><Banner tone="warning" title="Document review stats are unavailable." /><Button variant="outline" onClick={refetchStats}>Retry stats</Button></div>}
      <StatsPanel fixedLabel="Current" fixedHint="Live counts of documents by review status.">

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
          caption={stats?.approvedJobsToday == null ? "—" : `${stats.approvedJobsToday} jobs approved today`}
        />
        <StatCard
          icon="clock"
          label="Pending Review"
          value={statsLoading ? "…" : totals?.pending?.toLocaleString() ?? "—"}
          tint="amber"
          caption={totals?.pending == null ? "Jobs awaiting approval" : "Documents awaiting review"}
        />
        <StatCard
          icon="circle-x"
          label="Rejected Documents"
          value={statsLoading ? "…" : totals?.rejected?.toLocaleString() ?? "—"}
          tint="red"
          caption={stats?.rejectedJobsToday == null ? "—" : `${stats.rejectedJobsToday} jobs rejected today`}
        />
      </StatsPanel>


      <Card className="documents-table-card" pad="none">
        <TableToolbar
          style={{ padding: "var(--tk-space-4) var(--tk-card-pad-tight)" }}
          viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
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
                label={companyFilter === "All companies" ? companyFilter : companies.find((company) => company.id === companyFilter)?.name || "—"}
                active={companyFilter !== "All companies"}
                open={openFilter === "company"}
                align="right"
                onToggle={() =>
                  setOpenFilter(openFilter === "company" ? null : "company")
                }
                items={[{ id: "All companies", name: "All companies" }, ...companies].map((company) => ({
                  label: company.name,
                  icon: company.id === companyFilter ? "check" : undefined,
                  onClick: () => selectFilter(setCompanyFilter, company.id),
                }))}
              />
              <DateRangeFilter name="Updated" value={updated} onChange={(next) => selectFilter(setUpdated, next)} />
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
            companyFilter !== "All companies" ||
            isRangeSet(updated)
              ? resetFilters
              : undefined
          }
        />
        {loadingQueue ? (
          <div className="documents-table-loading" role="status" aria-label="Loading document queue" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => <div className="documents-loading-row" key={index}><Skeleton width="13%" height={14} /><Skeleton width="24%" height={14} /><Skeleton width="18%" height={14} /><Skeleton width="12%" height={14} /></div>)}
          </div>
        ) : queueError ? (
          <EmptyState icon="file-text" title={queueError.status === 403 ? "Access denied" : "Document queue unavailable"} description="Please try again." />
        ) : filtered.length || tableView === "board" ? (
          <DataTable
            view={tableView}
            boardConfig={BOARD_LAYOUTS.documents}
            boardHideEmpty={hideEmptyColumns}
            boardGroupBy={(row) => approvalStatus(row).label}
            columns={columns}
            rows={filtered}
            rowKey={(row) => row.id}
            onRowClick={(row) => { setOpenJob(row); setSelectedDocs([]); }}
            emptyAs={<NotAvailable />}
          />
        ) : (
          <EmptyState
            icon="file-text"
            title={statusFilter === "Missing Documents" && grouped.length && grouped.every((row) => row.summary.missing == null) ? "Missing document data unavailable" : "No job documents found"}
            description={statusFilter === "Missing Documents" && grouped.length && grouped.every((row) => row.summary.missing == null) ? "Missing document counts are not available." : "Try adjusting the current filters."}
          />
        )}
        <Pagination
          page={queue?.pagination.page || page}
          pageSize={pageSize}
          total={authenticated && !queueError && !loadingQueue ? queue?.pagination.total : null}
          pageCount={authenticated && !queueError && !loadingQueue ? queue?.pagination.totalPages : null}
          onPage={(value) => setPage(Math.min(Math.max(1, value), Math.max(1, queue?.pagination.totalPages || 1)))}
          onPageSize={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      </Card>

      {openJob && <JobDocumentsDrawer row={openJob} onClose={() => setOpenJob(null)} navigate={navigate} onAction={openAction} busy={submitting} />}

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
          {(doc.fileSize != null || doc.version != null) && (
            <small>
              {[doc.fileSize, doc.version != null ? `v${doc.version}` : null].filter((value) => value != null).join(" · ")}
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
        {detail?.canReviewJob && !error && !isFetching && <>
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
      {row.jobKind === "Export" && shownDocuments.some((document) => ['indemnity_letter', 'confirmation_letter'].includes(document.requirement)) && (
        <Banner tone="info">
          Export documents are reviewed by the trucking company. Admins can view
          their status but cannot approve or reject them.
        </Banner>
      )}
      {(isLoading || isFetching) && <div className="documents-expanded-loading" role="status" aria-label="Loading job documents"><Skeleton height={210} /></div>}
      {error && <div className="documents-error"><Banner tone="danger" title={error.status === 403 ? "Access denied to these job documents." : "Unable to load job documents."} /><Button variant="outline" onClick={refetch}>Retry</Button></div>}
      {!error && !isLoading && !isFetching && shownDocuments.length === 0 && <EmptyState icon="file-text" title="No documents available" description="No documents are available for this job." />}
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

/** One overall approval status for a job's documents, instead of separate counts. */
function approvalStatus(row) {
  const summary = row.summary || {};
  if (row.job.statusCode === "rejected" || summary.rejected > 0) return { label: "Changes requested", tone: "danger" };
  if (summary.missing > 0) return { label: "Missing documents", tone: "warning" };
  if (summary.pending > 0 || row.job.statusCode === "pending" || row.job.statusCode === "awaiting") return { label: "Pending review", tone: "warning" };
  if (row.job.statusCode === "approved" || (summary.approved > 0 && !summary.pending && !summary.rejected)) return { label: "Approved", tone: "success" };
  return { label: row.job.status || "Not available", tone: "neutral" };
}

/** Preview-style drawer for one job's documents: thumbnails on the side, the selected file large. */
function JobDocumentsDrawer({ row, onClose, navigate, onAction, busy }) {
  const { currentData: detail, isFetching, error } = useGetAdminDocReviewDetailQuery(row.id, { refetchOnMountOrArgChange: true });
  const documents = (detail?.documents || []).map((doc) => ({
    ...doc,
    id: doc.rowKey,
    name: doc.name,
    type: requirementLabels[doc.requirement] || doc.name,
    submittedBy: doc.uploadedBy,
    date: doc.uploadedAt ? formatTime(doc.uploadedAt) : null,
    scope: "Whole job",
  }));
  const [selectedId, setSelectedId] = useState(null);
  const selected = documents.find((doc) => doc.id === selectedId) || documents[0] || null;
  return (
    <DocumentPreview
      open
      variant="drawer"
      onClose={onClose}
      title={`${row.displayId} documents`}
      subtitle={[row.company, row.job.route].filter(Boolean).join(" · ")}
      documents={documents}
      selectedId={selected?.id}
      onSelect={setSelectedId}
      loading={isFetching && !detail}
      preview={{ url: selected?.url || null, error: Boolean(error) }}
      canReview={(doc) => canReviewDocument(doc)}
      busy={busy}
      onApprove={(doc) => onAction("approve", [doc])}
      onRequestReupload={(doc) => onAction("request", [doc])}
      titleActions={<Button size="sm" variant="outline" iconRight="arrow-up-right" onClick={() => navigate(`/jobs/detail?id=${encodeURIComponent(row.id)}`)}>Open job</Button>}
    />
  );
}
