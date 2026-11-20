"use client";
import { ToastRelay } from '../components/ActionToast.jsx';
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';

import { ViewToggle, TableToolbar } from '../ds.js';

import { usePageSearchState } from '../components/PageSearch.jsx';
import { DateRangeFilter, rangeParams } from '../components/DateRangeFilter.jsx';

// Bids always load for a date range; the default is the current Monday–Sunday week in Lagos.
function currentWeek() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const day = new Date(today + 'T00:00:00Z'), monday = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * 86400000);
  return { from: monday.toISOString().slice(0, 10), to: new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10) };
}


import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  DropdownMenu,
  FilterSelect,
  Icon,
  Modal,
  PageHeader,
  Pagination,
  SearchField,
  Skeleton,
  Sparkline,
  TextField,
  StatsPanel,
} from "../ds.js";
import { DEFAULT_STATS_PERIOD, statsPeriodRange } from '../domain/statsPeriod.js';
import { DriverLoadingNotice } from "./DriversLoading.jsx";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { selectBidScreenRows, useGetAdminBidScreenDirectoryQuery, useGetAdminBidScreenAnalyticsQuery, useGetAdminBidScreenOfferQuery } from "../store/features/bids/bidScreenApi.js";
import { useGetAdminJobBidActionDetailQuery, usePerformAdminJobActionMutation } from "../store/features/jobs/jobDetailApi.js";
import "./Operations.css";

const tones = { "Pending Evaluation":"warning", "Bid Accepted":"success", "In Transit":"info", "At Delivery":"orange", "Returning Container":"teal", Bidding:"purple", Completed:"success", Expired:"danger", Cancelled:"neutral" };
const STATUSES = ["Pending Evaluation","Bid Accepted","In Transit","At Delivery","Returning Container","Bidding","Completed","Expired","Cancelled"];
function Metric({ label, metric, comparison, icon, color = "#4c16ac" }) {
  return <Card className="metric-card">
    <label>{label}</label><strong>{metric?.value ?? "—"}</strong>
    <span className={"delta " + (metric?.direction === "DOWN" ? "down" : "")}>
      {metric?.direction ? (metric.direction === "DOWN" ? "↓ " : metric.direction === "UP" ? "↑ " : "") + metric.delta : "—"}
    </span>
    <small>{comparison && comparison !== "—" ? "vs " + comparison : "—"}</small>
    <i className="metric-icon" style={{ color, background: color + "12" }}><Icon name={icon} size={20} /></i>
    <Sparkline points={metric?.sparkline || []} color={color} />
  </Card>;
}
function BidScreenMenu({ anchor, items, onClose }) {
  const ref = useRef(null), [position,setPosition] = useState(null);
  useEffect(() => {
    const update = () => {
      if (!anchor?.isConnected || !ref.current) { onClose(null); return; }
      const a=anchor.getBoundingClientRect(),m=ref.current.getBoundingClientRect();
      setPosition({ left:Math.max(8,Math.min(a.right-m.width,window.innerWidth-m.width-8)),
        top:a.bottom+6+m.height<=window.innerHeight-8?a.bottom+6:Math.max(8,a.top-m.height-6) });
    };
    const outside=(e)=>{if(!anchor?.contains(e.target)&&!ref.current?.contains(e.target))onClose(null);};
    const escape=(e)=>{if(e.key==="Escape")onClose(null);};
    update(); window.addEventListener("scroll",update,true); window.addEventListener("resize",update);
    document.addEventListener("pointerdown",outside); document.addEventListener("keydown",escape);
    return ()=>{window.removeEventListener("scroll",update,true);window.removeEventListener("resize",update);document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[anchor,items.length,onClose]);
  return <div ref={ref} style={{position:"fixed",zIndex:95,top:position?.top??-10000,left:position?.left??0,visibility:position?"visible":"hidden"}}>
    <DropdownMenu width={210} items={items} style={{maxHeight:"calc(100vh - 16px)",overflowY:"auto"}} />
  </div>;
}

function BidsLoading() {
  return (
    <div className="operations-screen" aria-busy="true">
      <Card><Skeleton width={220} height={28} /><div style={{ marginTop: 12 }}><Skeleton width={420} height={14} /></div></Card>
      <div className="kpi-grid">
        {Array.from({ length: 6 }, (_, index) => <Card className="metric-card" key={index}><Skeleton width="46%" height={12} /><div style={{ marginTop: 14 }}><Skeleton width={72} height={27} /></div></Card>)}
      </div>
      <Card><Skeleton height={300} /></Card>
    </div>
  );
}

function BidsTableLoading({ columns }) {
  const rows = Array.from({ length: 6 }, (_, index) => ({ id: `loading-${index}` }));
  const loadingColumns = columns.map((column, index) => ({
    ...column,
    render: () => <Skeleton width={index === 3 ? "76%" : "62%"} height={12} />,
  }));

  return (
    <div role="status" aria-label="Loading bids" aria-busy="true">
      <DataTable rows={rows} rowKey={(row) => row.id} columns={loadingColumns} />
      <span className="tk-meta" style={{ display: "block", padding: "0 16px 12px" }}>Loading bids…</span>
    </div>
  );
}

function BidsMetricsLoading() {
  return (
    <div className="kpi-grid" role="status" aria-label="Loading bid stats" aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <Card className="metric-card" key={index}>
          <Skeleton width="46%" height={12} />
          <div style={{ marginTop: 14 }}><Skeleton width={72} height={27} /></div>
          <div style={{ marginTop: 8 }}><Skeleton width={38} height={12} /></div>
          <div style={{ marginTop: 8 }}><Skeleton width="64%" height={10} /></div>
        </Card>
      ))}
    </div>
  );
}


export function BidsOffers() {
  const owner=useSelector((s)=>s.auth.admin?.id),role=useSelector((s)=>s.auth.admin?.role);
  const authenticated=useSelector((s)=>Boolean(s.auth.accessToken&&s.auth.admin?.id));
  return <BidsOffersContent key={[owner,role,authenticated].join(":")} owner={owner} role={role} authenticated={authenticated}/>;
}
function BidsOffersContent({owner,role,authenticated}) {
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [tableView, setTableView] = useState('list');
  const navigate=useNavigate();
  const [bidType,setBidType]=useState("All Bids"),[page,setPage]=useState(1),[q,setQ]=usePageSearchState("", () => setPage(1));
  const [statusFilter,setStatusFilter]=useState("All Status"),[dateRange,setDateRange]=useState(currentWeek);
  const [menu,setMenu]=useState(null),[offerModal,setOfferModal]=useState(null),[toast,setToast]=useState(null),[offerError,setOfferError]=useState("");
  const [offerReason,setOfferReason]=useState("");
  const offerActionLock=useRef(false);
  const defaultWeek=useMemo(currentWeek,[]),isDefaultRange=dateRange.from===defaultWeek.from&&dateRange.to===defaultWeek.to;
  const session={owner,role},dates=useMemo(()=>rangeParams(dateRange),[dateRange]);
  const directoryQuery=useGetAdminBidScreenDirectoryQuery(session,{skip:!authenticated,refetchOnMountOrArgChange:true});
  const [statsPeriodKey,setStatsPeriodKey]=useState(DEFAULT_STATS_PERIOD);
  const statsRange=useMemo(()=>statsPeriodRange(statsPeriodKey),[statsPeriodKey]);
  const analyticsQuery=useGetAdminBidScreenAnalyticsQuery({...session,...statsRange},{skip:!authenticated,refetchOnMountOrArgChange:true});
  const offerQuery=useGetAdminBidScreenOfferQuery({...session,id:offerModal?.bidId},{skip:!authenticated||!offerModal?.bidId,refetchOnMountOrArgChange:true});
  const actionDetail=useGetAdminJobBidActionDetailQuery({...session,id:offerModal?.bidId,jobId:offerModal?.jobId},{skip:!authenticated||!offerModal?.bidId||!offerModal?.jobId,refetchOnMountOrArgChange:true});
  const [performAdminAction,{isLoading:acting}]=usePerformAdminJobActionMutation();
  const data=directoryQuery.error?null:directoryQuery.currentData;
  const analytics=analyticsQuery.error?null:analyticsQuery.currentData;
  const analyticsLoading=authenticated&&analyticsQuery.isFetching&&!analytics;
  const selectedOffer=offerQuery.error?null:offerQuery.currentData;
  const selection=useMemo(()=>selectBidScreenRows(data,{tab:bidType === "Counter Offers" ? "Counter Offers" : "Bid Overview",query:q,statusFilter,...dates}),[data,bidType,q,statusFilter,dates.dateFrom,dates.dateTo]);
  const isCounterOfferView=bidType === "Counter Offers";
  const pageRows=isCounterOfferView && statusFilter !== "All Status" ? selection.rows.filter((row) => row.statusCode === statusFilter.toUpperCase().replaceAll(" ", "_")) : selection.rows;
  const pageCount=Math.max(1,Math.ceil(pageRows.length/8));
  const overviewKnown=Boolean(data?.overviewKnown),rowsKnown=Boolean(data&&(isCounterOfferView?data.offersKnown:overviewKnown));
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),2600);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{setPage(1);},[bidType,q,statusFilter,dateRange]);
  useEffect(()=>{if(page>pageCount)setPage(pageCount);},[page,pageCount]);
  function openMenu(event,key){const anchor=event.currentTarget;setMenu((previous)=>previous?.key===key?null:{key,anchor});}
  const menuItems=menu?.key === "type" ? ["All Bids", "Counter Offers"].map((value) => ({label:value,icon:value===bidType?"check":undefined,onClick:()=>{setBidType(value);setStatusFilter("All Status");setPage(1);setMenu(null);}}))
    :["All Status",...(isCounterOfferView ? ["Pending", "Accepted", "Rejected", "Expired", "Withdrawn"] : STATUSES)].map((s)=>({label:s,icon:s===statusFilter?"check":undefined,onClick:()=>{setStatusFilter(s);setPage(1);setMenu(null);}}));
  function viewJob(row){if(row.jobId)navigate("/jobs/detail?id="+encodeURIComponent(row.jobId));else setToast({tone:"info",title:"Job details are unavailable."});}
  async function resolveOffer(offer,accept){
    if (!offerModal || offerModal.bidId !== offer?.bidId) { openOffer(offer); return; }
    if (!accept) { setOfferError("The API does not support declining counteroffers."); return; }
    if (acting || offerActionLock.current || offerReason.trim().length < 3 || actionDetail.currentData?.canAccept !== true || !actionDetail.currentData?.version) return;
    offerActionLock.current=true;
    try {
      await performAdminAction({id:offer.jobId,owner,role,action:"acceptBid",bidId:offer.bidId,expectedVersion:actionDetail.currentData.version,reason:offerReason}).unwrap();
      setOfferModal(null);setOfferReason("");setToast({tone:"success",title:"Offer accepted."});
    } catch(error) {
      const shortfall=error?.data?.shortfall;
      setOfferError(error?.status===402&&shortfall!=null&&shortfall!==""&&Number.isFinite(Number(shortfall))&&Number(shortfall)>=0 ? "Insufficient funds. Shortfall: ₦"+Number(shortfall).toLocaleString("en-NG") : getApiErrorMessage(error));
    } finally { offerActionLock.current=false; }
  }
  function openOffer(row){setOfferError("");setOfferReason("");setOfferModal(row);setMenu(null);}

  function exportRows(){
    if(!rowsKnown)return;
    const header=isCounterOfferView?["Job ID","Bidding Company","Offer Amount (₦)","Δ vs Lowest"]:["Job ID","Route","Customer","Bids","Lowest Bid (₦)","Winning Bid (₦)","Status","Created At","Time"];
    const rows=pageRows.map((r)=>isCounterOfferView?[r.id,r.company,r.amountValue??"—",r.deltaValue??"—"]:[r.id,r.route,r.customer,r.bids,r.lowValue??"—",r.winValue??"—",r.status,r.date,r.time]);
    const cell=(v)=>{const s=String(v??"");return '"'+(/^[=+\-@\t\r]/.test(s)?"'":"")+s.replaceAll('"','""')+'"';};
    const csv=[header,...rows].map((r)=>r.map(cell).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");
    link.href=url;link.download="trukkas-bids-"+dateRange.from+"_"+dateRange.to+".csv";document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),0);
    setToast({tone:"success",title:pageRows.length+" record(s) exported."});
  }
  const cols = [
    {
      key: "id",
      header: "Job ID",
      render: (r) => <a onClick={() => viewJob(r)}>{r.id}</a>,
    },
    { key: "route", header: "Route" },
    { key: "customer", header: "Customer" },
    { key: "bids", header: "Bids" },
    { key: "low", header: "Lowest Bid (₦)" },
    { key: "win", header: "Winning Bid (₦)" },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge tone={tones[r.status]} dot>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "date",
      header: "Created At",
      render: (r) => (
        <span className="cell-two">
          <strong>{r.date}</strong>
          <small>{r.time}</small>
        </span>
      ),
    }
  ];
  const offerCols = [
    {
      key: "id",
      header: "Job ID",
      width: "120px",
      render: (r) => <a onClick={() => viewJob(r)}>{r.id}</a>,
    },
    { key: "company", header: "Bidding Company" },
    { key: "amount", header: "Offer Amount (₦)" },
    {
      key: "delta",
      header: "Δ vs Lowest",
      render: (r) => (
        <span style={{ color: "var(--tk-success)" }}>{r.delta}</span>
      ),
    },
    {
      key: "a",
      header: "Actions",
      render: (r) => (
        <span style={{ display: "flex", gap: 6 }}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolveOffer(r, true)}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled
          >
            Decline
          </Button>
        </span>
      ),
    },
  ];

  if (authenticated && directoryQuery.isFetching && !data) return <BidsLoading />;

  return (
    <div className="operations-screen">
      <PageHeader
        crumbs={["Jobs & Trips", "Bids & Offers"]}
        title="Bids & Offers"
        description="Manage all bid submissions and counter offers across Trukkas."
      />

      {toast && <ToastRelay message={toast.title} tone={toast.tone} onShown={() => setToast(null)}><Banner tone={toast.tone} title={toast.title} /></ToastRelay>}
      {directoryQuery.error && <Banner tone="danger" title={getApiErrorMessage(directoryQuery.error)} action={<Button size="sm" variant="outline" onClick={directoryQuery.refetch}>Retry</Button>} />}
      {data?.errors.length > 0 && <Banner tone="warning" title={"Unable to load: " + data.errors.join(", ") + "."} action={<Button size="sm" variant="outline" onClick={directoryQuery.refetch}>Retry</Button>} />}
      {analyticsQuery.error && <Banner tone="warning" title="Bid stats are temporarily unavailable." action={<Button size="sm" variant="outline" onClick={analyticsQuery.refetch}>Retry stats</Button>} />}

      {analyticsLoading ? <BidsMetricsLoading /> : <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey}>
        <Metric
          label="Total Bids" metric={analytics?.metrics.totalBids} comparison={analytics?.comparison}
          icon="briefcase-business"
        />
        <Metric
          label="Pending Evaluation" metric={analytics?.metrics.pendingBids} comparison={analytics?.comparison}
          icon="hand-coins"
          color="#f27602"
        />
        <Metric
          label="Counter Offers" metric={analytics?.metrics.counterOffers} comparison={analytics?.comparison}
          icon="users-round"
          color="#2469e8"
        />
        <Metric
          label="Accepted Bids" metric={analytics?.metrics.acceptedBids} comparison={analytics?.comparison}
          icon="badge-check"
          color="#12a150"
        />
        <Metric
          label="Expired Offers" metric={analytics?.metrics.expiredBids} comparison={analytics?.comparison}
          icon="trophy"
          color="#e02b22"
        />
        <Metric
          label="Avg. Winning Margin" metric={analytics?.metrics.margin} comparison={analytics?.comparison}
          icon="badge-percent"
        />
      </StatsPanel>}



      <div className="ops-panel">
          <TableToolbar
            search={<SearchField placeholder="Search by Job ID, Company, Truck, Driver..." value={q} onChange={(event) => setQ(event.target.value)} />}
            filters={<>
              <FilterSelect prefix="Status" icon="circle-dot" label={statusFilter} active={statusFilter !== 'All Status'} onClick={(event) => openMenu(event, 'status')} onClear={() => setStatusFilter('All Status')} />
              <FilterSelect prefix="Type" icon="layers" label={bidType} active={bidType !== 'All Bids'} onClick={(event) => openMenu(event, 'type')} onClear={() => { setBidType('All Bids'); setStatusFilter('All Status'); }} />
              <DateRangeFilter value={dateRange} required onChange={(next) => { setDateRange(next); setPage(1); setMenu(null); }} />
            </>}
            viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
            trailing={<Button variant="outline" icon="download" disabled={!rowsKnown || !pageRows.length} onClick={exportRows}>Export</Button>}
            onClear={q || statusFilter !== 'All Status' || bidType !== 'All Bids' || !isDefaultRange ? () => { setQ(''); setStatusFilter('All Status'); setBidType('All Bids'); setDateRange(defaultWeek); setPage(1); setMenu(null); } : undefined}
          />
          {directoryQuery.isFetching ? <BidsTableLoading columns={isCounterOfferView ? offerCols : cols} /> : !rowsKnown ? <DriverLoadingNotice>—</DriverLoadingNotice> : isCounterOfferView ? (
            <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.offers} boardOnRowClick={openOffer} view={tableView} boardGroupBy={(row) => row.statusCode}
              rows={pageRows.slice((page - 1) * 8, page * 8)}
              rowKey={(r) => r.bidId}
              columns={offerCols}
            />
          ) : pageRows.length === 0 && tableView !== 'board' ? (
            <div
              style={{ padding: "40px 18px", textAlign: "center" }}
              className="tk-meta"
            >
              No bids match the current filters.
            </div>
          ) : (
            <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.bids} boardOnRowClick={viewJob} view={tableView} boardGroupBy={(row) => row.status}
              rows={pageRows.slice((page - 1) * 8, page * 8)}
              columns={cols}
            />
          )}
          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={8}
            total={rowsKnown ? pageRows.length : "—"}
            onPage={(next) => { if (Number.isInteger(next) && next >= 1 && next <= pageCount) setPage(next); }}
            onPageSize={() => {}}
          />
        </div>



      {menu && <BidScreenMenu anchor={menu.anchor} items={menuItems} onClose={setMenu} />}

      <Modal
        open={!!offerModal}
        onClose={() => { if (!acting) { setOfferModal(null); setOfferError(""); } }}
        title="Counter Offer"
        description={
          offerModal ? `${offerModal.company} · ${offerModal.id}` : ""
        }
        footer={
          offerModal && (
            <>
              <Button
                variant="outline"
                disabled
                onClick={() => resolveOffer(selectedOffer, false)}
              >
                Decline
              </Button>
              <Button
                icon="check"
                disabled={acting || !selectedOffer || selectedOffer.statusCode !== "PENDING" || offerQuery.isFetching || actionDetail.isFetching || actionDetail.currentData?.canAccept !== true || !actionDetail.currentData?.version || offerReason.trim().length < 3 || !["SUPER_ADMIN","OPS_ADMIN"].includes(role)}
                onClick={() => resolveOffer(selectedOffer, true)}
              >
                Accept Offer
              </Button>
            </>
          )
        }
      >
        {offerQuery.isFetching && !selectedOffer && <Skeleton height={80} />}
        {offerQuery.error && <Banner tone="danger" title={getApiErrorMessage(offerQuery.error)} action={<Button size="sm" variant="outline" onClick={offerQuery.refetch}>Retry</Button>} />}
        {offerError && <Banner tone="info" title={offerError} />}
        {offerModal && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="trip-fact">
              <span>Offer Amount</span>
              <b>{selectedOffer?.amount ?? "—"}</b>
            </div>
            <div className="trip-fact">
              <span>Δ vs Lowest Bid</span>
              <b style={{ color: "var(--tk-success)" }}>{selectedOffer?.delta ?? "—"}</b>
            </div>
            <span className="tk-meta">
              Accepting charges the forwarder's wallet for the agreed price, terminal handling and platform fee into escrow, and declines other pending bids.
            </span>
            <TextField label="Reason" required maxLength={500} value={offerReason} onChange={(event)=>setOfferReason(event.target.value)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
