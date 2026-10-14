import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { companyDate } from './companiesApi.js';
const text=v=>typeof v==='string'&&v.trim()?v.trim():null;
const num=v=>(typeof v==='number'||typeof v==='string'&&v.trim())&&Number.isFinite(Number(v))?Number(v):null;
const count=v=>Number.isSafeInteger(num(v))&&num(v)>=0?num(v):null;
const fail=error=>({status:'CUSTOM_ERROR',error});
const roles=new Set(['SUPER_ADMIN','OPS_ADMIN','FINANCE_ADMIN']);
const userPath=id=>'/admin/users/'+encodeURIComponent(id);
function current(api,owner,role){const a=api.getState().auth;return !api.signal.aborted&&Boolean(a.accessToken)&&a.admin?.id===owner&&a.admin?.role===role&&roles.has(role);}
function transport(api,baseQuery,owner,role){return async request=>{if(!current(api,owner,role))throw fail('The session changed. Reopen Companies before continuing.');const result=await baseQuery(request);if(!current(api,owner,role))throw fail('The session changed. Reopen Companies before continuing.');if(result.error)throw result.error;return unwrapApiResponseData(result.data);};}
async function all(run,url,keys,params={},idKey='id'){
  const rows=[],seen=new Set();let pages=1,total=null;
  for(let page=1;page<=pages;page++){
    const dto=await run({url,params:{...params,page,limit:100}}),key=keys.find(k=>Array.isArray(dto?.[k])),p=dto?.pagination;
    if(!key||count(p?.page)!==page||!count(p?.limit)||count(p?.total)==null||count(p?.totalPages)==null||p.totalPages>500
      ||p.totalPages!==Math.ceil(p.total/p.limit)&&!(p.total===0&&p.totalPages===1)
      ||dto[key].length>p.limit||p.total>0&&!dto[key].length||total!=null&&(total!==p.total||pages!==Math.max(1,p.totalPages)))throw fail('The company collection or pagination is incomplete.');
    total=p.total;pages=Math.max(1,p.totalPages);
    for(const row of dto[key]){const id=text(row?.[idKey]);if(!id||seen.has(id))throw fail('Company records contain invalid or repeated IDs.');seen.add(id);rows.push(row);}
  }
  if(rows.length!==total)throw fail('Company records could not be loaded completely.');
  return rows;
}
function position(v){const lat=num(v?.latitude),lng=num(v?.longitude);return v?.source==='LIVE_GPS'&&lat!=null&&lng!=null&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180?lat.toFixed(5)+', '+lng.toFixed(5):null;}
function safeUrl(v){try{const u=new URL(v);return u.protocol==='https:'?u.href:null;}catch{return null;}}
const label=v=>text(v)?text(v).toLowerCase().replaceAll('_',' ').replace(/\b\w/g,s=>s.toUpperCase()):'—';
export const companyScreenApi=baseApi.injectEndpoints({
  overrideExisting:process.env.NODE_ENV==='development',
  endpoints:builder=>({
    getAdminCompanyScreenSummary:builder.query({
      async queryFn({id,owner,role},api,_options,baseQuery){try{
        const dto=await transport(api,baseQuery,owner,role)({url:userPath(id)+'/settlements/summary'});
        return {data:{pending:dto?.currency==='NGN'?num(dto.pendingReviewAmount):null,processing:dto?.currency==='NGN'?num(dto.processingAmount):null,available:null}};
      }catch(e){return {error:e?.status?e:fail('Company payout summary is unavailable.')};}},
      providesTags:['AdminCompanies'],
    }),
    getAdminCompanyScreenJobs:builder.query({
      async queryFn({id,owner,role},api,_options,baseQuery){try{
        const rows=await all(transport(api,baseQuery,owner,role),userPath(id)+'/jobs',['jobs'],{tab:'all'});
        return {data:{rows:rows.map(j=>({id:j.id,reference:text(j.jobId)||'—',route:text(j.route)||'—',status:label(j.status),date:companyDate(j.createdAt),amount:j.currency==='NGN'?num(j.value):null})),total:rows.length,completed:rows.every(j=>text(j.status))?rows.filter(j=>j.status==='COMPLETED').length:null}};
      }catch(e){return {error:e?.status?e:fail('Company job history is unavailable.')};}},
      providesTags:['AdminCompanies','AdminJobs'],
    }),
    getAdminCompanyScreenActivity:builder.query({
      async queryFn({id,owner,role,entityType,entityId},api,_options,baseQuery){try{
        const rows=await all(transport(api,baseQuery,owner,role),userPath(id)+'/activity',['events','activity','activities','rows'],{entityType,entityId});
        if(rows.some(a=>a.related?.companyId!==id&&!(a.entityType==='COMPANY'&&a.entityId===id)))throw fail('Activity records could not be associated with this company.');
        if(entityId&&rows.some(a=>a.entityId!==entityId||entityType&&a.entityType!==entityType))throw fail('The activity response does not match this inspector.');
        return {data:rows.map(a=>({id:a.id,icon:a.entityType==='TRUCK'?'truck':a.entityType==='DRIVER'?'users':'clipboard-check',title:text(a.title)||'—',sub:text(a.description)||text(a.actor?.name)||'—',time:companyDate(a.timestamp)}))};
      }catch(e){return {error:e?.status?e:fail('Company activity is unavailable. Its response envelope is not documented.')};}},
      providesTags:['AdminCompanies','AdminFleet','AdminDrivers'],
    }),
    getAdminCompanyScreenDriver:builder.query({
      async queryFn({id,companyId,owner,role},api,_options,baseQuery){try{
        const run=transport(api,baseQuery,owner,role),dto=await run({url:userPath(id)+'/profile'});
        if(dto?.id!==id||dto.role!=='DRIVER'||dto.linkedCompany?.id!==companyId)throw fail('This driver is no longer linked to this company.');
        let license=null,trips=null;
        try{license=await run({url:userPath(id)+'/license'});}catch(e){if(!current(api,owner,role))throw e;}
        try{trips=await all(run,'/admin/trips',['trips'],{driverId:id},'tripId');if(trips.some(t=>t.driver?.id!==id))trips=null;}catch(e){if(!current(api,owner,role))throw e;}
        const personal=dto.details?.personal||{},account=dto.details?.account||{};
        return {data:{license:text(license?.licenseNumber)||text(dto.verification?.driverLicense?.licenseNumber),licenseClass:text(license?.licenseClass)||text(dto.verification?.driverLicense?.licenseClass),
          dob:companyDate(personal.dateOfBirth),address:text(personal.address),joined:companyDate(dto.joinedAt||account.dateJoined),currentLocation:position(dto.truck?.currentLocation),
          documentUrl:safeUrl(license?.licenseUrl)||safeUrl(dto.verification?.driverLicense?.licenseUrl),totalTrips:trips?.length??null}};
      }catch(e){return {error:e?.status?e:fail('Company driver details are unavailable.')};}},
      providesTags:['AdminCompanies','AdminDrivers','AdminTrips'],
    }),
    resetAdminCompanyScreenVerification:builder.mutation({
      async queryFn({id,owner,role},api,_options,baseQuery){try{
        if(!['SUPER_ADMIN','OPS_ADMIN'].includes(role))throw fail('Your role cannot reset company verification.');
        const run=transport(api,baseQuery,owner,role),profile=await run({url:userPath(id)+'/profile'});
        if(profile?.id!==id||profile.role!=='TRUCKER'||profile.truckerType!=='COMPANY'||['SUSPENDED','BANNED'].includes(profile.status))throw fail('This company cannot be returned to review.');
        const saved=await run({url:userPath(id)+'/reset-verification',method:'POST',body:{}});
        if(saved?.user?.id!==id||saved.user.status!=='PENDING_REVIEW'||saved.user.kycStatus!=='IN_REVIEW')throw fail('The reset was sent but could not be confirmed. Refresh before retrying.');
        return {data:{id}};
      }catch(e){return {error:e?.status?e:fail('Company verification could not be reset.')};}},
      invalidatesTags:['AdminCompanies'],
    }),
  }),
});
export const {useGetAdminCompanyScreenSummaryQuery,useGetAdminCompanyScreenJobsQuery,useGetAdminCompanyScreenActivityQuery,useGetAdminCompanyScreenDriverQuery,useResetAdminCompanyScreenVerificationMutation}=companyScreenApi;
