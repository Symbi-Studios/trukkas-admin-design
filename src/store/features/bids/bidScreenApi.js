import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
const numeric = (v) => (typeof v === 'number' || typeof v === 'string' && v.trim()) && Number.isFinite(Number(v)) ? Number(v) : null;
const nonnegative = (v) => numeric(v) != null && numeric(v) >= 0 ? numeric(v) : null;
const count = (v) => Number.isSafeInteger(numeric(v)) && numeric(v) >= 0 ? numeric(v) : null;
const object = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const failure = (message) => ({ status: 'CUSTOM_ERROR', error: message });
const roles = new Set(['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN']);
const DAY = 86400000;
function session(api, owner, role) {
  const auth = api.getState().auth;
  return !api.signal.aborted && Boolean(auth.accessToken) && auth.admin?.id === owner && auth.admin?.role === role && roles.has(role);
}
function transport(api, baseQuery, owner, role) {
  return async (request) => {
    if (!session(api, owner, role)) throw failure('The session changed. Reopen Bids before continuing.');
    const response = await baseQuery(request);
    if (!session(api, owner, role)) throw failure('The session changed. Reopen Bids before continuing.');
    if (response.error) throw response.error;
    return unwrapApiResponseData(response.data);
  };
}
function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [y,m,d,h,min,s] = value.slice(0,19).split(/[-T:]/).map(Number);
  if (m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y,m,0)).getUTCDate() || h > 23 || min > 59 || s > 59 || !Number.isFinite(Date.parse(value))) return null;
  return value;
}
function displayDate(value, time = false) {
  const valid = timestamp(value);
  if (!valid) return '—';
  return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', ...(time ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }) }).format(new Date(valid));
}
export function bidScreenMoney(amount) {
  return numeric(amount) == null ? '—' : '₦' + numeric(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}
function signedMoney(amount) { return amount == null ? '—' : (amount > 0 ? '+' : amount < 0 ? '−' : '') + bidScreenMoney(Math.abs(amount)); }
function range(from, to) { return { dateFrom: new Date(from).toISOString(), dateTo: new Date(to).toISOString() }; }
function rangeLabel(from, to) {
  const fmt = new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric' });
  return fmt.format(new Date(from)) + ' – ' + fmt.format(new Date(to));
}
export function bidScreenDateOptions(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).filter((p) => p.type !== 'literal').map((p) => [p.type,p.value]));
  const midnight = Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)) - 3600000;
  const weekday = new Date(midnight + 3600000).getUTCDay();
  const monday = midnight - ((weekday + 6) % 7) * DAY;
  const week = range(monday, monday + 7 * DAY - 1), previousWeek = range(monday - 7 * DAY, monday - 1);
  return [
    { key: 'week', label: rangeLabel(monday,monday+7*DAY-1), ...week },
    { key: 'previousWeek', label: rangeLabel(monday-7*DAY,monday-1), ...previousWeek },
    { key: 'last7', label: 'Last 7 Days', ...range(midnight - 6 * DAY,midnight + DAY - 1) },
    { key: 'last30', label: 'Last 30 Days', ...range(midnight - 29 * DAY,midnight + DAY - 1) },
    { key: 'month', label: 'This Month', ...range(Date.UTC(Number(parts.year),Number(parts.month)-1,1)-3600000,midnight+DAY-1) },
  ];
}
async function directory(run, url, key, params = {}, idKey = 'id') {
  const rows = [], seen = new Set();
  let pages = 1, total = null;
  for (let page=1; page<=pages; page+=1) {
    const dto = await run({ url, params: { ...params, page, limit: 100 } });
    const p = object(dto?.pagination), list = dto?.[key];
    const size = count(p.limit), n = count(p.total), pageCount = count(p.totalPages);
    if (!Array.isArray(list) || count(p.page) !== page || !size || size > 100 || n == null || pageCount == null || pageCount > 500
      || pageCount !== Math.ceil(n/size) && !(n===0 && pageCount===1) || list.length > size || list.length > n || n > 0 && !list.length
      || total != null && (total !== n || pages !== Math.max(1,pageCount))) throw failure('The ' + key + ' collection is incomplete or changed while loading. Refresh it.');
    total=n; pages=Math.max(1,pageCount);
    for (const row of list) {
      const id=text(row?.[idKey]);
      if (!id || seen.has(id)) throw failure('The ' + key + ' collection contains invalid or repeated IDs.');
      seen.add(id); rows.push(row);
    }
  }
  if (rows.length !== total) throw failure('The ' + key + ' collection is incomplete.');
  return rows;
}
function mapBid(b) {
  return { bidId: text(b.id), jobId: text(b.jobId) || text(b.job?.id), id: text(b.jobNumber) || text(b.job?.jobNumber) || text(b.jobId) || '—',
    company: text(b.truckerName) || text(b.trucker?.name) || '—', route: text(b.route) || text(b.job?.route) || '—',
    amountValue: nonnegative(b.amount), amount: bidScreenMoney(nonnegative(b.amount)),
    statusCode: text(b.status), isCounterOffer: typeof b.isCounterOffer === 'boolean' ? b.isCounterOffer : null,
    createdAt: timestamp(b.createdAt), deltaValue: null, delta: '—' };
}
function jobStatus(j) {
  if (!j) return '—';
  const states = { DRIVER_ASSIGNED:'Bid Accepted', DRIVER_EN_ROUTE:'Bid Accepted', DRIVER_ARRIVED:'Bid Accepted',
    PICKUP_COMPLETED:'In Transit', IN_TRANSIT:'In Transit', CARGO_ARRIVED:'At Delivery', DEMURRAGE_IN_PROGRESS:'At Delivery', OFFLOADING:'At Delivery',
    OFFLOAD_COMPLETED:'Returning Container', CONTAINER_RETURNED:'Returning Container', DOCUMENTS_VALIDATED:'Bidding', COMPLETED:'Completed', CANCELLED:'Cancelled' };
  return states[j.status] || '—';
}
function groupBids(bids, jobs, trips) {
  const jobMap = new Map((jobs || []).map((j)=>[j.id,j])), grouped = new Map(), tripSearch = new Map();
  (trips || []).forEach((t) => { if (text(t.jobId)) tripSearch.set(t.jobId, (tripSearch.get(t.jobId) || []).concat([t.truck?.plateNumber,t.driver?.name,t.driverName].filter(Boolean))); });
  bids.forEach((b) => { if (b.jobId) { const rows=grouped.get(b.jobId)||[]; rows.push(b); grouped.set(b.jobId,rows); } });
  return [...grouped.entries()].map(([jobId,items]) => {
    const j=jobMap.get(jobId), amountsKnown=items.every((b)=>b.amountValue!=null);
    const lowValue=amountsKnown&&items.length ? Math.min(...items.map((b)=>b.amountValue)) : null;
    const winners=items.filter((b)=>b.statusCode==='ACCEPTED');
    const winValue=winners.length===1 ? winners[0].amountValue : null;
    items.forEach((b) => { b.deltaValue=lowValue!=null&&b.amountValue!=null?b.amountValue-lowValue:null; b.delta=signedMoney(b.deltaValue); });
    const createdAt=timestamp(j?.createdAt), status=jobStatus(j);
    return { jobId, id:text(j?.jobNumber)||items.find((b)=>b.id!=='—')?.id||jobId,
      route:text(j?.route)||items.find((b)=>b.route!=='—')?.route||'—', customer:text(j?.company?.name)||'—',
      bids:items.length, lowValue, low:bidScreenMoney(lowValue), winValue, win:bidScreenMoney(winValue),
      status, createdAt, date:displayDate(createdAt), time:displayDate(createdAt,true),
      hasPending:items.some((b)=>b.statusCode==='PENDING'), hasAccepted:winners.length>0,
      hasExpired:items.some((b)=>b.statusCode==='EXPIRED'), hasWithdrawn:items.some((b)=>b.statusCode==='WITHDRAWN'),
      searchText:[jobId,j?.jobNumber,j?.route,j?.company?.name,j?.assignment?.driverName,...(tripSearch.get(jobId)||[]),...items.flatMap((b)=>[b.id,b.route,b.company])].filter(Boolean).join(' ').toLowerCase() };
  }).sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0)||a.id.localeCompare(b.id));
}
function inRange(value, from, to) { const t=value?Date.parse(value):NaN; return Number.isFinite(t)&&t>=Date.parse(from)&&t<=Date.parse(to); }
function matchStatus(row, status) {
  if (!status || status==='All Status') return true;
  if (status==='Pending Evaluation') return row.hasPending;
  if (status==='Bid Accepted') return row.hasAccepted;
  if (status==='Expired') return row.hasExpired;
  if (status==='Cancelled') return row.status==='Cancelled'||row.hasWithdrawn;
  return row.status===status;
}
export function selectBidScreenRows(data, { tab, query, statusFilter, dateFrom, dateTo }) {
  if (!data) return { rows:[], offers:[] };
  const q=(query||'').trim().toLowerCase();
  if (tab==='Counter Offers') return { rows:data.offers.filter((o)=>inRange(o.createdAt,dateFrom,dateTo)&&(!q||[o.id,o.company].some((s)=>s.toLowerCase().includes(q)))), offers:data.offers.filter((o)=>inRange(o.createdAt,dateFrom,dateTo)).slice(0,5) };
  const rows=data.jobs.filter((j)=>inRange(j.createdAt,dateFrom,dateTo)&&(!q||j.searchText.includes(q))&&matchStatus(j,statusFilter)
    &&(tab==='Awarded / Won'?j.hasAccepted:tab==='Expired'?j.hasExpired:tab==='Cancelled'?j.hasWithdrawn||j.status==='Cancelled':true));
  return { rows, offers:data.offers.filter((o)=>inRange(o.createdAt,dateFrom,dateTo)).slice(0,5) };
}
function analyticsDto(dto) {
  const d=dto?.analytics&&typeof dto.analytics==='object'?dto.analytics:dto;
  if (!d||typeof d!=='object'||Array.isArray(d)) throw failure('Bid analytics are unavailable.');
  return d;
}
function metric(current, previous, key, percentageValue = false) {
  const value = percentageValue ? (count(current.averageWinningMargin?.sampleSize)>0?numeric(current.averageWinningMargin?.percent):null) : count(current[key]);
  const old = previous ? count(previous[key]) : null;
  const change=!percentageValue&&value!=null&&old!=null?(old===0?(value===0?0:null):(value-old)/old*100):null;
  return { value: value==null?'—':percentageValue?value.toLocaleString('en-NG',{maximumFractionDigits:1})+'%':value.toLocaleString('en-NG'),
    delta:change==null?'—':Math.abs(change).toLocaleString('en-NG',{maximumFractionDigits:1})+'%',
    direction:change==null?null:change<0?'DOWN':change>0?'UP':'FLAT', sparkline:[] };
}
export const bidScreenApi=baseApi.injectEndpoints({
  overrideExisting:process.env.NODE_ENV==='development',
  endpoints:(builder)=>({
    getAdminBidScreenDirectory:builder.query({
      async queryFn({owner,role},api,_options,baseQuery) {
        try {
          const run=transport(api,baseQuery,owner,role);
          const errors=[];
          const [rawBids,jobs,trips]=await Promise.all([
            directory(run,'/admin/bids','bids'),
            directory(run,'/admin/jobs','jobs').catch((e)=>{if(!session(api,owner,role))throw e; errors.push('Job information');return null;}),
            directory(run,'/admin/trips','trips',{},'tripId').catch((e)=>{if(!session(api,owner,role))throw e; errors.push('Truck and driver search');return null;}),
          ]);
          if(rawBids.some((b)=>!text(b.jobId)))throw failure('The bids collection is missing job associations.');
          const bids=rawBids.map(mapBid), grouped=groupBids(bids,jobs,trips);
          const overviewKnown=jobs!==null&&grouped.every((j)=>j.createdAt);
          if(jobs!==null&&!overviewKnown)errors.push('Job creation dates');
          const offersKnown=bids.every((b)=>b.isCounterOffer!==null&&b.statusCode&&(!(b.isCounterOffer&&b.statusCode==='PENDING')||b.createdAt));
          if(!offersKnown)errors.push('Counteroffer metadata');
          return {data:{jobs:grouped,overviewKnown,offersKnown,offers:bids.filter((b)=>b.isCounterOffer===true&&b.statusCode==='PENDING').sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0)||a.bidId.localeCompare(b.bidId)),errors}};
        } catch(e){return {error:e?.status?e:failure('Unable to load bids.')};}
      },
      providesTags:['AdminBids','AdminJobs','AdminTrips'],
    }),
    getAdminBidScreenAnalytics:builder.query({
      async queryFn({owner,role,dateFrom,dateTo},api,_options,baseQuery) {
        try {
          const run=transport(api,baseQuery,owner,role), start=Date.parse(dateFrom), end=Date.parse(dateTo);
          if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw failure('Choose a valid date range.');
          const prior=range(start-(end-start+1),start-1);
          const [current,previous]=await Promise.all([
            run({url:'/admin/bids/analytics',params:{dateFrom,dateTo}}).then(analyticsDto),
            run({url:'/admin/bids/analytics',params:prior}).then(analyticsDto).catch((e)=>{if(!session(api,owner,role))throw e;return null;}),
          ]);
          const total=count(current.totalBids), counter=count(current.counterOffers), expired=count(current.expiredBids);
          const statistic=(n)=>n==null?'—':total>0?(n/total*100).toLocaleString('en-NG',{maximumFractionDigits:1})+'% ('+n.toLocaleString('en-NG')+')':total===0&&n===0?'0% (0)':'—';
          return {data:{
            metrics:Object.fromEntries(['totalBids','pendingBids','counterOffers','acceptedBids','expiredBids'].map((k)=>[k,metric(current,previous,k)]).concat([['margin',metric(current,previous,'margin',true)]])),
            comparison:previous?rangeLabel(prior.dateFrom,prior.dateTo):'—',total:total??'—',
            breakdown:[{label:'Lowest Bids',color:'#4c16ac',value:null,display:'—'},{label:'Competing Bids',color:'#2469e8',value:null,display:'—'},
              {label:'Counter Offers',color:'#12a150',value:counter,display:statistic(counter)},{label:'Expired Offers',color:'#f27602',value:expired,display:statistic(expired)}],
            funnel:[['Jobs Published',count(current.funnel?.jobsPublished),'#8d58e8'],['Jobs with Bids',count(current.funnel?.jobsWithBids),'#5b79e5'],
              ['Bids Received',count(current.funnel?.bidsReceived),'#74d1b1'],['Bids Accepted',count(current.funnel?.bidsAccepted),'#ffa11e'],['Jobs Completed',count(current.funnel?.jobsCompleted),'#ff676d']],
          }};
        }catch(e){return {error:e?.status?e:failure('Unable to load bid analytics.')};}
      },
      providesTags:['AdminBidAnalytics'],
    }),
    getAdminBidScreenTopCompanies:builder.query({
      async queryFn({owner,role,dateFrom,dateTo},api,_options,baseQuery) {
        try {
          const dto=analyticsDto(await transport(api,baseQuery,owner,role)({url:'/admin/bids/analytics',params:{dateFrom,dateTo}}));
          return {data:{rows:Array.isArray(dto.topCompanies)?dto.topCompanies.filter((c)=>c&&typeof c==='object').map((c)=>({
            id:text(c.truckerId),name:text(c.name)||'—',totalBids:count(c.totalBids),won:count(c.won),winRate:numeric(c.winRate)>=0&&numeric(c.winRate)<=100?numeric(c.winRate):null,
          })):null}};
        }catch(e){return {error:e?.status?e:failure('Unable to load company analytics.')};}
      },
      providesTags:['AdminBidAnalytics'],
    }),
    getAdminBidScreenOffer:builder.query({
      async queryFn({owner,role,id},api,_options,baseQuery) {
        try {
          const run=transport(api,baseQuery,owner,role), response=await run({url:'/admin/bids/'+encodeURIComponent(id)});
          const raw=response?.bid&&typeof response.bid==='object'?response.bid:response;
          if(raw?.id!==id||raw.isCounterOffer!==true)throw failure('This counteroffer changed or is unavailable. Refresh the list.');
          const offer=mapBid(raw);
          let deltaValue=null;
          if(offer.jobId) {
            try {
              const bids=await directory(run,'/admin/bids','bids',{jobId:offer.jobId});
              if(bids.every((b)=>b.jobId===offer.jobId&&nonnegative(b.amount)!=null)&&bids.some((b)=>b.id===id&&nonnegative(b.amount)===offer.amountValue)&&offer.amountValue!=null)
                deltaValue=offer.amountValue-Math.min(...bids.map((b)=>nonnegative(b.amount)));
            } catch(e){if(!session(api,owner,role))throw e;}
          }
          return {data:{...offer,deltaValue,delta:signedMoney(deltaValue)}};
        }catch(e){return {error:e?.status?e:failure('Unable to load this counteroffer.')};}
      },
      providesTags:['AdminBids'],
    }),
  }),
});
export const {useGetAdminBidScreenDirectoryQuery,useGetAdminBidScreenAnalyticsQuery,useGetAdminBidScreenTopCompaniesQuery,useGetAdminBidScreenOfferQuery}=bidScreenApi;
