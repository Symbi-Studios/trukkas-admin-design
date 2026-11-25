"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  EmptyState,
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
import { JOB_REVIEW_STATUS, REVIEW_STATUS_META, unitNoun } from "@/domain/containerReview";
import type { QueueTab, ReviewJobSummary, ReviewQueue, ReviewStats } from "@/types/docReview";
import { formatWhen } from "./DocumentReview";
import "./Documents.css";

// The backend's own tabs. The URL holds the tab, the search, the page and the page size,
// and the Next.js server asks the backend for exactly that page (app/documents/page.jsx).
const TABS: { value: QueueTab; label: string; count?: (stats: ReviewStats | null) => number | undefined }[] = [
  { value: "awaiting", label: "Needs review", count: (stats) => stats?.jobs.awaiting },
  { value: "rejected", label: "Rejected", count: (stats) => stats?.jobs.rejected },
  { value: "missing", label: "Not uploaded", count: (stats) => stats?.jobs.withMissingDocuments },
  { value: "approved", label: "Approved", count: (stats) => stats?.jobs.approved },
  { value: "all", label: "All jobs" },
];

const EMPTY: Record<QueueTab, { title: string; description: string }> = {
  awaiting: { title: "You’re all caught up", description: "No job has documents waiting for review." },
  rejected: { title: "No rejected documents", description: "No job has rejected documents waiting to be replaced." },
  missing: { title: "Nothing missing", description: "Every job in review has its required documents uploaded." },
  approved: { title: "No approved jobs yet", description: "Jobs show here once every document is approved." },
  all: { title: "No jobs found", description: "Try a different search." },
};

export function DocumentsLoading() {
  return (
    <div className="documents-screen" aria-busy="true" role="status" aria-label="Loading documents">
      <Card><Skeleton width={180} height={26} /></Card>
      <div className="documents-stats-grid">{Array.from({ length: 4 }, (_, index) => <Card key={index}><Skeleton width="55%" height={14} /><div style={{ marginTop: 16 }}><Skeleton width={70} height={28} /></div></Card>)}</div>
      <Card><Skeleton height={320} /></Card>
    </div>
  );
}

interface DocumentsQuery {
  tab: QueueTab;
  search: string;
  page: number;
  limit: number;
}

interface DocumentsProps {
  query: DocumentsQuery;
  queue: ReviewQueue | null;
  stats: ReviewStats | null;
  error: string | null;
}

// "2 racks", "3 containers", or the container number on older jobs
function loadNote(job: ReviewJobSummary): string {
  if (job.unitCount) return `${job.unitCount} ${unitNoun(job.unitKind ?? "container", job.unitCount)}`;
  return job.containerNumber || "—";
}

export function Documents({ query, queue, stats, error }: DocumentsProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = usePageSearchState(query.search, () => {}) as [string, (next: string) => void];
  const jobs = queue?.jobs ?? [];
  const pagination = queue?.pagination;

  // Change the URL, and the server loads the new page.
  const go = (patch: Partial<DocumentsQuery>) => {
    const next = { ...query, ...patch };
    const params = new URLSearchParams();
    if (next.tab !== "awaiting") params.set("status", next.tab);
    if (next.search) params.set("search", next.search);
    if (next.page > 1) params.set("page", String(next.page));
    if (next.limit !== 10) params.set("limit", String(next.limit));
    const text = params.toString();
    startTransition(() => router.push(text ? `/documents?${text}` : "/documents"));
  };

  // Search while typing, after a short pause, so each key does not call the backend.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const value = search.trim();
    if (value === query.search) return undefined;
    const timer = setTimeout(() => goRef.current({ search: value, page: 1 }), 400);
    return () => clearTimeout(timer);
  }, [search, query.search]);

  const open = (job: ReviewJobSummary) => navigate(`/documents/review?jobId=${encodeURIComponent(job.id)}`);

  const columns = [
    {
      key: "job",
      header: "Job",
      width: "15%",
      render: (job: ReviewJobSummary) => (
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
      render: (job: ReviewJobSummary) => (
        <span className="tk-cell-person">
          <Avatar name={job.forwarder} size={30} />
          <span><strong title={job.forwarder}>{job.forwarder}</strong></span>
        </span>
      ),
    },
    {
      key: "route",
      header: "Route",
      width: "21%",
      render: (job: ReviewJobSummary) => <RouteStack from={job.route?.pickup} to={job.route?.delivery} />,
    },
    {
      key: "load",
      header: "Job type",
      width: "13%",
      render: (job: ReviewJobSummary) => (
        <span className="documents-units">
          <Icon name="container" size={16} />
          <span><strong>{job.movement || "—"}</strong><small>{loadNote(job)}</small></span>
        </span>
      ),
    },
    {
      key: "progress",
      header: "Approval",
      width: "15%",
      render: (job: ReviewJobSummary) => <DocumentProgress counts={{ ...job.counts, resubmitted: 0 }} />,
    },
    {
      key: "todo",
      header: "To review",
      width: "8%",
      render: (job: ReviewJobSummary) => job.counts.pending ? (
        <span className="documents-todo"><strong>{job.counts.pending}</strong></span>
      ) : <span className="documents-todo is-none">—</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      render: (job: ReviewJobSummary) => {
        const meta = REVIEW_STATUS_META[job.reviewStatus];
        return (
          <span className="documents-status">
            <Badge tone={meta.tone} dot>{meta.label}</Badge>
            {job.reviewStatus === JOB_REVIEW_STATUS.AWAITING_FORWARDER && (job.counts.rejected > 0 || job.counts.missing > 0) && (
              <small>{[job.counts.rejected && `${job.counts.rejected} rejected`, job.counts.missing && `${job.counts.missing} not uploaded`].filter(Boolean).join(" · ")}</small>
            )}
            {job.reviewStatus === JOB_REVIEW_STATUS.VALIDATED && <small><Icon name="lock" size={11} /> Locked · open to bids</small>}
          </span>
        );
      },
    },
  ];

  const emptyKey: QueueTab = query.search ? "all" : query.tab;

  return (
    <div className="documents-screen" style={{ opacity: pending ? 0.7 : 1, transition: "opacity 120ms" }}>
      <PageHeader
        crumbs={[{ label: "Operations" }, { label: "Documents" }]}
        title="Documents"
        description="Review each container’s TDO, Gate Pass and Exit Note before a job opens to bids."
      />

      {error && <Banner tone="danger" title={error} action={<Button variant="outline" size="sm" onClick={() => router.refresh()}>Retry</Button>} />}

      {stats && (
        <StatsPanel fixedLabel="Current" fixedHint="Live counts across all jobs in document review.">
          <StatCard icon="clock" label="Jobs to review" value={stats.jobs.awaiting.toLocaleString()} tint="amber" caption="At least one document pending" />
          <StatCard icon="file-search" label="Documents to review" value={stats.documents.pending.toLocaleString()} tint="blue" caption="Across all containers" />
          <StatCard icon="hourglass" label="Waiting on forwarders" value={(stats.documents.rejected + stats.documents.missing).toLocaleString()} tint="red" caption={`${stats.documents.rejected} rejected · ${stats.documents.missing} not uploaded`} />
          <StatCard icon="shield-check" label="Approved today" value={stats.documents.approvedToday.toLocaleString()} tint="green" caption={`${stats.jobs.approvedToday} jobs validated today`} />
        </StatsPanel>
      )}

      <Card className="documents-table-card" pad="none">
        <div className="documents-tabs">
          <Tabs
            value={query.tab}
            onChange={(value: string) => go({ tab: value as QueueTab, page: 1 })}
            items={TABS.map((item) => {
              const count = item.count?.(stats);
              return count === undefined ? { value: item.value, label: item.label } : { value: item.value, label: item.label, count };
            })}
          />
        </div>
        <TableToolbar
          style={{ padding: "var(--tk-space-4) var(--tk-card-pad-tight)" }}
          search={<SearchField value={search} onChange={(event: { target: { value: string } }) => setSearch(event.target.value)} placeholder="Search documents…" title="Search by job number, route, company or file name" />}
          onClear={search ? () => { setSearch(""); go({ search: "", page: 1 }); } : undefined}
        />
        {jobs.length ? (
          <DataTable columns={columns} rows={jobs} rowKey={(job: ReviewJobSummary) => job.id} onRowClick={open} tableLayout="fixed" />
        ) : (
          <EmptyState icon={query.tab === "awaiting" && !query.search ? "check-check" : "file-text"} {...EMPTY[emptyKey]} />
        )}
        <Pagination
          page={pagination?.page ?? query.page}
          pageSize={query.limit}
          total={pagination?.total ?? 0}
          pageCount={Math.max(1, pagination?.totalPages ?? 1)}
          onPage={(value: number) => go({ page: Math.min(Math.max(1, value), Math.max(1, pagination?.totalPages ?? 1)) })}
          onPageSize={(value: number) => go({ limit: value, page: 1 })}
        />
      </Card>
    </div>
  );
}

export default Documents;