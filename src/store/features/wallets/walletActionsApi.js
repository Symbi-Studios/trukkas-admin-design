import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import './walletsApi.js';

const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const amount = value => (typeof value === 'number' || typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= Number.MAX_SAFE_INTEGER ? Number(value) : null;
const failure = error => ({ status: 'CUSTOM_ERROR', error });
const adminRoles = ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'];
export const escrowMoneyRoles = ['SUPER_ADMIN', 'FINANCE_ADMIN'];
export const escrowResolutionOptions = [
  { value: 'ACCEPT_POD', label: 'Accept Proof of Delivery' },
  { value: 'PARTIAL_REFUND', label: 'Partial Refund' },
  { value: 'REQUEST_EVIDENCE', label: 'Request Evidence' },
  { value: 'ESCALATE', label: 'Escalate' },
  { value: 'CLOSE', label: 'Close Dispute' },
];
export const escrowCanRelease = hold => Boolean(hold && ['LOCKED', 'MOBILIZATION_RELEASED'].includes(hold.statusCode) && hold.canRelease === true);
export function walletActionError(error) {
  if (error?.requiresRefresh && text(error.error)) return error.error;
  const message = unwrapApiResponseData(error?.data)?.message;
  return (Array.isArray(message) ? message.join(' ') : text(message)) || text(error?.error) || 'The request could not be completed.';
}
function inSession(api, args) {
  const auth = api.getState().auth;
  return !api.signal.aborted && Boolean(auth.accessToken && text(args.owner)) && auth.admin?.id === args.owner && auth.admin?.role === args.role && adminRoles.includes(args.role);
}
function transport(api, baseQuery, args) {
  return async request => {
    if (!inSession(api,args)) throw failure('Your session changed. Reopen Wallets before continuing.');
    const result = await baseQuery(request);
    if (!inSession(api,args)) throw failure('Your session changed. Reopen Wallets before continuing.');
    if (result.error) throw result.error;
    return unwrapApiResponseData(result.data);
  };
}
function reported(error, sent) {
  const e = error?.status ? error : failure('The request could not be completed.');
  const requiresRefresh = sent && (typeof e.status !== 'number' || e.status >= 500 || e.status === 409);
  return { error: { ...e, requiresRefresh, ...(requiresRefresh ? { error: 'The result could not be confirmed. Close this dialog and refresh the record before attempting another action. '+walletActionError(e) } : {}) } };
}
const tags = ['AdminEscrowOverview','AdminEscrowLedger','AdminEscrowDisputes','AdminEscrowActivity','AdminEscrowHolds','AdminEscrowReleases','AdminEscrowAccounts','AdminEscrowAlerts','AdminJobs','AdminTrips','AdminCompanies','AdminDrivers','AdminForwarders','AdminPayoutDirectory','AdminPayoutWithdrawalStats','AdminTransactions'];
export const walletActionsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminPayoutDirectory','AdminPayoutWithdrawalStats','AdminTransactions'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: builder => ({
    releaseAdminEscrowFunds: builder.mutation({
      async queryFn(args,api,_options,baseQuery) {
        let sent = false;
        try {
          if (!text(args.holdId) || !text(args.jobId) || !text(args.reason)) throw failure('A selected escrow, job and release reason are required.');
          if (args.reason.trim().length > 500) throw failure('The release reason must be at most 500 characters.');
          if (!escrowMoneyRoles.includes(args.role)) throw failure('Only Super Admin and Finance Admin can release funds.');
          const run = transport(api,baseQuery,args), url = '/admin/escrow/holds/'+encodeURIComponent(args.holdId);
          const hold = await run({ url });
          if (hold?.id !== args.holdId || hold.jobId !== args.jobId || !['LOCKED','MOBILIZATION_RELEASED'].includes(hold.status) || hold.freeze !== null || !(amount(hold.currentHeldAmount) > 0) || !text(hold.trucker?.id)) throw failure('This escrow is no longer eligible for release. Refresh its details.');
          sent = true;
          const saved = await run({ url:url+'/release',method:'POST',body:{ reason:args.reason.trim() } });
          const expected = hold.status === 'LOCKED' ? 'MOBILIZATION_RELEASED' : 'COMPLETED';
          if (saved?.holdId !== args.holdId || !text(saved.releaseId) || saved.status !== 'COMPLETED' || saved.escrowStatus !== expected || saved.recipient?.id !== hold.trucker.id || amount(saved.amount) == null || amount(saved.amount) < 0 || !text(saved.settlementReference) || !text(saved.releasedAt) || !Number.isFinite(Date.parse(saved.releasedAt))) throw failure('Release acknowledgement is incomplete.');
          return { data:{ holdId:saved.holdId,releaseId:saved.releaseId,amount:amount(saved.amount),status:saved.escrowStatus } };
        } catch (error) { return reported(error,sent); }
      },
      invalidatesTags:tags,
    }),
    openAdminEscrowDispute: builder.mutation({
      async queryFn(args,api,_options,baseQuery) {
        let sent = false;
        try {
          const reason = text(args.reason), description = text(args.description);
          if (!text(args.holdId) || !text(args.jobId) || !reason || reason.length > 200 || (description?.length || 0) > 2000 || !['FORWARDER','TRUCKER'].includes(args.onBehalfOf)) throw failure('Enter a valid reason, description and party for this escrow.');
          const run = transport(api,baseQuery,args), hold = await run({ url:'/admin/escrow/holds/'+encodeURIComponent(args.holdId) });
          if (hold?.id !== args.holdId || hold.jobId !== args.jobId || !text(hold.trucker?.id) || !['LOCKED','MOBILIZATION_RELEASED','HELD'].includes(hold.status)) throw failure('This escrow cannot have a new dispute opened. Refresh its details.');
          sent = true;
          const saved = await run({ url:'/admin/disputes',method:'POST',body:{ jobId:args.jobId,reason,...(description ? { description } : {}),onBehalfOf:args.onBehalfOf } });
          if (!text(saved?.id) || saved.jobId !== args.jobId || saved.escrowId !== args.holdId || saved.status !== 'OPEN' || saved.escrowStatus !== 'HELD') throw failure('Dispute acknowledgement is incomplete.');
          return { data:{ id:saved.id,jobId:saved.jobId,status:saved.status } };
        } catch (error) { return reported(error,sent); }
      },
      invalidatesTags:tags,
    }),
    resolveAdminEscrowDispute: builder.mutation({
      async queryFn(args,api,_options,baseQuery) {
        let sent = false;
        try {
          const reason = text(args.reason), money = ['ACCEPT_POD','PARTIAL_REFUND'].includes(args.type), refund = amount(args.compensationAmount);
          if (!text(args.id) || !text(args.jobId) || !reason || !escrowResolutionOptions.some(option => option.value === args.type)) throw failure('Select a resolution and enter a reason.');
          if (money && !escrowMoneyRoles.includes(args.role)) throw failure('Only Super Admin and Finance Admin can resolve a dispute with a payment or refund.');
          if (args.type === 'PARTIAL_REFUND' && (refund == null || refund < 0)) throw failure('Enter the refund amount in naira.');
          const run = transport(api,baseQuery,args), url = '/admin/disputes/'+encodeURIComponent(args.id), dispute = await run({ url });
          if (dispute?.id !== args.id || dispute.jobId !== args.jobId || !['OPEN','UNDER_REVIEW'].includes(dispute.status)) throw failure('This dispute is no longer open for resolution. Refresh its details.');
          const escrowId = text(dispute.job?.escrow?.id);
          if (money) {
            if (!escrowId) throw failure('The unpaid escrow could not be identified.');
            const hold = await run({ url:'/admin/escrow/holds/'+encodeURIComponent(escrowId) });
            if (hold?.id !== escrowId || hold.jobId !== args.jobId || amount(hold.currentHeldAmount) == null || amount(hold.currentHeldAmount) < 0 || args.type === 'PARTIAL_REFUND' && refund > amount(hold.currentHeldAmount)) throw failure('The refund must not exceed the current unpaid escrow balance.');
          }
          sent = true;
          const saved = await run({ url:url+'/resolve',method:'POST',body:{ type:args.type,reason,...(args.type === 'PARTIAL_REFUND' ? { compensationAmount:refund } : {}) } });
          const expected = money ? 'RESOLVED' : args.type === 'CLOSE' ? 'CLOSED' : 'UNDER_REVIEW';
          if (saved?.dispute?.id !== args.id || saved.dispute.jobId !== args.jobId || saved.dispute.status !== expected) throw failure('Resolution acknowledgement is incomplete.');
          if (money && (saved.settlement?.escrowId !== escrowId || saved.settlement.escrowStatus !== 'COMPLETED' || amount(saved.settlement.paidToTrucker) == null || amount(saved.settlement.paidToTrucker) < 0 || amount(saved.settlement.refundedToForwarder) == null || amount(saved.settlement.refundedToForwarder) < 0 || args.type === 'PARTIAL_REFUND' && Math.abs(amount(saved.settlement.refundedToForwarder)-refund) >= 0.01)) throw failure('The settlement split could not be confirmed.');
          return { data:{ id:saved.dispute.id,status:saved.dispute.status } };
        } catch (error) { return reported(error,sent); }
      },
      invalidatesTags:tags,
    }),
  }),
});
export const {useReleaseAdminEscrowFundsMutation,useOpenAdminEscrowDisputeMutation,useResolveAdminEscrowDisputeMutation} = walletActionsApi;
