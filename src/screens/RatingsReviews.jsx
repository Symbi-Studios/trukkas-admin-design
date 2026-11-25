"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  Button,
  DataTable,
  DrawerFacts,
  DrawerSection,
  DropdownMenu,
  Icon,
  IconButton,
  Modal,
  PageHeader,
  Pagination,
  SearchField,
  SectionCard,
  SideDrawer,
  Skeleton,
  StatCard,
  StatsPanel,
  TableToolbar,
  Tabs,
} from "../ds.js";
import { CustomSelect } from "../ds/components/forms/Select.jsx";
import { usePageSearchState } from "../components/PageSearch.jsx";
import { showToast } from "../components/ActionToast.jsx";
import { DriverLoadingNotice, DriverTableLoading } from "./DriversLoading.jsx";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import {
  REVIEWS_PAGE_SIZE,
  useDeleteAdminReviewMutation,
  useGetAdminReviewSummaryQuery,
  useGetAdminReviewsQuery,
  useToggleAdminReviewArchiveMutation,
} from "../store/features/reviews/reviewsApi.js";
import styles from "./RatingsReviews.module.css";

const numberFormat = new Intl.NumberFormat("en-NG");
const isNum = (value) => typeof value === "number" && Number.isFinite(value);
const fmt = (value) => (isNum(value) ? numberFormat.format(value) : "—");
const ROLE_TONE = { Forwarder: "purple", Trucker: "teal", Driver: "info" };
const SCORE_WORD = { 5: "Excellent", 4: "Good", 3: "Average", 2: "Poor", 1: "Very poor" };
const SCORE_TONE = { 5: "success", 4: "success", 3: "warning", 2: "danger", 1: "danger" };
const STAR_FILTERS = [["All", "All ratings"], ["5", "5 stars"], ["4", "4 stars"], ["3", "3 stars"], ["2", "2 stars"], ["1", "1 star"]];
const RATER_FILTERS = [["All", "All reviewers"], ["FORWARDER", "By forwarders"], ["TRUCKER", "By truckers"]];
const RATEE_FILTERS = [["All", "About anyone"], ["DRIVER", "About drivers"], ["TRUCKER", "About truckers"], ["FORWARDER", "About forwarders"]];
const EMPTY_FILTERS = { star: "All", userType: "All", rateeRole: "All", ratee: null };
// Forwarders and company drivers have their own profile pages; a trucker can be a company or an
// individual driver and the review doesn't say which, so it gets no profile link.
const PROFILE_ROUTE = {
  FORWARDER: (id) => `/forwarders/detail?id=${encodeURIComponent(id)}`,
  DRIVER: (id) => `/drivers/detail?id=${encodeURIComponent(id)}`,
};

export function Stars({ value, size = 14 }) {
  const filled = isNum(value) ? Math.round(value) : 0;
  return (
    <span className={styles.stars} style={{ fontSize: size }} role="img" aria-label={isNum(value) ? `${value} out of 5 stars` : "No rating"}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= filled ? styles.starOn : styles.starOff} aria-hidden="true">★</span>)}
    </span>
  );
}

function Person({ person, sub, avatar = true }) {
  return (
    <span className={styles.person}>
      {avatar && <Avatar name={person.name === "—" ? "?" : person.name} size={28} />}
      <span className={styles.personText}>
        <strong>{person.name}</strong>
        <small>{sub ?? (person.role ? <Badge tone={ROLE_TONE[person.role] || "neutral"}>{person.role}</Badge> : "—")}</small>
      </span>
    </span>
  );
}

export function RatingsReviews() {
  const navigate = useNavigate();
  const authenticated = useSelector((state) => Boolean(state.auth.signedIn));
  const isSuperAdmin = useSelector((state) => state.auth.admin?.role) === "SUPER_ADMIN";

  const [tab, setTab] = useState("feedback");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [q, setQ] = usePageSearchState("", () => setPage(1));
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    if (!menuId) return undefined;
    const close = () => setMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuId]);

  const { ratee, ...listFilters } = filters;
  const listQuery = useGetAdminReviewsQuery(
    { tab, page, search, ...listFilters, rateeId: ratee?.id },
    { skip: !authenticated || search !== q.trim(), refetchOnMountOrArgChange: true },
  );
  const summaryQuery = useGetAdminReviewSummaryQuery(undefined, { skip: !authenticated });
  const [toggleArchive, archiveState] = useToggleAdminReviewArchiveMutation();
  const [deleteReview, deleteState] = useDeleteAdminReviewMutation();

  const data = authenticated && !listQuery.error ? listQuery.currentData : null;
  const rows = data?.rows || [];
  const loading = authenticated && (listQuery.isFetching || search !== q.trim());
  const pages = data?.pages ?? null;
  useEffect(() => { if (pages != null && pages > 0 && page > pages) setPage(pages); }, [page, pages]);

  const summary = summaryQuery.currentData;
  const summaryLoading = authenticated && !summary && !summaryQuery.isError;
  const metric = (value) => (summaryLoading ? <Skeleton as="span" width={54} height={23} /> : value);
  const distribution = summary?.distribution;
  const distributionTotal = distribution?.reduce((total, row) => total + row.count, 0) ?? null;
  const lowCount = distribution ? distribution.filter((row) => row.star <= 2).reduce((total, row) => total + row.count, 0) : null;
  const positiveShare = distribution && distributionTotal ? (distribution.filter((row) => row.star >= 4).reduce((total, row) => total + row.count, 0) / distributionTotal) * 100 : null;

  const filtered = q.trim() || Object.keys(EMPTY_FILTERS).some((key) => filters[key] !== EMPTY_FILTERS[key]);
  const setFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const reset = () => { setQ(""); setFilters(EMPTY_FILTERS); setPage(1); };
  const openReview = rows.find((row) => row.id === openId) || null;
  const showAbout = (person) => { setTab("feedback"); setQ(""); setFilters({ ...EMPTY_FILTERS, ratee: { id: person.id, name: person.name } }); setPage(1); setOpenId(null); };

  async function archive(review) {
    try {
      await toggleArchive(review.id).unwrap();
      showToast(review.archived ? "Review restored to the inbox" : "Review archived");
      if (openId === review.id) setOpenId(null);
    } catch (error) {
      showToast(getApiErrorMessage(error), { tone: "info" });
    }
  }
  async function remove() {
    const review = confirmDelete;
    try {
      await deleteReview(review.id).unwrap();
      showToast("Review deleted");
      setConfirmDelete(null);
      if (openId === review.id) setOpenId(null);
    } catch (error) {
      showToast(getApiErrorMessage(error), { tone: "info" });
    }
  }
  const viewJob = (review) => review.jobId && navigate(`/jobs/detail?id=${encodeURIComponent(review.jobId)}`);

  const menuItems = (review) => [
    { label: "View review", icon: "eye", onClick: () => setOpenId(review.id) },
    { label: "Open job", icon: "package", disabled: !review.jobId, onClick: () => viewJob(review) },
    { label: `All reviews about ${review.ratee.name.split(" ")[0]}`, icon: "list-filter", disabled: !review.ratee.id, onClick: () => showAbout(review.ratee) },
    { divider: true },
    { label: review.archived ? "Move to inbox" : "Archive", icon: review.archived ? "inbox" : "archive", disabled: archiveState.isLoading, onClick: () => archive(review) },
    ...(isSuperAdmin ? [{ label: "Delete", icon: "trash-2", tone: "danger", onClick: () => setConfirmDelete(review) }] : []),
  ];

  const columns = [
    { key: "ratee", header: "Rated User", render: (r) => <span className={styles.rateeCell + " " + styles.wrapName}>{r.unread && <span className={styles.unreadDot} title="New" />}<Person person={r.ratee} avatar={false} /></span> },
    { key: "score", header: "Rating", width: 96, render: (r) => <span className={styles.ratingCell}><Stars value={r.score} /></span> },
    {
      key: "comment", header: "Review",
      render: (r) => (
        <span className={styles.reviewCell}>
          <span className={r.comment ? styles.comment : styles.noComment}>{r.comment ?? "No written comment"}</span>
          {(r.tags.length > 0 || r.reply) && (
            <span className={styles.reviewMeta}>
              {r.tags.slice(0, 2).map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}
              {r.tags.length > 2 && <span className={styles.tagMore}>+{r.tags.length - 2}</span>}
              {r.reply && <span className={styles.replied}><Icon name="reply" size={11} />Replied</span>}
            </span>
          )}
        </span>
      ),
    },
    { key: "job", header: "Job", render: (r) => r.jobNumber ? <button type="button" className={styles.jobLink} onClick={(e) => { e.stopPropagation(); viewJob(r); }}>{r.jobNumber}</button> : "—" },
    { key: "rater", header: "Rated By", render: (r) => <span className={styles.wrapName}><Person person={r.rater} avatar={false} /></span> },
    { key: "date", header: "Date", render: (r) => <span className={styles.date}>{r.date}<small>{r.time}</small></span> },
    {
      key: "actions", header: "", width: 48, align: "right",
      render: (r) => (
        <span className={styles.menuWrap} onClick={(e) => e.stopPropagation()}>
          <IconButton icon="ellipsis" label="Review actions" onClick={(e) => { e?.stopPropagation?.(); setMenuId(menuId === r.id ? null : r.id); }} />
          {menuId === r.id && <DropdownMenu width={220} items={menuItems(r)} style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 'var(--tk-z-sticky)' }} />}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        crumbs={["Support System", "Ratings & Reviews"]}
        title="Ratings & Reviews"
        description="What forwarders and truckers say about each other after every job."
      />

      <StatsPanel fixedLabel="All time" fixedHint="Rating totals cover every review left on Trukkas; “New this week” covers the last 7 days.">
        <StatCard layout="stack" icon="star" tint="amber" label="Average Rating"
          value={metric(isNum(summary?.averageRating) ? <span className={styles.avgValue}>{summary.averageRating.toFixed(1)}<Stars value={summary.averageRating} size={13} /></span> : "—")}
          caption="out of 5" />
        <StatCard layout="stack" icon="messages-square" tint="blue" label="Total Reviews" value={metric(fmt(summary?.total))} caption={isNum(summary?.newThisWeek) ? `+${fmt(summary.newThisWeek)} this week` : undefined} />
        <StatCard layout="stack" icon="thumbs-up" tint="green" label="Positive (4–5★)" value={metric(isNum(positiveShare) ? `${positiveShare.toFixed(0)}%` : "—")} caption="of all reviews" />
        <StatCard layout="stack" icon="thumbs-down" tint="red" label="Low Ratings (1–2★)" value={metric(fmt(lowCount))} caption="Worth a follow-up" />
        <StatCard layout="stack" icon="mail" tint="purple" label="Unread" value={metric(fmt(summary?.unread))} caption="Not yet seen by an admin" />
      </StatsPanel>

      <div className={styles.layout}>
        <SectionCard title="" pad="none" className={styles.tableCard}>
          <div className={styles.tabs}>
            <Tabs
              value={tab}
              onChange={(value) => { setTab(value); setPage(1); setOpenId(null); }}
              items={[{ value: "feedback", label: "Inbox" }, { value: "archive", label: "Archived" }]}
            />
          </div>
          <TableToolbar
            search={<SearchField style={{ flex: 1 }} placeholder="Search by name, job or comment..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
            filters={
              <>
                <CustomSelect aria-label="Star rating" value={filters.star} onChange={(e) => setFilter("star", e.target.value)}>
                  {STAR_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </CustomSelect>
                <CustomSelect aria-label="Reviewer type" value={filters.userType} onChange={(e) => setFilter("userType", e.target.value)}>
                  {RATER_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </CustomSelect>
                <CustomSelect aria-label="Rated user type" value={filters.rateeRole} onChange={(e) => setFilter("rateeRole", e.target.value)}>
                  {RATEE_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </CustomSelect>
                {filtered && <Button variant="outline" icon="rotate-ccw" onClick={reset}>Reset</Button>}
              </>
            }
          />
          {filters.ratee && (
            <div className={styles.activeFilter}>
              <span>Showing reviews about <strong>{filters.ratee.name}</strong></span>
              <button type="button" onClick={() => setFilter("ratee", null)}><Icon name="x" size={13} />Clear</button>
            </div>
          )}
          <DataTable rows={loading ? [] : rows} rowKey={(r) => r.id} onRowClick={(r) => setOpenId(r.id)} columns={columns} />
          {loading && <DriverTableLoading columns={6} label="Loading reviews" />}
          {!loading && !rows.length && (
            <div className={styles.emptyTable}>
              {listQuery.error ? (
                <DriverLoadingNotice>{getApiErrorMessage(listQuery.error)}</DriverLoadingNotice>
              ) : !authenticated || !data ? "—" : (
                <>
                  <Icon name={tab === "archive" ? "archive" : "star"} size={22} />
                  <strong>{filtered ? "No reviews match these filters" : tab === "archive" ? "No archived reviews" : "No reviews yet"}</strong>
                  <span>{filtered ? "Try a different rating or clear the search." : tab === "archive" ? "Reviews you archive land here." : "Ratings appear here once jobs are completed and rated."}</span>
                  {filtered && <Button variant="outline" size="sm" icon="rotate-ccw" onClick={reset}>Clear filters</Button>}
                </>
              )}
            </div>
          )}
          <Pagination page={page} pageCount={pages} pageSize={REVIEWS_PAGE_SIZE} total={data?.total ?? null} onPage={(p) => { if (pages != null && !loading) setPage(Math.min(Math.max(1, p), pages)); }} />
        </SectionCard>

        <div className={styles.rail}>
          <SectionCard title="Rating Breakdown" description="Click a level to filter the list">
            {distribution ? (
              <div className={styles.breakdown}>
                <div className={styles.breakdownHead}>
                  <strong>{isNum(summary?.averageRating) ? summary.averageRating.toFixed(1) : "—"}</strong>
                  <span><Stars value={summary?.averageRating} size={16} /><small>{fmt(distributionTotal)} reviews</small></span>
                </div>
                {distribution.map((row) => {
                  const share = distributionTotal ? (row.count / distributionTotal) * 100 : 0;
                  const active = filters.star === String(row.star);
                  return (
                    <button key={row.star} type="button" className={styles.barRow + (active ? " " + styles.barRowActive : "")} aria-pressed={active}
                      onClick={() => setFilter("star", active ? "All" : String(row.star))}>
                      <span className={styles.barLabel}>{row.star}<span className={styles.starOn}>★</span></span>
                      <span className={styles.barTrack}><span className={styles.barFill} data-low={row.star <= 2 || undefined} style={{ width: `${share}%` }} /></span>
                      <span className={styles.barCount}>{fmt(row.count)}<small>{distributionTotal ? `${share.toFixed(0)}%` : ""}</small></span>
                    </button>
                  );
                })}
              </div>
            ) : summaryLoading ? (
              <div className={styles.breakdown}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={12} />)}</div>
            ) : (
              <div className={styles.emptySmall}>Rating breakdown unavailable</div>
            )}
          </SectionCard>

          <SectionCard title="Quick Filters">
            <div className={styles.quick}>
              <QuickRow icon="thumbs-down" tint="red" title="1-star reviews" hint="The worst experiences to follow up" value={fmt(distribution?.find((row) => row.star === 1)?.count)} onClick={() => { setTab("feedback"); setFilters({ ...EMPTY_FILTERS, star: "1" }); setPage(1); }} />
              <QuickRow icon="user-round" tint="blue" title="Reviews about drivers" hint="How drivers are performing" onClick={() => { setTab("feedback"); setFilters({ ...EMPTY_FILTERS, rateeRole: "DRIVER" }); setPage(1); }} />
              <QuickRow icon="users-round" tint="purple" title="Reviews of forwarders" hint="Left by truckers after delivery" onClick={() => { setTab("feedback"); setFilters({ ...EMPTY_FILTERS, rateeRole: "FORWARDER" }); setPage(1); }} />
            </div>
          </SectionCard>
        </div>
      </div>

      {openReview && (
        <ReviewDrawer
          review={openReview}
          isSuperAdmin={isSuperAdmin}
          archiving={archiveState.isLoading}
          onClose={() => setOpenId(null)}
          onArchive={() => archive(openReview)}
          onDelete={() => setConfirmDelete(openReview)}
          onViewJob={() => viewJob(openReview)}
          onShowAbout={showAbout}
          onOpenProfile={(person) => navigate(PROFILE_ROUTE[person.roleCode](person.id))}
        />
      )}

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => { if (!deleteState.isLoading) setConfirmDelete(null); }}
        title="Delete this review?"
        width={440}
        footer={
          <>
            <Button variant="outline" disabled={deleteState.isLoading} onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" icon="trash-2" disabled={deleteState.isLoading} onClick={remove}>Delete review</Button>
          </>
        }
      >
        <p className={styles.modalText}>
          The {isNum(confirmDelete?.score) ? `${confirmDelete.score}-star ` : ""}review by <strong>{confirmDelete?.rater.name}</strong> will be removed permanently and will no longer count toward anyone’s rating. If you only want it out of the inbox, archive it instead.
        </p>
      </Modal>
    </div>
  );
}

function ReviewDrawer({ review, isSuperAdmin, archiving, onClose, onArchive, onDelete, onViewJob, onShowAbout, onOpenProfile }) {
  const timeline = [
    { icon: "star", tone: "done", title: "Review submitted", at: review.submittedAt, text: `${review.rater.name} rated ${review.ratee.name} after the job` },
    review.reply
      ? { icon: "reply", tone: "done", title: "Reply posted", at: review.reply.at, text: `${review.ratee.name} replied publicly` }
      : { icon: "clock-3", tone: "waiting", title: "No reply yet", text: `${review.ratee.name} hasn’t replied` },
    ...(review.archived ? [{ icon: "archive", tone: "muted", title: "Archived", text: "Moved out of the admin inbox" }] : []),
  ];
  const party = (label, person) => (
    <div className={styles.partyCard}>
      <span className={styles.partyLabel}>{label}</span>
      <Person person={person} />
      {person.email && <small className={styles.partyEmail}>{person.email}</small>}
      <div className={styles.partyLinks}>
        {person.id && <button type="button" onClick={() => onShowAbout(person)}>Reviews about them</button>}
        {person.id && PROFILE_ROUTE[person.roleCode] && <button type="button" onClick={() => onOpenProfile(person)}>Profile</button>}
      </div>
    </div>
  );

  return (
    <SideDrawer
      label="Review details"
      eyebrow={review.jobNumber ? `Review · ${review.jobNumber}` : "Review"}
      title={
        <span className={styles.drawerTitle}>
          <strong>{isNum(review.score) ? review.score.toFixed(1) : "—"}<small>/ 5</small></strong>
          <Stars value={review.score} size={20} />
          {SCORE_WORD[review.score] && <Badge tone={SCORE_TONE[review.score]}>{SCORE_WORD[review.score]}</Badge>}
        </span>
      }
      meta={`${review.submittedAt ?? "—"}${review.archived ? " · Archived" : ""}`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button icon="package" disabled={!review.jobId} onClick={onViewJob}>Open job</Button>
          <Button variant="outline" icon={review.archived ? "inbox" : "archive"} disabled={archiving} onClick={onArchive}>{review.archived ? "Move to inbox" : "Archive"}</Button>
          {isSuperAdmin && <Button variant="ghost" icon="trash-2" onClick={onDelete} style={{ color: "var(--tk-danger)" }}>Delete review</Button>}
        </>
      }
    >
      <DrawerSection title="Review">
        <blockquote className={review.comment ? styles.quote : styles.quoteEmpty}>{review.comment ?? "The reviewer left a star rating without a written comment."}</blockquote>
        {review.tags.length > 0 && <div className={styles.tagList}>{review.tags.map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}</div>}
      </DrawerSection>

      {review.aspects && (
        <DrawerSection title="Rating Breakdown">
          <div className={styles.aspects}>
            {review.aspects.map((aspect) => (
              <div key={aspect.key} className={styles.aspect}>
                <span className={styles.aspectLabel}><Icon name={aspect.icon} size={14} />{aspect.label}</span>
                <Stars value={aspect.score} size={13} />
                <b>{isNum(aspect.score) ? aspect.score.toFixed(1) : "—"}</b>
              </div>
            ))}
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Reply">
        {review.reply ? (
          <div className={styles.reply}>
            <span className={styles.replyHead}><Icon name="reply" size={13} /><strong>{review.ratee.name}</strong>{review.reply.at && <small>{review.reply.at}</small>}</span>
            <p>{review.reply.text}</p>
          </div>
        ) : (
          <p className={styles.emptySmallLeft}>{review.ratee.name} hasn’t replied to this review.</p>
        )}
      </DrawerSection>

      <DrawerSection title="People">
        <div className={styles.parties}>
          {party("Rated user", review.ratee)}
          {party("Rated by", review.rater)}
        </div>
      </DrawerSection>

      <DrawerSection title="Details">
        <DrawerFacts items={[
          { label: "Job", value: review.jobNumber ?? "—" },
          { label: "Submitted", value: review.submittedAt ?? "—" },
          { label: "Status", value: review.archived ? "Archived" : "In inbox" },
          { label: "Seen by admin", value: review.unread ? "New" : "Yes" },
        ]} />
      </DrawerSection>

      <DrawerSection title="Timeline">
        <ol className={styles.timeline}>
          {timeline.map((step) => (
            <li key={step.title} data-tone={step.tone}>
              <span className={styles.timelineDot}><Icon name={step.icon} size={12} /></span>
              <div>
                <strong>{step.title}</strong>
                {step.at && <small>{step.at}</small>}
                <span>{step.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </DrawerSection>
    </SideDrawer>
  );
}

function QuickRow({ icon, tint, title, hint, value, onClick }) {
  return (
    <button type="button" className={styles.quickRow} onClick={onClick}>
      <span className={styles.quickIcon} data-tint={tint}><Icon name={icon} size={15} /></span>
      <span className={styles.quickText}><strong>{title}</strong><small>{hint}</small></span>
      {value != null && <b>{value}</b>}
      <Icon name="chevron-right" size={14} />
    </button>
  );
}
