"use client";
import { usePageSearchState } from '../components/PageSearch.jsx';


import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import { Badge, Banner, Button, Card, DataTable, DonutChart, DropdownMenu, Icon, Modal, PageHeader, Pagination, SearchField, Skeleton, Sparkline, Tabs } from "../ds.js";
import { DriverLoadingNotice } from "./DriversLoading.jsx";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { bidScreenDateOptions, selectBidScreenRows, useGetAdminBidScreenDirectoryQuery, useGetAdminBidScreenAnalyticsQuery, useGetAdminBidScreenTopCompaniesQuery, useGetAdminBidScreenOfferQuery } from "../store/features/bids/bidScreenApi.js";
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


export function BidsOffers() {
  const owner=useSelector((s)=>s.auth.admin?.id),role=useSelector((s)=>s.auth.admin?.role);
  const authenticated=useSelector((s)=>Boolean(s.auth.accessToken&&s.auth.admin?.id));
  return <BidsOffersContent key={[owner,role,authenticated].join(":")} owner={owner} role={role} authenticated={authenticated}/>;
}
function BidsOffersContent({owner,role,authenticated}) {
  const navigate=useNavigate();
  const [tab,setTab]=useState("Bid Overview"),[page,setPage]=useState(1),[q,setQ]=usePageSearchState("", () => setPage(1));
  const [statusFilter,setStatusFilter]=useState("All Status"),[dateKey,setDateKey]=useState("week");
  const [menu,setMenu]=useState(null),[offerModal,setOfferModal]=useState(null),[toast,setToast]=useState(null),[offerError,setOfferError]=useState("");
  const dateOptions=useMemo(()=>bidScreenDateOptions(),[]);
  const selectedDate=dateOptions.find((d)=>d.key===dateKey)||dateOptions[0],dateRange=selectedDate.label;
  const session={owner,role},dates={dateFrom:selectedDate.dateFrom,dateTo:selectedDate.dateTo};
  const directoryQuery=useGetAdminBidScreenDirectoryQuery(session,{skip:!authenticated,refetchOnMountOrArgChange:true});
  const analyticsQuery=useGetAdminBidScreenAnalyticsQuery({...session,...dates},{skip:!authenticated,refetchOnMountOrArgChange:true});
  const topQuery=useGetAdminBidScreenTopCompaniesQuery({...session,dateFrom:dateOptions[0].dateFrom,dateTo:dateOptions[0].dateTo},{skip:!authenticated,refetchOnMountOrArgChange:true});
  const offerQuery=useGetAdminBidScreenOfferQuery({...session,id:offerModal?.bidId},{skip:!authenticated||!offerModal?.bidId,refetchOnMountOrArgChange:true});
  const data=directoryQuery.error?null:directoryQuery.currentData;
  const analytics=analyticsQuery.error?null:analyticsQuery.currentData;
  const topCompanies=topQuery.error?null:topQuery.currentData?.rows;
  const selectedOffer=offerQuery.error?null:offerQuery.currentData;
  const selection=useMemo(()=>selectBidScreenRows(data,{tab,query:q,statusFilter,...dates}),[data,tab,q,statusFilter,dates.dateFrom,dates.dateTo]);
  const pageRows=selection.rows,offers=selection.offers,isCounterTab=tab==="Counter Offers";
  const pageCount=Math.max(1,Math.ceil(pageRows.length/8));
  const overviewKnown=Boolean(data?.overviewKnown),rowsKnown=Boolean(data&&(isCounterTab?data.offersKnown:overviewKnown));
  const emptyFunnel=[["Jobs Published",null,"#8d58e8"],["Jobs with Bids",null,"#5b79e5"],["Bids Received",null,"#74d1b1"],["Bids Accepted",null,"#ffa11e"],["Jobs Completed",null,"#ff676d"]];
  const funnelData=analytics?.funnel||emptyFunnel,funnelMax=Math.max(1,...funnelData.map((x)=>x[1]??0));
  const breakdown=analytics?.breakdown||[{label:"Lowest Bids",color:"#4c16ac",value:null,display:"—"},{label:"Competing Bids",color:"#2469e8",value:null,display:"—"},{label:"Counter Offers",color:"#12a150",value:null,display:"—"},{label:"Expired Offers",color:"#f27602",value:null,display:"—"}];
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),2600);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{setPage(1);},[tab,q,statusFilter,dateKey]);
  useEffect(()=>{if(page>pageCount)setPage(pageCount);},[page,pageCount]);
  function openMenu(event,key){const anchor=event.currentTarget;setMenu((previous)=>previous?.key===key?null:{key,anchor});}
  const menuItems=menu?.key==="date"?dateOptions.map((d)=>({label:d.label,icon:d.key===dateKey?"check":undefined,onClick:()=>{setDateKey(d.key);setPage(1);setMenu(null);}}))
    :["All Status",...STATUSES].map((s)=>({label:s,icon:s===statusFilter?"check":undefined,onClick:()=>{setStatusFilter(s);setPage(1);setMenu(null);}}));
  function viewJob(row){if(row.jobId)navigate("/jobs/detail?id="+encodeURIComponent(row.jobId));else setToast({tone:"info",title:"Job details are unavailable."});}
  function resolveOffer(_offer,accept){
    const title=(accept?"Accepting":"Declining")+" counteroffers is unavailable: there is no documented admin API.";
    setOfferError(title);setToast({tone:"info",title});
  }
  function openOffer(row){setOfferError("");setOfferModal(row);setMenu(null);}
  function exportRows(){
    if(!rowsKnown)return;
    const header=isCounterTab?["Job ID","Bidding Company","Offer Amount (₦)","Δ vs Lowest"]:["Job ID","Route","Customer","Bids","Lowest Bid (₦)","Winning Bid (₦)","Status","Created At","Time"];
    const rows=pageRows.map((r)=>isCounterTab?[r.id,r.company,r.amountValue??"—",r.deltaValue??"—"]:[r.id,r.route,r.customer,r.bids,r.lowValue??"—",r.winValue??"—",r.status,r.date,r.time]);
    const cell=(v)=>{const s=String(v??"");return '"'+(/^[=+\-@\t\r]/.test(s)?"'":"")+s.replaceAll('"','""')+'"';};
    const csv=[header,...rows].map((r)=>r.map(cell).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");
    link.href=url;link.download="trukkas-bids-"+dateKey+".csv";document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),0);
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
            onClick={() => resolveOffer(r, false)}
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
        actions={<>
          <span style={{ position: "relative" }}>
            <button
              className="date-button"
              onClick={(event) => openMenu(event, "date")}
            >
              <Icon name="calendar" size={15} />
              {dateRange}⌄
            </button>
          </span>
          <span style={{ position: "relative" }}>
            <Button
              variant="outline"
              icon="list-filter"
              onClick={(event) => openMenu(event, "head")}
            >
              Filters
            </Button>
          </span>
          <Button icon="download" disabled={!rowsKnown || !pageRows.length} onClick={exportRows}>Export</Button>
        </>}
      />

      {toast && <Banner tone={toast.tone} title={toast.title} />}
      {directoryQuery.error && <Banner tone="danger" title={getApiErrorMessage(directoryQuery.error)} action={<Button size="sm" variant="outline" onClick={directoryQuery.refetch}>Retry</Button>} />}
      {data?.errors.length > 0 && <Banner tone="warning" title={"Unable to load: " + data.errors.join(", ") + "."} action={<Button size="sm" variant="outline" onClick={directoryQuery.refetch}>Retry</Button>} />}
      {(analyticsQuery.error || topQuery.error) && <Banner tone="warning" title="Bid analytics are temporarily unavailable." action={<Button size="sm" variant="outline" onClick={() => { analyticsQuery.refetch(); topQuery.refetch(); }}>Retry analytics</Button>} />}

      <div className="kpi-grid">
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
      </div>

      <Tabs
        items={[
          "Bid Overview",
          "Counter Offers",
          "Awarded / Won",
          "Expired",
          "Cancelled",
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="bids-layout">
        <div className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>{tab}</h3>
            </div>
            <span style={{ position: "relative" }}>
              <button
                className="date-button"
                onClick={(event) => openMenu(event, "panel")}
              >
                {statusFilter}⌄
              </button>
            </span>
            <SearchField
              placeholder="Search by Job ID, Company, Truck, Driver..."
              style={{ width: 260 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {directoryQuery.isFetching ? <BidsTableLoading columns={isCounterTab ? offerCols : cols} /> : !rowsKnown ? <DriverLoadingNotice>—</DriverLoadingNotice> : isCounterTab ? (
            <DataTable
              rows={pageRows.slice((page - 1) * 8, page * 8)}
              rowKey={(r) => r.bidId}
              columns={offerCols}
            />
          ) : pageRows.length === 0 ? (
            <div
              style={{ padding: "40px 18px", textAlign: "center" }}
              className="tk-meta"
            >
              No bids match the current filters.
            </div>
          ) : (
            <DataTable
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

        <div className="bid-rail">
          <div className="ops-panel">
            <div className="ops-panel-head">
              <div>
                <h3>Bid Analytics</h3>
              </div>
              <a onClick={() => setTab("Bid Overview")}>View Report</a>
            </div>
            <div className="bid-analytics">
              <DonutChart
                size={130}
                thickness={20}
                centerValue={analytics?.total ?? "—"}
                centerLabel="Total Bids"
                data={breakdown.every((item) => item.value != null) ? breakdown.map((item) => ({ label: item.label, value: item.value, color: item.color })) : []}
              />
              <div>
                {breakdown.map((item) => <div className="bid-legend" key={item.label}><span><i style={{ background: item.color }} />{item.label}</span><b>{item.display}</b></div>)}
              </div>
            </div>
          </div>
          <div className="ops-panel">
            <div className="ops-panel-head">
              <div>
                <h3>Recent Counter Offers</h3>
              </div>
              <a onClick={() => setTab("Counter Offers")}>View All</a>
            </div>
            {!data?.offersKnown && <DriverLoadingNotice>—</DriverLoadingNotice>}
            {data?.offersKnown && offers.length === 0 && (
              <div style={{ padding: "20px 14px" }} className="tk-meta">
                No open counter offers.
              </div>
            )}
            {(data?.offersKnown ? offers : []).map((o, i) => (
              <div
                className="offer-row"
                key={o.bidId}
                onClick={() => openOffer(o)}
              >
                <i>
                  <Icon
                    name={i % 2 ? "gavel" : "briefcase-business"}
                    size={16}
                  />
                </i>
                <span>
                  <strong>{o.id}</strong>
                  <small>{o.company}</small>
                </span>
                <span className="amount">
                  <b>{o.amount}</b>
                  <em>{o.delta}</em>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bottom-bid-grid">
        <div className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>
                Top Bidding Companies <small>(This Week)</small>
              </h3>
            </div>
          </div>
          {topCompanies == null ? <DriverLoadingNotice>—</DriverLoadingNotice> : topCompanies.map((company, i) => (
            <div className="rank-row" key={company.id || i}><b>{i + 1}</b><span>{company.name}</span><span>{company.totalBids ?? "—"} Bids</span><span>Won: {company.won ?? "—"}</span><span>Win Rate {company.winRate == null ? "—" : company.winRate + "%"}</span></div>
          ))}
        </div>
        <div className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>Bid Conversion Funnel</h3>
            </div>
            <a
              onClick={() =>
                setToast({
                  tone: "info",
                  title: "A full funnel report has no documented API.",
                })
              }
            >
              View Report
            </a>
          </div>
          <div className="funnel">
            {funnelData.map((x) => (
              <div className="funnel-row" key={x[0]}>
                <span>{x[0]}</span>
                <i
                  style={{
                    background: x[2],
                    width: (x[1] == null || x[1] === 0 ? 0 : Math.max(18, (x[1] / funnelMax) * 100)) + "%",
                  }}
                />
                <b>{x[1] ?? "—"}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      {menu && <BidScreenMenu anchor={menu.anchor} items={menuItems} onClose={setMenu} />}

      <Modal
        open={!!offerModal}
        onClose={() => { setOfferModal(null); setOfferError(""); }}
        title="Counter Offer"
        description={
          offerModal ? `${offerModal.company} · ${offerModal.id}` : ""
        }
        footer={
          offerModal && (
            <>
              <Button
                variant="outline"
                disabled={!selectedOffer || selectedOffer.statusCode !== "PENDING" || offerQuery.isFetching}
                onClick={() => resolveOffer(selectedOffer, false)}
              >
                Decline
              </Button>
              <Button
                icon="check"
                disabled={!selectedOffer || selectedOffer.statusCode !== "PENDING" || offerQuery.isFetching}
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
              Accepting will mark this job's bid as accepted and notify the
              bidding company.
            </span>
          </div>
        )}
      </Modal>
    </div>
  );
}
