"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "../router.js";
import { usePageSearchState } from "../components/PageSearch.jsx";
import { DocumentProgress } from "../components/DocumentProgress.jsx";
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
  Icon,
  PageHeader,
  Pagination,
  SearchField,
  Skeleton,
  StatCard,
  StatsPanel,
  TableToolbar,
  Tabs,
  RouteStack,
} from "../ds.js";
import { JOB_REVIEW_STATUS, REVIEW_STATUS_META, unitNoun } from "../domain/containerReview.js";
import { useGetContainerReviewJobsQuery } from "../store/features/documents/containerReviewApi.js";
import { formatTdoDate, formatWhen } from "./DocumentReview.jsx";
import "./Documents.css";

const TABS = [
  { value: JOB_REVIEW_STATUS.NEEDS_REVIEW, label: "Needs review" },
  { value: JOB_REVIEW_STATUS.AWAITING_FORWARDER, label: "Waiting on forwarder" },
  { value: JOB_REVIEW_STATUS.VALIDATED, label: "Validated" },
  { value: "ALL", label: "All jobs" },
];

const EMPTY = {
  [JOB_REVIEW_STATUS.NEEDS_REVIEW]: { title: "You’re all caught up", description: "No job has documents waiting for review." },
  [JOB_REVIEW_STATUS.AWAITING_FORWARDER]: { title: "Nothing waiting on forwarders", description: "No job has rejected documents waiting to be replaced." },
  [JOB_REVIEW_STATUS.VALIDATED]: { title: "No validated jobs yet", description: "Jobs show here once every document is approved." },
  ALL: { title: "No jobs found", description: "Try a different search or filter." },
};

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
  const { currentData: jobs, isLoading, error, refetch } = useGetContainerReviewJobsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [tab, setTab] = useState(JOB_REVIEW_STATUS.NEEDS_REVIEW);
  const [search, setSearch] = usePageSearchState("", () => setPage(1));
  const [forwarder, setForwarder] = useState(null);
  const [forwarderOpen, setForwarderOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const all = useMemo(() => jobs || [], [jobs]);
  const forwarders = useMemo(() => [...new Set(all.map((job) => job.forwarder))].sort(), [all]);
  const byStatus = (status) => all.filter((job) => job.reviewStatus === status);
  const tabCounts = {
    [JOB_REVIEW_STATUS.NEEDS_REVIEW]: byStatus(JOB_REVIEW_STATUS.NEEDS_REVIEW).length,
    [JOB_REVIEW_STATUS.AWAITING_FORWARDER]: byStatus(JOB_REVIEW_STATUS.AWAITING_FORWARDER).length,
    [JOB_REVIEW_STATUS.VALIDATED]: byStatus(JOB_REVIEW_STATUS.VALIDATED).length,
    ALL: all.length,
  };
  const docsToReview = all.reduce((sum, job) => sum + job.counts.pending, 0);
  const resubmitted = all.reduce((sum, job) => sum + job.counts.resubmitted, 0);

  const query = search.trim().toLowerCase();
  const rows = all
    .filter((job) => tab === "ALL" || job.reviewStatus === tab)
    .filter((job) => !forwarder || job.forwarder === forwarder)
    .filter((job) => !query || [job.jobNumber, job.forwarder, job.route?.pickup, job.route?.delivery].some((value) => String(value || "").toLowerCase().includes(query)))
    .sort((a, b) => tab === JOB_REVIEW_STATUS.NEEDS_REVIEW
      ? String(a.oldestPendingAt).localeCompare(String(b.oldestPendingAt))
      : String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);

  const open = (job) => navigate(`/documents/review?jobId=${encodeURIComponent(job.id)}`);

  const columns = [
    {
      key: "job",
      header: "Job",
      width: "14%",
      render: (job) => (
        <span className="tk-cell-id">
          <strong>{job.jobNumber}</strong>
          <small>Submitted {formatWhen(job.submittedAt)}</small>
        </span>
      ),
    },
    {
      key: "forwarder",
      header: "Forwarder",
      width: "18%",
      render: (job) => (
        <span className="tk-cell-person">
          <Avatar name={job.forwarder} size={30} />
          <span><strong title={job.forwarder}>{job.forwarder}</strong></span>
        </span>
      ),
    },
    {
      key: "route",
      header: "Route",
      width: "20%",
      render: (job) => <RouteStack from={job.route?.pickup} to={job.route?.delivery} />,
    },
    {
      key: "units",
      header: "Load",
      width: "11%",
      render: (job) => (
        <span className="documents-units">
          <Icon name={job.unitKind === "rack" ? "layers" : "container"} size={16} />
          <span><strong>{job.unitCount} {unitNoun(job.unitKind, job.unitCount)}</strong><small>TDO {formatTdoDate(job.tdoDate).replace(/^\w+, /, "")}</small></span>
        </span>
      ),
    },
    {
      key: "progress",
      header: "Approval",
      width: "17%",
      render: (job) => <DocumentProgress counts={job.counts} />,
    },
    {
      key: "todo",
      header: "To review",
      width: "11%",
      render: (job) => job.counts.pending ? (
        <span className="documents-todo">
          <strong>{job.counts.pending}</strong>
          {job.counts.resubmitted > 0 && <span className="documents-pill">{job.counts.resubmitted} resubmitted</span>}
        </span>
      ) : <span className="documents-todo is-none">—</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "13%",
      render: (job) => {
        const meta = REVIEW_STATUS_META[job.reviewStatus];
        return (
          <span className="documents-status">
            <Badge tone={meta.tone} dot>{meta.label}</Badge>
            {job.reviewStatus === JOB_REVIEW_STATUS.AWAITING_FORWARDER && <small>{job.counts.rejected} rejected</small>}
            {job.reviewStatus === JOB_REVIEW_STATUS.VALIDATED && <small><Icon name="lock" size={11} /> Locked · open to bids</small>}
          </span>
        );
      },
    },
  ];

  if (isLoading && !jobs) return <DocumentsLoading />;

  return (
    <div className="documents-screen">
      <PageHeader
        crumbs={[{ label: "Operations" }, { label: "Documents" }]}
        title="Documents"
        description="Review each container’s TDO, Gate Pass and Exit Note before a job opens to bids."
      />

      {error && <Banner tone="danger" title="Unable to load the document queue." action={<Button variant="outline" size="sm" onClick={refetch}>Retry</Button>} />}

      <StatsPanel fixedLabel="Current" fixedHint="Live counts across all jobs in document review.">
        <StatCard icon="clock" label="Jobs to review" value={tabCounts[JOB_REVIEW_STATUS.NEEDS_REVIEW].toLocaleString()} tint="amber" caption="At least one document pending" />
        <StatCard icon="file-search" label="Documents to review" value={docsToReview.toLocaleString()} tint="blue" caption={resubmitted ? `${resubmitted} resubmitted after rejection` : "Across all containers"} />
        <StatCard icon="hourglass" label="Waiting on forwarder" value={tabCounts[JOB_REVIEW_STATUS.AWAITING_FORWARDER].toLocaleString()} tint="red" caption="Rejected files to be replaced" />
        <StatCard icon="shield-check" label="Validated" value={tabCounts[JOB_REVIEW_STATUS.VALIDATED].toLocaleString()} tint="green" caption="Locked and open to bids" />
      </StatsPanel>

      <Card className="documents-table-card" pad="none">
        <div className="documents-tabs">
          <Tabs
            value={tab}
            onChange={(value) => { setTab(value); setPage(1); }}
            items={TABS.map((item) => ({ value: item.value, label: item.label, count: tabCounts[item.value] }))}
          />
        </div>
        <TableToolbar
          style={{ padding: "var(--tk-space-4) var(--tk-card-pad-tight)" }}
          search={<SearchField value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by job ID, forwarder or route…" />}
          filters={
            <span className="documents-filter-menu">
              <FilterSelect prefix="Forwarder" label={forwarder || "All"} active={Boolean(forwarder)} onClick={() => setForwarderOpen((value) => !value)} onClear={() => { setForwarder(null); setPage(1); }} />
              {forwarderOpen && (
                <span className="documents-filter-dropdown">
                  <DropdownMenu width={240} items={[null, ...forwarders].map((name) => ({ label: name || "All forwarders", icon: name === forwarder ? "check" : undefined, onClick: () => { setForwarder(name); setForwarderOpen(false); setPage(1); } }))} />
                </span>
              )}
            </span>
          }
          onClear={search || forwarder ? () => { setSearch(""); setForwarder(null); setPage(1); } : undefined}
        />
        {shown.length ? (
          <DataTable columns={columns} rows={shown} rowKey={(job) => job.id} onRowClick={open} tableLayout="fixed" />
        ) : (
          <EmptyState icon={tab === JOB_REVIEW_STATUS.NEEDS_REVIEW && !query && !forwarder ? "check-check" : "file-text"} {...(query || forwarder ? EMPTY.ALL : EMPTY[tab])} />
        )}
        <Pagination
          page={page}
          pageSize={pageSize}
          total={rows.length}
          pageCount={pageCount}
          onPage={(value) => setPage(Math.min(Math.max(1, value), pageCount))}
          onPageSize={(value) => { setPageSize(value); setPage(1); }}
        />
      </Card>
    </div>
  );
}

export default Documents;
