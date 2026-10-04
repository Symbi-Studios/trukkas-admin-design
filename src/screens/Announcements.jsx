"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  Card,
  SectionCard,
  Tabs,
  SearchField,
  DataTable,
  Pagination,
  Badge,
  Icon,
  DropdownMenu,
  Skeleton,
} from "../ds.js";
import { useGetAdminAnnouncementDirectoryQuery, useGetAdminAnnouncementStatusCountsQuery, usePublishAdminAnnouncementMutation, announcementCount, announcementDetailUrl, announcementEditUrl, announcementCopyUrl, announcementUnavailable, ANNOUNCEMENT_STATUSES } from "../store/features/announcements/announcementsApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverTableLoading, DriverLoadingNotice } from "./DriversLoading.jsx";
import "./Engagement.css";
const PAGE_SIZE = 8;
const TONE = {
  System: "info",
  Feature: "success",
  Update: "info",
  Notice: "purple",
  Reminder: "warning",
  Campaign: "purple",
};
const ICON = {
  System: "megaphone",
  Feature: "sparkles",
  Update: "info",
  Notice: "calendar-days",
  Reminder: "clock-3",
  Campaign: "send",
};
function csvExport(rows) {
  const csv = [
    ["Announcement", "Type", "Audience", "Status", "Date", "Views"],
    ...rows.map((r) => [r.t, r.type, r.aud, r.st, r.d, r.v ?? "—"]),
  ]
    .map((x) =>
      x.map((v) => '"' + (/^[=+@\-\t\r]/.test(String(v)) ? "'" : "") + String(v).replaceAll('"', '""') + '"').join(","),
    )
    .join("\n");
  const u = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = u;
  a.download = "announcements.csv";
  a.click();
  URL.revokeObjectURL(u);
}
export function Announcements() {
  const navigate = useNavigate();
  const owner = useSelector((state) => state.auth.admin?.id);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const [tab, setTab] = useState("All Announcements"),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("All"),
    [type, setType] = useState("All"),
    [audience, setAudience] = useState("All"),
    [page, setPage] = useState(1),
    [menu, setMenu] = useState(null),
    [toast, setToast] = useState("");
  const directory = useGetAdminAnnouncementDirectoryQuery({ owner }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const countsQuery = useGetAdminAnnouncementStatusCountsQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const tabStatus = tab === 'All Announcements' ? null : ANNOUNCEMENT_STATUSES[tab === 'Drafts' ? 'Draft' : tab];
  const chosenStatus = status === 'All' ? null : ANNOUNCEMENT_STATUSES[status];
  const conflict = Boolean(tabStatus && chosenStatus && tabStatus !== chosenStatus);
  const serverStatus = chosenStatus || tabStatus;
  const statusQuery = useGetAdminAnnouncementDirectoryQuery({ owner, status: serverStatus }, { skip: !authenticated || !serverStatus || conflict, refetchOnMountOrArgChange: true });
  const source = serverStatus ? statusQuery : directory;
  const allRows = authenticated && !directory.error ? directory.currentData : undefined;
  const rows = conflict ? [] : authenticated && !source.error ? source.currentData : undefined;
  const loading = !conflict && authenticated && source.isFetching;
  const available = Boolean(rows) && (type === 'All' || rows.every((row) => row.typeKnown))
    && (audience === 'All' || rows.every((row) => row.audienceKnown)) && (!q.trim() || rows.every((row) => row.searchKnown));
  const counts = authenticated && !countsQuery.error ? countsQuery.currentData : undefined;
  const totalViews = allRows?.every((row) => row.v != null) ? allRows.reduce((sum, row) => sum + row.v, 0) : null;
  const recent = allRows?.every((row) => row.createdAt != null) ? [...allRows].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4) : [];
  const [publishAnnouncement, publication] = usePublishAdminAnnouncementMutation();
  const publishing = useRef(false), toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const filtered = useMemo(
    () =>
      (rows || []).filter(
        (r) =>
          (type === "All" || r.type === type) &&
          (audience === "All" || r.aud === audience) &&
          (!q.trim() ||
            [r.t, r.p, r.id].some((v) =>
              v.toLowerCase().includes(q.trim().toLowerCase()),
            )),
      ),
    [rows, tab, status, type, audience, q],
  );
  const total = available ? filtered.length : null;
  const pageCount = total == null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paged = available ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];
  useEffect(() => { if (pageCount != null && page > pageCount) setPage(pageCount); }, [page, pageCount]);
  function notify(s) {
    clearTimeout(toastTimer.current);
    setToast(s);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }
  async function publish(id) {
    setMenu(null);
    if (publishing.current || publication.isLoading) return;
    publishing.current = true;
    try { const response = await publishAnnouncement({ id, owner }).unwrap(); notify(response.message); }
    catch (error) { notify(getApiErrorMessage(error)); }
    finally { publishing.current = false; }
  }
  const metric = (value, pending) => pending ? <Skeleton as="span" width={54} height={23} /> : announcementCount(value);
  return (
    <div className="engagement-page">
      <PageHeader
        crumbs={["Support System", "Announcements"]}
        title="Announcements"
        description="Create, manage and broadcast important updates to users."
        actions={
          <>
            <Button
              variant="outline"
              icon="download"
              onClick={() => { if (!available || loading) { window.alert(source.error ? getApiErrorMessage(source.error) : 'The complete announcement results are unavailable for export.'); return; } csvExport(filtered); }}
            >
              Export
            </Button>
            <Button icon="plus" onClick={() => navigate("/announcements/new")}>
              New Announcement
            </Button>
          </>
        }
      />
      <div className="engagement-stats">
        <StatCard
          icon="megaphone"
          label="Total Announcements"
          value={metric(allRows?.length, directory.isFetching)}
          delta="—"
          direction={null}
          caption="from last 30 days"
        />
        <StatCard
          icon="send"
          tint="green"
          label="Published"
          value={metric(counts?.PUBLISHED, countsQuery.isFetching)}
          delta="—"
          direction={null}
          caption="from last 30 days"
        />
        <StatCard
          icon="calendar"
          label="Scheduled"
          value={metric(counts?.SCHEDULED, countsQuery.isFetching)}
          delta="—"
          direction={null}
          caption="from last 30 days"
        />
        <StatCard
          icon="eye"
          tint="purple"
          label="Total Views"
          value={metric(totalViews, directory.isFetching)}
          delta="—"
          direction={null}
          caption="from last 30 days"
        />
      </div>
      <div className="engagement-layout">
        <SectionCard title="" pad="none">
          <Tabs
            value={tab}
            onChange={(v) => {
              setTab(v);
              setPage(1);
            }}
            items={[
              "All Announcements",
              "Published",
              "Scheduled",
              "Drafts",
              "Expired",
            ]}
            style={{ padding: "0 16px" }}
          />
          <div className="engagement-toolbar">
            <SearchField
              className="search"
              style={{ flex: 1 }}
              placeholder="Search announcements..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Status filter"
              className="engagement-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {["All", "Published", "Scheduled", "Draft", "Expired"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
            <select
              aria-label="Type filter"
              className="engagement-select"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option>All</option>
              {Object.keys(ICON).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              aria-label="Audience filter"
              className="engagement-select"
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value);
                setPage(1);
              }}
            >
              <option>All</option>
              {[...new Set((allRows || []).filter((r) => r.audienceKnown).map((r) => r.aud))].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <Button
              variant="outline"
              icon="rotate-ccw"
              onClick={() => {
                setQ("");
                setStatus("All");
                setType("All");
                setAudience("All");
                setPage(1);
              }}
            >
              Reset
            </Button>
          </div>
          {loading ? <DriverTableLoading columns={7} label="Loading announcements" /> : <DataTable
            rows={paged}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(announcementDetailUrl(r.id))}
            columns={[
              {
                key: "t",
                header: "Announcement",
                render: (r) => (
                  <span className="engagement-title-cell">
                    <span className="type-icon">
                      <Icon name={r.icon} size={15} />
                    </span>
                    <span>
                      <strong>{r.t}</strong>
                      <small>{r.p}</small>
                    </span>
                  </span>
                ),
              },
              {
                key: "type",
                header: "Type",
                render: (r) => <Badge tone={TONE[r.type]}>{r.type}</Badge>,
              },
              { key: "aud", header: "Audience" },
              {
                key: "st",
                header: "Status",
                render: (r) => <Badge>{r.st}</Badge>,
              },
              {
                key: "d",
                header: "Published / Scheduled",
                render: (r) => (
                  <span style={{ display: "grid", whiteSpace: "nowrap" }}>
                    {r.d}
                    <small className="tk-meta">{r.tm}</small>
                  </span>
                ),
              },
              {
                key: "v",
                header: "Views",
                render: (r) => r.v?.toLocaleString() ?? "—",
              },
              {
                key: "x",
                header: "Actions",
                width: 44,
                render: (r) => (
                  <span className="action-menu-wrap">
                    <Button
                      variant="ghost"
                      icon="ellipsis"
                      size="sm"
                      aria-label={"Actions for " + r.t}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu(menu === r.id ? null : r.id);
                      }}
                    />
                    {menu === r.id && (
                      <span
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 34,
                          zIndex: 30,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu
                          width={210}
                          items={[
                            {
                              label: "View Announcement",
                              icon: "eye",
                              onClick: () => navigate(announcementDetailUrl(r.id)),
                            },
                            {
                              label: "Edit Announcement",
                              icon: "pencil",
                              onClick: () =>
                                navigate(announcementEditUrl(r.id)),
                            },
                            r.st !== "Published"
                              ? {
                                  label: "Publish Now",
                                  icon: "send",
                                  disabled: publication.isLoading,
                                  onClick: () => publish(r.id),
                                }
                              : {
                                  label: "Unpublish",
                                  icon: "archive",
                                  onClick: () => {
                                    setMenu(null);
                                    announcementUnavailable('Unpublish');
                                  },
                                },
                            { divider: true },
                            {
                              label: "Duplicate",
                              icon: "copy",
                              onClick: () =>
                                navigate(announcementCopyUrl(r.id)),
                            },
                          ]}
                        />
                      </span>
                    )}
                  </span>
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
              {source.error && !conflict ? <DriverLoadingNotice>{getApiErrorMessage(source.error)}</DriverLoadingNotice> : available ? 'No announcements match your filters.' : '—'}
            </div>
          )}
          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
            total={total}
            onPage={(p) =>
              setPage(
                Math.min(
                  Math.max(1, p),
                  pageCount || 1,
                ),
              )
            }
          />
        </SectionCard>
        <div className="engagement-rail">
          <SectionCard title="Announcement Types">
            {Object.keys(ICON).map((name) => (
              <button
                className="engagement-side-row"
                key={name}
                onClick={() => {
                  setType(name);
                  setPage(1);
                }}
              >
                <span className="side-icon">
                  <Icon name={ICON[name]} size={13} />
                </span>
                <span>
                  <strong>{name}</strong>
                </span>
                <b>{allRows?.every((r) => r.typeKnown) ? announcementCount(allRows.filter((r) => r.type === name).length) : '—'}</b>
              </button>
            ))}
            <Button
              variant="ghost"
              fullWidth
              iconRight="arrow-right"
              onClick={() => setType("All")}
            >
              View all types
            </Button>
          </SectionCard>
          <SectionCard
            title="Recent Announcements"
            action={
              <button
                className="engagement-primary"
                style={{ border: 0, background: "none" }}
                onClick={() => {
                  setTab("All Announcements");
                  setPage(1);
                }}
              >
                View all
              </button>
            }
          >
            {recent.map((r) => (
              <button
                className="engagement-side-row"
                key={r.id}
                onClick={() => navigate(announcementDetailUrl(r.id))}
              >
                <span className="side-icon">
                  <Icon name={r.icon} size={13} />
                </span>
                <span>
                  <strong>{r.t}</strong>
                  <small>{r.d}</small>
                </span>
                <Badge>{r.st}</Badge>
              </button>
            ))}
            {!recent.length && !directory.isFetching && '—'}
          </SectionCard>
          <Card tone="cool">
            <div style={{ display: "flex", gap: 12 }}>
              <Icon name="lightbulb" size={22} color="var(--tk-blue)" />
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: 13 }}>Tips</h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: "var(--tk-ink-500)",
                  }}
                >
                  Announcements help you keep your users informed and reduce
                  support requests.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              fullWidth
              iconRight="arrow-right"
              style={{ marginTop: 14 }}
              onClick={() => navigate("/knowledge-base")}
            >
              Learn more about announcements
            </Button>
          </Card>
        </div>
      </div>
      {toast && <div className="eng-toast">{toast}</div>}
    </div>
  );
}
