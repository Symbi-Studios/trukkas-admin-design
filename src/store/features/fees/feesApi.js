import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

function safeNumber(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()))) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= Number.MAX_SAFE_INTEGER ? parsed : null;
}
export function feeMoney(value) {
  const parsed = safeNumber(value);
  return parsed == null ? '—' : (parsed < 0 ? '-' : '') + '₦' + Math.abs(parsed).toLocaleString('en-NG');
}
export function feeMillions(value) {
  const parsed = safeNumber(value);
  return parsed == null ? '—' : (parsed < 0 ? '-' : '') + '₦' + (Math.abs(parsed) / 1000000).toFixed(2) + 'M';
}

export const emptyFeeSummary = {
  totalRevenue:null, totalRevenueDelta:'—',
  totalPlatformFees:null, totalPlatformFeesDelta:'—',
  totalCommissions:null, totalCommissionsDelta:'—',
  totalDeductions:null, totalDeductionsDelta:'—',
  avgEffectiveRate:'—', avgEffectiveRateDelta:'—',
  totalFeesCollected:null, totalCommissionsPaid:null,
  totalDeductionsCollected:null, netPlatformRevenue:null, avgEffectiveRateLabel:'—',
};
// These are the existing chart slots, not invented fee distribution records.
export const unavailableFeeDistribution = [
  { label:'Platform Fees', value:null, amount:null, color:'var(--tk-viz-1)' },
  { label:'Service Fees', value:null, amount:null, color:'var(--tk-viz-3)' },
  { label:'Processing Fees', value:null, amount:null, color:'var(--tk-viz-6)' },
  { label:'Other Fees', value:null, amount:null, color:'var(--tk-ink-300)' },
];
// No documented admin fee-rule collection/detail API. Null means unknown,
// rather than a successful request claiming that there are zero rules.
export const unavailableFeeCatalog = { rules:null, total:null };
const ruleFields = [
  'id','name','sub','description','appliesTo','jobType','cargoType','rate','calcType','status',
  'effectiveFrom','effectiveTo','priority','minFee','maxFee','currency','applicableOn','rounding',
  'taxInclusive','createdBy','createdOn','lastUpdated','userTypes','jobTypes','cargoTypes',
  'locations','otherConditions','formula','exampleJobValue','exampleFee','exampleNote',
];
export const unavailableFeeRule = {
  ...Object.fromEntries(ruleFields.map((field) => [field,'—'])),
  // Keep the existing default rule glyph; it carries no financial information.
  icon:'target', systemRule:null, auditHistory:null,
};

export function adaptAdminFeeRevenue(response) {
  // Configured rates are not collected effective rates. Unscoped earnings
  // breakdowns cannot establish this month's fee totals. Commission earned
  // cannot establish commissions paid to partners, and demurrage is not all deductions.
  const data = unwrapApiResponseData(response);
  return {
    ...emptyFeeSummary,
    totalRevenue:safeNumber(data?.jobs?.platformRevenueMonth),
  };
}

export const feesApi = baseApi.enhanceEndpoints({ addTagTypes:['AdminFeeRevenue'] }).injectEndpoints({
  endpoints:(builder) => ({
    getAdminFeeRevenue:builder.query({
      query:() => ({ url:'/admin/overview', method:'GET' }),
      transformResponse:adaptAdminFeeRevenue,
      providesTags:['AdminFeeRevenue', { type:'AdminFleet', id:'OVERVIEW' }],
    }),
  }),
});
export const { useGetAdminFeeRevenueQuery } = feesApi;
