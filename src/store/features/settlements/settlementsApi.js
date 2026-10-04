import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const text = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
const number = (v) => (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v.trim()))) && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= Number.MAX_SAFE_INTEGER ? Number(v) : null;
const label = (v) => text(v)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? '—';
const failure = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
export const settlementNumber = (v) => number(v)?.toLocaleString('en-NG') ?? '—';
export const settlementMoney = (v) => number(v) == null ? '—' : `${number(v) < 0 ? '-' : ''}₦${Math.abs(number(v)).toLocaleString('en-NG')}`;
export const settlementMillions = (v) => number(v) == null ? '—' : `₦${(number(v) / 1000000).toFixed(2)}M`;
export const settlementDetailUrl = (row) => `/settlements/detail?userId=${encodeURIComponent(row.userId)}&jobId=${encodeURIComponent(row.jobId)}`;
const datePart = (v, time = false) => {
  const date = text(v) ? new Date(v) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', ...(time ? { hour:'2-digit', minute:'2-digit' } : { month:'short', day:'numeric', year:'numeric' }) }).format(date) : '—';
};
const stateLabel = { PAID:'Completed', HELD:'On Hold', AWAITING_MOBILIZATION:'Pending', IN_PROGRESS:'Pending', CANCELLED:'Cancelled' };

// These are job reconciliation records, not wallet-to-bank withdrawals.
// A composite React key is internal only: the API does not document settlement IDs.
export function adaptAdminSettlement(dto, user, jobResponse) {
  const job = record(unwrapApiResponseData(jobResponse));
  const jobId = text(dto.jobId), userId = text(user.id);
  if (!jobId || !userId) return null;
  const currency = text(dto.currency), stateCode = text(dto.state)?.toUpperCase();
  const transactions = Array.isArray(dto.transactions) ? dto.transactions.filter((v) => v && text(v.id)) : [];
  const finalCredits = transactions.filter((v) => v.type === 'final_payment' && text(v.createdAt) && Number.isFinite(Date.parse(v.createdAt))).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const settledAt = text(dto.settledAt) ?? (stateCode === 'PAID' ? text(finalCredits[0]?.createdAt) : null);
  const status = text(dto.status) ? label(dto.status) : stateLabel[stateCode] ?? label(stateCode);
  const payer = text(dto.payer?.name) ?? text(job.forwarder?.name) ?? '—';
  const payee = text(dto.payee?.name) ?? text(user.name) ?? '—';
  const pickup = text(job.pickup?.address) ?? text(job.pickup?.port), delivery = text(job.delivery?.address);
  const row = {
    key: `${userId}:${jobId}`, id: text(dto.id) ?? text(dto.settlementId) ?? '—', userId, jobId,
    relatedTo: text(dto.jobNumber) ?? jobId,
    route: text(dto.route) ?? (pickup && delivery ? `${pickup} → ${delivery}` : '—'),
    payer, payerType: text(dto.payerType) ?? '—', payee, payeeType: 'Transporter',
    amount: currency === 'NGN' ? number(dto.netPayable) : null, paidTotal: currency === 'NGN' ? number(dto.paid?.total) : null,
    type: 'Transporter Payment', status, stateCode, currency,
    // The docs explicitly describe these payments as actual wallet credits.
    method: text(dto.method) ?? (stateCode === 'PAID' && finalCredits.length ? 'Wallet' : '—'),
    settledOn: datePart(settledAt), settledTime: datePart(settledAt, true), settledAt,
    sortAt: text(settledAt) ?? text(dto.acceptedAt), eligibility: label(dto.finalPayoutEligibility),
    reconciled: typeof dto.reconciled === 'boolean' ? dto.reconciled : null,
    receiptUrl: text(dto.receiptUrl), jobUrl: `/jobs/detail?id=${encodeURIComponent(jobId)}`,
  };
  const jobEvents = Array.isArray(job.activityLog) ? job.activityLog : [];
  const deliveryEvent = jobEvents.find((v) => v?.action === 'MARKED_JOB_DELIVERED' || v?.action === 'DELIVERY_CONFIRMED');
  row.timeline = [
    { title:'Job delivered & confirmed', description:row.relatedTo, time:datePart(deliveryEvent?.at), state:deliveryEvent ? 'done' : 'pending', icon:'check' },
    { title:'Settlement initiated', description:payer === '—' && payee === '—' ? '—' : `${payer} → ${payee}`, time:datePart(dto.initiatedAt), state:text(dto.initiatedAt) ? 'done' : 'pending', icon:'coins' },
    { title:status === 'Completed' ? 'Settlement completed' : status === 'Failed' ? 'Settlement failed' : status === 'On Hold' ? 'Settlement on hold' : row.eligibility,
      description:status === 'Completed' ? `Paid via ${row.method}` : row.eligibility,
      time:row.settledOn === '—' ? '—' : `${row.settledOn} ${row.settledTime}`,
      state:status === 'Completed' ? 'done' : status === 'Failed' ? 'danger' : stateCode ? 'current' : 'pending', icon:status === 'Failed' ? 'x' : 'lock-open' },
  ];
  return row;
}

// Never publish a partial directory or partial per-user settlement collection.
async function allPages(baseQuery, api, url, collection, identity) {
  const rows = [], seen = new Set();
  let total = null, pages = null;
  for (let page = 1; ; page += 1) {
    if (api.signal.aborted) return failure('Settlement loading was cancelled.');
    const result = await baseQuery({ url, params:{ page, limit:100 } });
    if (result.error) return { error:result.error };
    const dto = record(unwrapApiResponseData(result.data)), p = record(dto.pagination);
    if (!Array.isArray(dto[collection]) || number(p.page) !== page || !Number.isInteger(number(p.total)) || number(p.total) < 0 || !Number.isInteger(number(p.totalPages)) || number(p.totalPages) < 0 || !Number.isInteger(number(p.limit)) || number(p.limit) <= 0) return failure('The response is missing valid settlement records or pagination.');
    if (Math.max(1,number(p.totalPages)) !== Math.max(1,Math.ceil(number(p.total)/number(p.limit)))) return failure('The response contains inconsistent settlement pagination.');
    if (page === 1) { total = number(p.total); pages = Math.max(1,number(p.totalPages)); }
    if (total !== number(p.total) || pages !== Math.max(1,number(p.totalPages))) return failure('Settlement records changed while loading. Please refresh.');
    for (const entry of dto[collection]) {
      const id = text(entry?.[identity]);
      if (!id || seen.has(id)) return failure('Settlement records contain missing or repeated identifiers. Please refresh.');
      seen.add(id); rows.push(entry);
    }
    if (page >= pages) break;
    if (!dto[collection].length) return failure('Settlement loading returned an incomplete page.');
  }
  return rows.length === total ? { data:rows } : failure('The complete settlement collection could not be loaded.');
}

export function settlementInsights(rows) {
  const fields = ['totalSettlements','completedSettlements','pendingSettlements','onHold','failedSettlements','avgSettlementTime'];
  const summary = Object.fromEntries(fields.flatMap((v) => [[v,null],[`${v}Delta`,'—']]));
  // Complete trucker records can establish this category, but not global totals
  // for drivers, vendors, customer refunds, or other undocumented categories.
  const transporterPaid = rows != null && rows.every((r) => r.paidTotal != null) ? number(rows.reduce((sum,r) => sum+r.paidTotal,0)) : null;
  return { summary,
    payouts:['Drivers','Transporters','Vendors','Customers (Refunds)','Others'].map((name,i) => ({ label:name, pct:null, amount:name === 'Transporters' ? transporterPaid : null, color:['var(--tk-viz-1)','var(--tk-viz-2)','var(--tk-viz-3)','var(--tk-viz-5)','var(--tk-ink-300)'][i] })),
    statuses:[['Completed','success','circle-check'],['Pending','warning','hourglass'],['On Hold','info','circle-pause'],['Failed','danger','circle-x']].map(([name,tone,icon]) => ({ label:name,tone,icon,count:null,pct:'—' })), alerts:[],
  };
}

export function exportSettlementRows(rows) {
  const fields = [['Settlement ID','id'],['Related To','relatedTo'],['Route','route'],['Payer','payer'],['Payer Type','payerType'],['Payee','payee'],['Payee Type','payeeType'],['Amount (NGN)','amount'],['Settlement Type','type'],['Status','status'],['Settled On','settledOn'],['Method','method']];
  const quote = (v) => { const s = String(v ?? '—'); return '"' + (/^[=+@\-\t\r]/.test(s) ? "'"+s : s).replaceAll('"','""') + '"'; };
  const csv = [fields.map(([name]) => quote(name)).join(','), ...rows.map((row) => fields.map(([,field]) => quote(row[field])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href=url; link.download='settlements.csv'; link.click(); URL.revokeObjectURL(url);
}
export function downloadSettlementReceipt(row) {
  // No synthetic receipt: use only an actual returned document URL.
  if (!row.receiptUrl) return;
  try { const url = new URL(row.receiptUrl); if (url.protocol === 'https:' || url.protocol === 'http:') window.open(url.href,'_blank','noopener,noreferrer'); } catch {}
}

export const settlementsApi = baseApi.enhanceEndpoints({ addTagTypes:['AdminJobSettlements'] }).injectEndpoints({
  endpoints:(builder) => ({
    getAdminJobSettlements:builder.query({
      async queryFn(_args,api,_options,baseQuery) {
        const users = await allPages(baseQuery,api,'/admin/users/truckers','users','id');
        if (users.error) return users;
        const rows = [];
        for (let start = 0; start < users.data.length; start += 4) {
          const results = await Promise.all(users.data.slice(start,start+4).map(async (user) => ({ user, result:await allPages(baseQuery,api,`/admin/users/${encodeURIComponent(user.id)}/settlements`,'settlements','jobId') })));
          for (const {user,result} of results) {
            if (result.error) return result;
            for (const dto of result.data) { const row = adaptAdminSettlement(dto,user); if (row) rows.push(row); }
          }
        }
        if (rows.length) {
          // Join one paginated job directory instead of issuing a detail read per row.
          const jobs = await allPages(baseQuery,api,'/admin/jobs','jobs','id');
          if (jobs.error?.status === 401) return { error:jobs.error };
          if (jobs.data) {
            const byId = new Map(jobs.data.map((job) => [job.id,job]));
            for (const row of rows) {
              const job = byId.get(row.jobId);
              if (!job || (text(job.assignment?.assignee?.id) && job.assignment.assignee.id !== row.userId)) continue;
              row.route = text(job.route) ?? (text(job.origin) && text(job.destination) ? job.origin+' → '+job.destination : row.route);
              row.payer = text(job.forwarderName) ?? text(job.company?.name) ?? row.payer;
            }
          }
        }
        rows.sort((a,b) => (Date.parse(b.sortAt) || 0) - (Date.parse(a.sortAt) || 0));
        return { data:rows };
      }, providesTags:['AdminJobSettlements','AdminCompanies','AdminTrips','AdminJobs'],
    }),
    getAdminJobSettlementDetail:builder.query({
      async queryFn({userId,jobId},api,_options,baseQuery) {
        const result = await allPages(baseQuery,api,`/admin/users/${encodeURIComponent(userId)}/settlements`,'settlements','jobId');
        if (result.error) return result;
        const dto = result.data.find((v) => v.jobId === jobId);
        if (!dto) return { error:{ status:404 } };
        const jobResult = await baseQuery({ url:`/admin/jobs/${encodeURIComponent(jobId)}` });
        if (jobResult.error?.status === 401) return { error:jobResult.error };
        const job = record(unwrapApiResponseData(jobResult.error ? null : jobResult.data));
        // Only a verified matching job may enrich parties or route details.
        if (job.id === jobId && text(job.trucker?.id) && job.trucker.id !== userId) return failure('The selected trucker does not match this job.');
        const user = { id:userId, name:job.id === jobId ? text(job.trucker?.name) : null };
        return { data:adaptAdminSettlement(dto,user,job.id === jobId ? job : null) };
      }, providesTags:['AdminJobSettlements','AdminJobs'],
    }),
  }),
});
export const { useGetAdminJobSettlementsQuery,useGetAdminJobSettlementDetailQuery } = settlementsApi;
