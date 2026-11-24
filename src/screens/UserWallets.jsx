"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  Button,
  DataTable,
  DrawerSection,
  Icon,
  PageHeader,
  Pagination,
  SearchField,
  SectionCard,
  SideDrawer,
  Skeleton,
  TableToolbar,
  Tabs,
  TK_STATUS,
  Tooltip,
} from "../ds.js";
import { CustomSelect } from "../ds/components/forms/Select.jsx";
import { usePageSearchState } from "../components/PageSearch.jsx";
import { DriverLoadingNotice, DriverTableLoading } from "./DriversLoading.jsx";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { formatNaira } from "../mock/format.js";
import {
  WALLET_PAGE_SIZE,
  WALLET_ROLES,
  useGetAdminUserWalletPayoutsQuery,
  useGetAdminUserWalletTransactionsQuery,
  useGetAdminUserWalletsQuery,
} from "../store/features/wallets/userWalletsApi.js";
import styles from "./UserWallets.module.css";

const isNum = (value) => typeof value === "number" && Number.isFinite(value);
const naira = (value) => (isNum(value) ? formatNaira(value) : "—");
const statusTone = (status) => TK_STATUS[status] || { Suspended: "danger", Banned: "danger", "Pending Review": "warning", "Pending Profile": "warning" }[status] || "neutral";
const TX_TONE = { Completed: "success", Successful: "success", Pending: "warning", Processing: "warning", Failed: "danger", Reversed: "neutral" };

export function UserWallets() {
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const [role, setRole] = useState("FORWARDER");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [q, setQ] = usePageSearchState("", () => setPage(1));
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);

  const query = useGetAdminUserWalletsQuery({ role, status, search, page }, { skip: !authenticated || search !== q.trim() });
  const data = authenticated && !query.error ? query.currentData : null;
  const rows = data?.rows || [];
  const loading = authenticated && (query.isFetching || search !== q.trim());
  const pages = data?.pages ?? null;
  useEffect(() => { if (pages != null && pages > 0 && page > pages) setPage(pages); }, [page, pages]);

  const visible = loading ? [] : rows;
  const pageBalance = visible.length && visible.every((row) => isNum(row.balance)) ? visible.reduce((total, row) => total + row.balance, 0) : null;
  const funded = visible.filter((row) => isNum(row.balance) && row.balance > 0).length;
  const roleMeta = WALLET_ROLES.find((item) => item.value === role);
  const filtered = Boolean(q.trim()) || status !== "All";

  const columns = [
    {
      key: "name", header: roleMeta.single,
      render: (r) => (
        <span className={styles.person}>
          <Avatar name={r.name === "—" ? "?" : r.name} size={32} />
          <span className={styles.personText}>
            <strong>{r.name}</strong>
            <small>{r.email ?? r.phone ?? "—"}</small>
          </span>
        </span>
      ),
    },
    { key: "status", header: "Account", render: (r) => <Badge tone={statusTone(r.status)} dot>{r.status}</Badge> },
    {
      key: role === "FORWARDER" ? "spent" : "earned",
      header: role === "FORWARDER" ? "Total Spent" : "Total Earned",
      align: "right",
      render: (r) => <span className={styles.money}>{naira(role === "FORWARDER" ? r.spent : r.earned)}</span>,
    },
    {
      key: "balance", header: "Wallet Balance", align: "right",
      render: (r) => r.walletError
        ? <Tooltip label="This wallet couldn’t be loaded. Open it to try again."><span className={styles.muted}>—</span></Tooltip>
        : <span className={styles.balance} data-zero={r.balance === 0 || undefined}>{naira(r.balance)}</span>,
    },
    { key: "joined", header: "Joined", render: (r) => <span className={styles.muted}>{r.joined}</span> },
    { key: "open", header: "", width: 40, align: "right", render: () => <Icon name="chevron-right" size={16} color="var(--tk-ink-300)" /> },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        crumbs={["Finance", "Wallets"]}
        title="Wallets"
        description="Trukkas wallet balances and activity for forwarders, truck companies and individual drivers. Company drivers are paid through their company’s wallet."
      />

      <SectionCard title="" pad="none">
        <div className={styles.tabs}>
          <Tabs
            value={role}
            onChange={(value) => { setRole(value); setPage(1); setOpen(null); }}
            items={WALLET_ROLES.map((item) => ({ value: item.value, label: item.label, count: item.value === role && data?.total != null ? data.total : undefined }))}
          />
        </div>
        <TableToolbar
          search={<SearchField style={{ flex: 1 }} placeholder={`Search ${roleMeta.label.toLowerCase()} by name, email or business...`} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
          filters={
            <>
              <CustomSelect aria-label="Account status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="All">All accounts</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </CustomSelect>
              {filtered && <Button variant="outline" icon="rotate-ccw" onClick={() => { setQ(""); setStatus("All"); setPage(1); }}>Reset</Button>}
            </>
          }
        />
        {visible.length > 0 && (
          <div className={styles.pageSummary}>
            <span><Icon name="wallet" size={14} />Balances on this page <strong>{naira(pageBalance)}</strong></span>
            <span>{funded} of {visible.length} wallets have funds</span>
          </div>
        )}
        <DataTable rows={visible} rowKey={(r) => r.id} onRowClick={(r) => setOpen(r)} columns={columns} />
        {loading && <DriverTableLoading columns={5} label="Loading wallets" />}
        {!loading && !rows.length && (
          <div className={styles.emptyTable}>
            {query.error ? (
              <DriverLoadingNotice>{getApiErrorMessage(query.error)}</DriverLoadingNotice>
            ) : !authenticated || !data ? "—" : (
              <>
                <Icon name="wallet" size={22} />
                <strong>{filtered ? `No ${roleMeta.label.toLowerCase()} match these filters` : `No ${roleMeta.label.toLowerCase()} yet`}</strong>
                <span>{filtered ? "Try another name or clear the filters." : "Wallets appear here as users sign up."}</span>
              </>
            )}
          </div>
        )}
        <Pagination page={page} pageCount={pages} pageSize={WALLET_PAGE_SIZE} total={data?.total ?? null} onPage={(p) => { if (pages != null && !loading) setPage(Math.min(Math.max(1, p), pages)); }} />
      </SectionCard>

      {open && <WalletDrawer wallet={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function WalletDrawer({ wallet, onClose }) {
  const navigate = useNavigate();
  const [txPage, setTxPage] = useState(1);
  const txQuery = useGetAdminUserWalletTransactionsQuery({ id: wallet.id, page: txPage });
  const payoutQuery = useGetAdminUserWalletPayoutsQuery(wallet.id);
  const tx = txQuery.currentData;
  const payouts = payoutQuery.currentData;
  const forwarder = wallet.roleCode === "FORWARDER";

  return (
    <SideDrawer
      label="Wallet details"
      eyebrow={`${wallet.role} wallet`}
      title={wallet.name}
      meta={<Badge tone={statusTone(wallet.status)} dot>{wallet.status}</Badge>}
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button icon="user-round" onClick={() => navigate(wallet.profileRoute)}>Open {wallet.role.toLowerCase()} profile</Button>
          <Tooltip label="Needs admin access to the bank list and account-name check before money can be sent safely.">
            <span style={{ display: "grid", width: "100%" }}><Button variant="outline" icon="landmark" disabled fullWidth>Pay out to bank</Button></span>
          </Tooltip>
        </>
      }
    >
      <div className={styles.balanceCard}>
        <span className={styles.balanceLabel}><Icon name="wallet" size={15} />Available balance</span>
        <strong>{wallet.walletError ? "—" : naira(wallet.balance)}</strong>
        <div className={styles.balanceFacts}>
          <div><span>{forwarder ? "Total spent" : "Total earned"}</span><b>{naira(forwarder ? wallet.spent : wallet.earned)}</b></div>
          <div><span>Member since</span><b>{wallet.joined}</b></div>
        </div>
      </div>

      <DrawerSection title={`Wallet activity${tx?.total != null ? ` · ${tx.total}` : ""}`}>
        {txQuery.isFetching && !tx ? (
          <div className={styles.skeletonList}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={38} radius={8} />)}</div>
        ) : txQuery.error ? (
          <DriverLoadingNotice>{getApiErrorMessage(txQuery.error)}</DriverLoadingNotice>
        ) : tx?.rows.length ? (
          <>
            <ul className={styles.txList}>
              {tx.rows.map((row) => (
                <li key={row.id}>
                  <span className={styles.txIcon}><Icon name={txIcon(row.typeCode)} size={15} /></span>
                  <span className={styles.txMain}>
                    <strong>{row.label}</strong>
                    <small>{row.type} · {row.date}, {row.time}</small>
                  </span>
                  <span className={styles.txSide}>
                    <b>{naira(row.amount)}</b>
                    <Badge tone={TX_TONE[row.status] || "neutral"}>{row.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
            {tx.pages > 1 && (
              <div className={styles.txPager}>
                <Button variant="ghost" size="sm" icon="chevron-left" disabled={txPage <= 1 || txQuery.isFetching} onClick={() => setTxPage(txPage - 1)}>Newer</Button>
                <span>Page {txPage} of {tx.pages}</span>
                <Button variant="ghost" size="sm" iconRight="chevron-right" disabled={txPage >= tx.pages || txQuery.isFetching} onClick={() => setTxPage(txPage + 1)}>Older</Button>
              </div>
            )}
          </>
        ) : (
          <p className={styles.emptySmall}>No wallet transactions yet.</p>
        )}
      </DrawerSection>

      <DrawerSection title="Payouts by admins">
        {payoutQuery.isFetching && !payouts ? (
          <Skeleton height={38} radius={8} />
        ) : payoutQuery.error ? (
          <DriverLoadingNotice>{getApiErrorMessage(payoutQuery.error)}</DriverLoadingNotice>
        ) : payouts?.length ? (
          <ul className={styles.txList}>
            {payouts.map((row) => (
              <li key={row.id}>
                <span className={styles.txIcon}><Icon name="landmark" size={15} /></span>
                <span className={styles.txMain}>
                  <strong>To account {row.account}</strong>
                  <small>By {row.admin} · {row.date}, {row.time}{row.note ? ` · ${row.note}` : ""}</small>
                </span>
                <span className={styles.txSide}>
                  <b>{naira(row.amount)}</b>
                  <Badge tone={TX_TONE[row.status] || "neutral"}>{row.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptySmall}>No admin payouts from this wallet.</p>
        )}
      </DrawerSection>
    </SideDrawer>
  );
}

function txIcon(type) {
  if (!type) return "arrow-left-right";
  if (/WITHDRAW|PAYOUT/.test(type)) return "arrow-up-right";
  if (/DEPOSIT|FUND/.test(type)) return "arrow-down-left";
  if (/ESCROW/.test(type)) return "lock";
  if (/REFUND|REVERS/.test(type)) return "undo-2";
  if (/DEMURRAGE/.test(type)) return "hourglass";
  if (/FEE|COMMISSION/.test(type)) return "percent";
  return "arrow-left-right";
}
