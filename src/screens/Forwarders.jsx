"use client";
import { ToastRelay } from '../components/ActionToast.jsx';
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';
import { DateRangeFilter, EMPTY_RANGE, inRange } from '../components/DateRangeFilter.jsx';

import { ViewToggle } from '../ds.js';

import { usePageSearchState } from '../components/PageSearch.jsx';


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
  DropdownMenu,
  Icon,
  IconButton,
  Avatar,
  Banner,
  SideDrawer,
  DrawerSection,
  DrawerFacts,
  Skeleton,
  EmptyState,
  StatsPanel,
} from "../ds.js";

import { forwarderMoney, forwarderError, useGetAdminForwarderDirectoryQuery, useGetAdminForwarderStatsQuery, useGetAdminForwarderJobsQuery, useGetAdminPendingExporterLicensesQuery } from '../store/features/forwarders/forwardersApi.js';
import { cityOptions, sameCity } from '../store/api/addressCity.js';
import { ForwardersLoading } from './ForwardersLoading.jsx';
import { DriverLoadingNotice } from './DriversLoading.jsx';
import { ForwarderActionModal, ForwarderAnnouncementModal, downloadForwarderCsv } from './ForwarderActions.jsx';
import { ForwarderActivity } from './ForwarderShared.jsx';
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
    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <Avatar name={f.name} size={32} />
      <span style={{ font: "600 13px/18px var(--tk-font-sans)", color: "var(--tk-ink-900)", minWidth: 0, overflowWrap: "anywhere" }}>
        {f.name}
      </span>
    </span>
  );
}

function ForwarderDrawer({ forwarder: f, owner, authenticated, onClose, onOpen, onAction, onAnnounce }) {
  const jobsQuery = useGetAdminForwarderJobsQuery({ id: f.id, owner, tab: 'all', page: 1, limit: 4 }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const pendingQuery = useGetAdminPendingExporterLicensesQuery(owner, { skip: !authenticated });
  const pendingLicense = pendingQuery.error ? null : pendingQuery.currentData?.rows.find((row) => row.id === f.id);
  const jobs = jobsQuery.error ? [] : jobsQuery.currentData?.rows || [];
  const suspended = f.statusCode === 'SUSPENDED';
  return (
    <SideDrawer
      label="Forwarder details"
      eyebrow="Forwarder"
      onClose={onClose}
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}><Avatar name={f.name} size={40} /><h2 className="tk-title" style={{ fontSize: 20, overflowWrap: 'anywhere' }}>{f.name}</h2></span>}
      meta={<>
        <Badge tone={STATUS_TONE[f.status] || 'neutral'} dot>{f.status}</Badge>
        <Badge tone={VERIFICATION_META[f.verification]?.tone || 'neutral'}><Icon name={VERIFICATION_META[f.verification]?.icon || 'info'} size={11} />{f.verification}</Badge>
      </>}
      headerActions={<IconButton icon="maximize-2" label="Open full page" onClick={onOpen} />}
      footer={<>
        {pendingLicense && <div className="tk-drawer-footer-row"><Button icon="badge-check" onClick={() => onAction({ kind: 'review', forwarder: { ...pendingLicense, name: f.name } })}>Review License</Button></div>}
        <div className="tk-drawer-footer-row">
          <Button variant="outline" icon="megaphone" onClick={onAnnounce}>Message</Button>
          {suspended
            ? <Button variant="outline" icon="circle-check" onClick={() => onAction({ kind: 'activate', forwarder: f })}>Reactivate</Button>
            : <Button variant="danger" icon="ban" onClick={() => onAction({ kind: 'suspend', forwarder: f })}>Suspend</Button>}
          <Button iconRight="maximize-2" onClick={onOpen}>Open Full Page</Button>
        </div>
      </>}
    >
      <DrawerSection title="Contact">
        <DrawerFacts items={[
          { label: 'Email', value: f.email, wide: true },
          { label: 'Phone', value: f.phone },
          { label: 'Location', value: f.location },
          { label: 'Joined', value: f.joined },
        ]} />
      </DrawerSection>

      <DrawerSection title="At a glance">
        <DrawerFacts items={[
          { label: 'Total jobs', value: f.jobs ?? '—' },
          { label: 'Total spend', value: naira(f.spend) },
        ]} />
      </DrawerSection>

      <DrawerSection title="Latest activity">
        {jobsQuery.isFetching && !jobsQuery.currentData ? <Skeleton height={120} />
          : jobsQuery.error ? <Banner tone="warning" title="Unable to load recent jobs." action={<Button size="sm" variant="outline" onClick={jobsQuery.refetch}>Retry</Button>} />
          : <ForwarderActivity jobs={jobs} />}
      </DrawerSection>
    </SideDrawer>
  );
}

export function Forwarders() {
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [tableView, setTableView] = useState('list');
  const navigate = useNavigate();
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const owner = useSelector(state => state.auth.admin?.id);
  const directoryQuery = useGetAdminForwarderDirectoryQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const statsQuery = useGetAdminForwarderStatsQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const FORWARDERS = directoryQuery.error ? [] : directoryQuery.currentData || [];
  const [notice, setNotice] = useState(null), [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState(null), [action, setAction] = useState(null), [announceFor, setAnnounceFor] = useState(null);
  const openFull = (id) => navigate(`/forwarders/detail?id=${encodeURIComponent(id)}`);
  const summary = statsQuery.error ? null : statsQuery.currentData;
  const STATS = { total: summary?.total ?? '—', active: summary?.active ?? '—', suspended: summary?.suspended ?? '—', pending: summary?.pending ?? '—', totalSpend: summary?.totalSpend ?? null };
  useEffect(() => { if (statsQuery.error) setNotice({ tone: 'danger', text: forwarderError(statsQuery.error) }); }, [statsQuery.error]);

  const [page, setPage] = useState(1);
  const [q, setQ] = usePageSearchState("", () => setPage(1));
  const [status, setStatus] = useState("All Status");
  const [verification, setVerification] = useState("All Verification Status");
  const [location, setLocation] = useState("All Locations");
  const [joined, setJoined] = useState(EMPTY_RANGE);
  const [openFilter, setOpenFilter] = useState(null);

  const locations = useMemo(
    () => cityOptions(FORWARDERS),
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
          location === "All Locations" || sameCity(f.city, location);
        return matchesQ && matchesStatus && matchesVerification && matchesLocation && inRange(f.joinedAt, joined);
      }),
    [directoryQuery.currentData, directoryQuery.error, q, status, verification, location, joined],
  );

  useEffect(() => { setPage(1); }, [q, status, verification, location, pageSize]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  function exportList() {
    downloadForwarderCsv('forwarders.csv', [['ID', 'Name', 'Status', 'Email', 'Phone', 'Location', 'Verification', 'Total Jobs', 'Total Spend (NGN)', 'Joined'], ...filtered.map((row) => [row.id, row.name, row.status, row.email, row.phone, row.location, row.verification, row.jobs, row.spend, row.joined])]);
  }
  const selected = selectedId ? FORWARDERS.find((f) => f.id === selectedId) : null;
  if (!directoryQuery.currentData && directoryQuery.isFetching) return <ForwardersLoading />;
  return (
    <>
      <PageHeader
        crumbs={["Users", "Forwarders"]}
        title="Forwarders"
        description="Freight forwarders who post jobs on Trukkas."
      />

      {notice && <ToastRelay message={notice.text} tone={notice.tone} onShown={() => setNotice(null)}><Banner tone={notice.tone} action={<Button variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice.text}</Banner></ToastRelay>}
      {directoryQuery.error && <Banner tone="danger" title="Unable to load forwarders" action={<Button variant="outline" onClick={directoryQuery.refetch}>Retry</Button>}>{forwarderError(directoryQuery.error)}</Banner>}
      {(directoryQuery.isFetching || statsQuery.isFetching) && <DriverLoadingNotice>Refreshing forwarders…</DriverLoadingNotice>}
      {FORWARDERS.some((row) => row.profileUnavailable) && <Banner tone="warning" action={<Button variant="outline" onClick={directoryQuery.refetch}>Retry</Button>}>Some profiles could not be loaded. Their joined dates and verification statuses are unavailable.</Banner>}
      <StatsPanel fixedLabel="All time" fixedHint="Forwarder totals cover all time; the forwarder stats API can’t be filtered by date yet.">
        <StatCard icon="users" label="Total Forwarders" value={STATS.total} />
        <StatCard icon="circle-check" tint="green" label="Active Forwarders" value={STATS.active} />
        <StatCard icon="hourglass" tint="amber" label="Pending Verification" value={STATS.pending} direction="down" />
        <StatCard icon="circle-x" tint="purple" label="Suspended" value={STATS.suspended} direction="down" />
        <StatCard icon="wallet" tint="blue" label="Total Spend" value={naira(STATS.totalSpend)} />
      </StatsPanel>

      <SectionCard pad="none">
        <TableToolbar viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
          search={
            <SearchField
              placeholder="Search forwarders…" title="Search by name, forwarder ID, email or phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          }
          filters={
            <>
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
                      zIndex: 'var(--tk-z-dropdown)',
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
                      zIndex: 'var(--tk-z-dropdown)',
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
                      zIndex: 'var(--tk-z-dropdown)',
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
              <DateRangeFilter name="Joined" value={joined} onChange={(next) => { setJoined(next); setPage(1); }} />
            </>
          }
          trailing={<Button variant="outline" icon="download" disabled={!directoryQuery.currentData || Boolean(directoryQuery.error)} onClick={exportList}>Export</Button>}
        />

        {directoryQuery.error ? <EmptyState icon="users" title="Forwarder list unavailable" description="Retry to load the directory." /> : !filtered.length && tableView !== 'board' ? <EmptyState icon="users" title="No forwarders found" description="Try different filters or search terms." /> : <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.forwarders} boardOnRowClick={(row) => setSelectedId(row.id)} onRowClick={(row) => setSelectedId(row.id)} view={tableView} boardGroupBy={(row) => row.status}
          rows={filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "name",
              header: "Forwarder",
              render: (r) => <ForwarderCell f={r} />,
            },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={STATUS_TONE[r.status] || "neutral"}>{r.status}</Badge>
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
      {selected && (
        <ForwarderDrawer
          key={selected.id}
          forwarder={selected}
          owner={owner}
          authenticated={authenticated}
          onClose={() => setSelectedId(null)}
          onOpen={() => openFull(selected.id)}
          onAction={setAction}
          onAnnounce={() => setAnnounceFor(selected)}
        />
      )}
      {action && <ForwarderActionModal key={`${action.kind}:${action.forwarder.id}`} action={action} onClose={() => setAction(null)} onDone={(text) => setNotice({ tone: 'success', text })} />}
      {announceFor && <ForwarderAnnouncementModal forwarder={announceFor} onClose={() => setAnnounceFor(null)} onDone={(text) => setNotice({ tone: 'success', text })} />}
    </>
  );
}
