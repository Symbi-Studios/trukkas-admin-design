"use client";

import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  TableToolbar,
  SearchField,
  FilterSelect,
  DataTable,
  Pagination,
  Badge,
  Tag,
  DonutChart,
  LegendList,
  QuickActionsCard,
  Card,
  DropdownMenu,
  IconButton,
  Icon,
  Avatar, Banner, Modal, EmptyState,
} from "../ds.js";

import { forwarderMoney, forwarderError, useGetAdminForwarderDirectoryQuery, useGetAdminForwarderStatsQuery, useGetAdminForwarderRankingsQuery, useLazyDownloadAdminForwarderReportQuery, useGetAdminPendingExporterLicensesQuery } from '../store/features/forwarders/forwardersApi.js';
import { ForwardersLoading } from './ForwardersLoading.jsx';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import { ForwarderActionModal, ForwarderAnnouncementModal, downloadForwarderCsv } from './ForwarderActions.jsx';
import { ForwarderProfileModal, ForwarderBulkVerifyModal } from './ForwarderForms.jsx';
import './ForwarderDetail.css';

const STATUSES = ["Active", "Pending", "Suspended", "Inactive", "Banned"];
const VERIFICATIONS = ["Verified", "Pending", "Rejected"];
const STATUS_TONE = {
  Active: "success",
  Pending: "warning",
  Suspended: "danger",
};
const VERIFICATION_META = {
  Verified: { tone: "success", icon: "circle-check" },
  Pending: { tone: "warning", icon: "hourglass" },
  Rejected: { tone: "danger", icon: "circle-x" },
};
const naira = forwarderMoney;

function ForwarderCell({ f }) {
  return (
    <span
      style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
    >
      <Avatar name={f.name} size={32} />
      <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
        <Link
          to={`/forwarders/detail?id=${encodeURIComponent(f.id)}`}
          style={{ font: "600 13px/18px var(--tk-font-sans)" }}
        >
          {f.name}
        </Link>
        <span className="tk-meta">{f.id}</span>
      </span>
    </span>
  );
}

export function Forwarders() {
  const navigate = useNavigate();
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const owner = useSelector(state => state.auth.admin?.id);
  const directoryQuery = useGetAdminForwarderDirectoryQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const pendingQuery = useGetAdminPendingExporterLicensesQuery(owner, { skip: !authenticated });
  const statsQuery = useGetAdminForwarderStatsQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const rankingsQuery = useGetAdminForwarderRankingsQuery({ owner, page: 1, limit: 20 }, { skip: !authenticated });
  const [downloadReport, reportState] = useLazyDownloadAdminForwarderReportQuery();
  const [addOpen, setAddOpen] = useState(false), [bulkOpen, setBulkOpen] = useState(false);
  const FORWARDERS = directoryQuery.error ? [] : directoryQuery.currentData || [];
  const pendingLicenses = pendingQuery.error ? [] : pendingQuery.currentData?.rows || [];
  const [action, setAction] = useState(null), [announcement, setAnnouncement] = useState(false), [requestsOpen, setRequestsOpen] = useState(false), [notice, setNotice] = useState(null), [pageSize, setPageSize] = useState(10);
  const unavailable = (feature) => setNotice({ tone: 'info', text: `${feature} is not available yet.` });
  const summary = statsQuery.error ? null : statsQuery.currentData;
  const STATS = { total: summary?.total ?? '—', active: summary?.active ?? '—', exporters: summary?.exporters ?? '—', suspended: summary?.suspended ?? '—', pending: summary?.pending ?? '—', totalSpend: summary?.totalSpend ?? null };
  const overviewColors = { Active: 'var(--tk-success)', Pending: 'var(--tk-warning)', Suspended: 'var(--tk-danger-solid)', Inactive: 'var(--tk-neutral)', Banned: 'var(--tk-ink-400)' };
  const OVERVIEW = (summary?.overview || []).map(item => ({ ...item, color: overviewColors[item.label] }));
  useEffect(() => { if (statsQuery.error) setNotice({ tone: 'danger', text: forwarderError(statsQuery.error) }); }, [statsQuery.error]);
  async function exportReport() {
    if (reportState.isLoading) return;
    try {
      const file = await downloadReport({ owner }).unwrap(), link = document.createElement('a');
      link.href = file.url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(file.url), 1000);
      if (typeof STATS.total === 'number' && STATS.total > 1000) setNotice({ tone: 'info', text: 'The PDF report includes the newest 1,000 forwarders.' });
    } catch (error) { setNotice({ tone: 'danger', text: forwarderError(error) }); }
  }

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All Status");
  const [verification, setVerification] = useState("All Verification Status");
  const [location, setLocation] = useState("All Locations");
  const [type, setType] = useState("All Types");
  const [openFilter, setOpenFilter] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  const locations = useMemo(
    () => [...new Set(FORWARDERS.map((f) => f.location).filter((value) => value !== "—"))],
    [directoryQuery.currentData, directoryQuery.error],
  );

  const filtered = useMemo(
    () =>
      FORWARDERS.filter((f) => {
        const matchesQ =
          !q ||
          [f.name, f.id, f.email, f.phone].some((v) =>
            String(v || "").toLowerCase().includes(q.toLowerCase()),
          );
        const matchesStatus = status === "All Status" || f.status === status;
        const matchesVerification =
          verification === "All Verification Status" ||
          f.verification === verification;
        const matchesLocation =
          location === "All Locations" || f.location === location;
        const matchesType =
          type === "All Types" ||
          (type === "Exporter" ? f.isExporter === true : f.isExporter === false);
        return (
          matchesQ &&
          matchesStatus &&
          matchesVerification &&
          matchesLocation &&
          matchesType
        );
      }),
    [directoryQuery.currentData, directoryQuery.error, q, status, verification, location, type],
  );

  useEffect(() => { setPage(1); }, [q, status, verification, location, type, pageSize]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  function exportList() {
    downloadForwarderCsv('forwarders.csv', [['ID', 'Name', 'Type', 'Email', 'Phone', 'Location', 'Status', 'Verification', 'Total Jobs', 'Total Spend (NGN)', 'Joined'], ...filtered.map((row) => [row.id, row.name, row.isExporter == null ? '—' : row.isExporter ? 'Exporter' : 'Forwarder', row.email, row.phone, row.location, row.status, row.verification, row.jobs, row.spend, row.joined])]);
  }
  if (!directoryQuery.currentData && directoryQuery.isFetching) return <ForwardersLoading />;
  return (
    <>
      <PageHeader
        crumbs={["Partners", "Forwarders / Exporters"]}
        title="Forwarders / Exporters"
        description="Manage and monitor all forwarders and exporters on the platform. Forwarders are individuals; an exporter is a forwarder holding a valid export license."
        actions={
          <>
            <Button icon="plus" onClick={() => setAddOpen(true)}>Add Forwarder</Button>
            <Button variant="outline" icon="download" iconRight="chevron-down" disabled={!directoryQuery.currentData || Boolean(directoryQuery.error)} onClick={exportList}>
              Export
            </Button>
            <Button variant="outline" icon="sliders-horizontal" onClick={() => setOpenFilter("type")}>
              Filters
            </Button>
          </>
        }
      />

      {notice && <Banner tone={notice.tone} action={<Button variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice.text}</Banner>}
      {directoryQuery.error && <Banner tone="danger" title="Unable to load forwarders" action={<Button variant="outline" onClick={directoryQuery.refetch}>Retry</Button>}>{forwarderError(directoryQuery.error)}</Banner>}
      {(directoryQuery.isFetching || statsQuery.isFetching) && <DriverLoadingNotice>Refreshing forwarders…</DriverLoadingNotice>}
      {FORWARDERS.some((row) => row.profileUnavailable) && <Banner tone="warning" action={<Button variant="outline" onClick={directoryQuery.refetch}>Retry</Button>}>Some profiles could not be loaded. Their joined dates and verification statuses are unavailable.</Banner>}
      <div className="fw-stats">
        <StatCard
          icon="users"
          label="Total Forwarders"
          value={STATS.total}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Active Forwarders"
          value={STATS.active}
        />
        <StatCard
          icon="ship"
          tint="teal"
          label="Exporters"
          value={STATS.exporters}
          caption="hold export license"
        />
        <StatCard
          icon="hourglass"
          tint="amber"
          label="Pending Verification"
          value={STATS.pending}
          direction="down"
        />
        <StatCard
          icon="circle-x"
          tint="purple"
          label="Suspended"
          value={STATS.suspended}
          direction="down"
        />
        <StatCard
          icon="wallet"
          tint="blue"
          label="Total Spend (₦)"
          value={naira(STATS.totalSpend)}
        />
      </div>

      <Card pad="none">
        <TableToolbar
          search={
            <SearchField
              placeholder="Search by name, forwarder ID, email, phone..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          }
          filters={
            <>
              <span style={{ position: "relative" }}>
                <FilterSelect
                  label={type}
                  active={type !== "All Types"}
                  onClick={() =>
                    setOpenFilter(openFilter === "type" ? null : "type")
                  }
                />
                {openFilter === "type" && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 44,
                      zIndex: 30,
                    }}
                  >
                    <DropdownMenu
                      width={200}
                      items={["All Types", "Forwarder", "Exporter"].map(
                        (s) => ({
                          label: s,
                          icon: s === type ? "check" : undefined,
                          onClick: () => {
                            setType(s);
                            setOpenFilter(null);
                          },
                        }),
                      )}
                    />
                  </span>
                )}
              </span>
              <span style={{ position: "relative" }}>
                <FilterSelect
                  label={status}
                  active={status !== "All Status"}
                  onClick={() =>
                    setOpenFilter(openFilter === "status" ? null : "status")
                  }
                />
                {openFilter === "status" && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 44,
                      zIndex: 30,
                    }}
                  >
                    <DropdownMenu
                      width={180}
                      items={["All Status", ...STATUSES].map((s) => ({
                        label: s,
                        icon: s === status ? "check" : undefined,
                        onClick: () => {
                          setStatus(s);
                          setOpenFilter(null);
                        },
                      }))}
                    />
                  </span>
                )}
              </span>
              <span style={{ position: "relative" }}>
                <FilterSelect
                  label={location}
                  active={location !== "All Locations"}
                  onClick={() =>
                    setOpenFilter(openFilter === "location" ? null : "location")
                  }
                />
                {openFilter === "location" && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 44,
                      zIndex: 30,
                    }}
                  >
                    <DropdownMenu
                      width={220}
                      items={["All Locations", ...locations].map((s) => ({
                        label: s,
                        icon: s === location ? "check" : undefined,
                        onClick: () => {
                          setLocation(s);
                          setOpenFilter(null);
                        },
                      }))}
                    />
                  </span>
                )}
              </span>
              <span style={{ position: "relative" }}>
                <FilterSelect
                  label={verification}
                  active={verification !== "All Verification Status"}
                  onClick={() =>
                    setOpenFilter(
                      openFilter === "verification" ? null : "verification",
                    )
                  }
                />
                {openFilter === "verification" && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 44,
                      zIndex: 30,
                    }}
                  >
                    <DropdownMenu
                      width={200}
                      items={["All Verification Status", ...VERIFICATIONS].map(
                        (s) => ({
                          label: s,
                          icon: s === verification ? "check" : undefined,
                          onClick: () => {
                            setVerification(s);
                            setOpenFilter(null);
                          },
                        }),
                      )}
                    />
                  </span>
                )}
              </span>
              <FilterSelect label="More Filters" icon="layout-grid" onClick={() => unavailable("Additional filters")} />
            </>
          }
        />
      </Card>

      <div className="fw-layout">
        <SectionCard pad="none">
          {directoryQuery.error ? <EmptyState icon="users" title="Forwarder list unavailable" description="Retry to load the directory." /> : !filtered.length ? <EmptyState icon="users" title="No forwarders found" description="Try different filters or search terms." /> : <DataTable
            rows={filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "name",
                header: "Forwarder",
                render: (r) => <ForwarderCell f={r} />,
              },
              {
                key: "type",
                header: "Type",
                render: (r) =>
                  r.isExporter == null ? <Tag>—</Tag> : r.isExporter ? (
                    <Tag tone="teal" icon={<Icon name="ship" size={11} />}>
                      Exporter
                    </Tag>
                  ) : (
                    <Tag>Forwarder</Tag>
                  ),
              },
              {
                key: "email",
                header: "Email / Phone",
                render: (r) => (
                  <span style={{ display: "grid", gap: 1 }}>
                    <span
                      style={{
                        font: "400 13px/18px var(--tk-font-sans)",
                        color: "var(--tk-ink-700)",
                      }}
                    >
                      {r.email}
                    </span>
                    <span className="tk-meta">{r.phone}</span>
                  </span>
                ),
              },
              {
                key: "location",
                header: "Location",
                render: (r) => (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 5,
                    }}
                  >
                    <Icon
                      name="map-pin"
                      size={13}
                      color="var(--tk-ink-300)"
                      style={{ marginTop: 3, flex: "0 0 auto" }}
                    />
                    {r.location}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <Badge tone={STATUS_TONE[r.status] || "neutral"}>{r.status}</Badge>
                ),
              },
              {
                key: "verification",
                header: "Verification",
                render: (r) => (
                  <Badge tone={VERIFICATION_META[r.verification]?.tone || "neutral"}>
                    <Icon
                      name={VERIFICATION_META[r.verification]?.icon || "info"}
                      size={11}
                    />
                    {r.verification}
                  </Badge>
                ),
              },
              { key: "jobs", header: "Total Jobs", align: "right", render: (r) => r.jobs ?? "—" },
              {
                key: "spend",
                header: "Total Spend (₦)",
                align: "right",
                render: (r) => (
                  <strong style={{ color: "var(--tk-ink-900)" }}>
                    {naira(r.spend)}
                  </strong>
                ),
              },
              { key: "joined", header: "Joined On" },
              {
                key: "x",
                header: "",
                width: 44,
                render: (r) => (
                  <span style={{ position: "relative" }}>
                    <IconButton
                      icon="ellipsis-vertical"
                      onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}
                    />
                    {menuFor === r.id && (
                      <span
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 34,
                          zIndex: 30,
                        }}
                      >
                        <DropdownMenu
                          width={200}
                          items={[
                            { label: "View Details", icon: "eye", onClick: () => navigate(`/forwarders/detail?id=${encodeURIComponent(r.id)}`) },
                            { divider: true },
                            ...(r.statusCode === 'SUSPENDED' ? [{ label: 'Reactivate Forwarder', icon: 'circle-check', onClick: () => { setMenuFor(null); setAction({ kind: 'activate', forwarder: r }); } }] : [{ label: 'Suspend Forwarder', icon: 'circle-alert', tone: 'danger', onClick: () => { setMenuFor(null); setAction({ kind: 'suspend', forwarder: r }); } }]),
                            ...(pendingLicenses.some((row) => row.id === r.id) ? [{ label: 'Review Exporter License', icon: 'ship', onClick: () => { setMenuFor(null); setAction({ kind: 'review', forwarder: pendingLicenses.find((row) => row.id === r.id) }); } }] : []),
                          ]}
                        />
                      </span>
                    )}
                  </span>
                ),
              },
            ]}
          />}
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            total={directoryQuery.error ? null : filtered.length}
            pageSize={pageSize}
            onPage={(next) => setPage(Math.max(1, Math.min(pageCount, next)))}
            onPageSize={setPageSize}
          />
        </SectionCard>

        <div
          style={{
            display: "grid",
            gap: "var(--tk-grid-gap)",
            alignContent: "start",
          }}
        >
          <SectionCard title="Forwarders Overview">
            <div style={{ display: "grid", justifyItems: "center", gap: 14 }}>
              <DonutChart
                size={150}
                thickness={20}
                centerValue={STATS.total}
                centerLabel="Total"
                data={OVERVIEW.every(item => item.value != null) && OVERVIEW.reduce((sum, item) => sum + item.value, 0) === STATS.total ? OVERVIEW : []}
              />
              <LegendList
                style={{ width: "100%" }}
                items={OVERVIEW.map((o) => ({
                  ...o,
                  display: `${o.value ?? "—"} (${o.share ?? "—"}%)`,
                }))}
                showShare={false}
              />
            </div>
          </SectionCard>

          <SectionCard title="Top Forwarders by Spend">
            <div style={{ display: "grid" }}>
              {rankingsQuery.isFetching ? <DriverTableLoading columns={3} label="Loading spending rankings" /> : rankingsQuery.error ? <Banner tone="danger" action={<Button variant="outline" onClick={rankingsQuery.refetch}>Retry</Button>}>{forwarderError(rankingsQuery.error)}</Banner> : !rankingsQuery.currentData?.rows.length ? <span className="tk-meta">No spending rankings available.</span> : rankingsQuery.currentData.rows.slice(0, 5).map(row => <div key={row.id} className="fd-row"><span className="tk-meta">{row.rank}</span><Link to={'/forwarders/detail?id=' + encodeURIComponent(row.id)} style={{ flex: 1 }}>{row.name}</Link><strong>{naira(row.spend)}</strong></div>)}

            </div>
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <Button variant="ghost" disabled={reportState.isLoading} onClick={exportReport}>View full report →</Button>
            </div>
          </SectionCard>

          <QuickActionsCard
            items={[
              { icon: "user-plus", label: "Add Forwarder", onClick: () => setAddOpen(true) },
              { icon: "shield-check", label: "Bulk Verify Forwarders", onClick: () => setBulkOpen(true) },
              { icon: "download", label: "Export Forwarders List", onClick: () => { if (directoryQuery.currentData && !directoryQuery.error) exportList(); else unavailable("Exporting the unloaded directory"); } },
              { icon: "megaphone", label: "Send Announcement", onClick: () => setAnnouncement(true) },
              {
                icon: "clipboard-list",
                label: "View Verification Requests",
                hint: pendingQuery.currentData && !pendingQuery.error ? `${pendingQuery.currentData.count ?? pendingLicenses.length} exporter licenses pending` : "Exporter license requests",
                onClick: () => setRequestsOpen(true),
              },
            ]}
          />
        </div>
      </div>
      <Modal open={requestsOpen} title="Verification Requests" description="Exporter licenses awaiting review" width={640} onClose={() => setRequestsOpen(false)}>
        {pendingQuery.isFetching ? <DriverTableLoading columns={3} label="Loading exporter license requests" /> : pendingQuery.error ? <Banner tone="danger" action={<Button variant="outline" onClick={pendingQuery.refetch}>Retry</Button>}>{forwarderError(pendingQuery.error)}</Banner> : !pendingLicenses.length ? <EmptyState title="No pending exporter licenses" description="Submitted licenses awaiting review will appear here." /> : pendingLicenses.map((row) => <div key={row.id} className="fd-row"><span style={{ flex: 1 }}>{row.name}<small className="tk-meta" style={{ display: 'block' }}>{row.submitted}</small></span><Button variant="outline" onClick={() => { setRequestsOpen(false); setAction({ kind: 'review', forwarder: row }); }}>Review</Button></div>)}
      </Modal>
      {addOpen && <ForwarderProfileModal onClose={() => setAddOpen(false)} onDone={(text, tone = 'success') => setNotice({ tone, text })} />}
      {bulkOpen && <ForwarderBulkVerifyModal forwarders={FORWARDERS} onClose={() => setBulkOpen(false)} onDone={(text, tone = 'success') => setNotice({ tone, text })} />}
      {action && <ForwarderActionModal key={`${action.kind}:${action.forwarder.id}`} action={action} onClose={() => setAction(null)} onDone={(text) => setNotice({ tone: 'success', text })} />}
      {announcement && <ForwarderAnnouncementModal onClose={() => setAnnouncement(false)} onDone={(text) => setNotice({ tone: 'success', text })} />}
    </>
  );
}
