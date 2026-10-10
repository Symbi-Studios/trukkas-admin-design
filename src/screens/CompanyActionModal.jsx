'use client';
import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Banner, Button, Modal, Skeleton, Textarea } from '../ds.js';
import { companyError, useGetAdminCompanyInfoQuery, useReviewAdminCompanyMutation, useSuspendAdminCompanyMutation, useActivateAdminCompanyMutation } from '../store/features/companies/companiesApi.js';
import './CompanyDetail.css';

export function CompanyActionModal({ action, onClose, onDone }) {
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const owner = useSelector(state => state.auth.admin?.id);
  const submitting = useRef(false);
  const [reason, setReason] = useState(''), [error, setError] = useState(null);
  const id = action?.company?.id, review = action?.kind === 'review';
  const infoQuery = useGetAdminCompanyInfoQuery({ id, owner }, { skip: !authenticated || !id || !review, refetchOnMountOrArgChange: true });
  const [reviewCompany, reviewState] = useReviewAdminCompanyMutation();
  const [suspendCompany, suspendState] = useSuspendAdminCompanyMutation();
  const [activateCompany, activateState] = useActivateAdminCompanyMutation();
  const busy = reviewState.isLoading || suspendState.isLoading || activateState.isLoading;
  const info = infoQuery.currentData;
  async function submit(decision) {
    if (submitting.current || busy) return;
    if (review && info?.kycStatusCode !== 'IN_REVIEW') return setError('This company is not awaiting manual KYB review.');
    if (!review && action.kind === 'suspend' && !reason.trim()) return;
    submitting.current = true; setError(null);
    try {
      if (review) await reviewCompany({ id, decision, reason, kycStatus: info.kycStatusCode }).unwrap();
      else if (action.kind === 'suspend') await suspendCompany({ id, reason }).unwrap();
      else await activateCompany(id).unwrap();
      onDone?.(review ? `Company ${decision === 'approve' ? 'approved' : 'rejected'}.` : `Company ${action.kind === 'suspend' ? 'suspended' : 'reactivated'}.`);
      onClose();
    } catch (requestError) { setError(companyError(requestError)); }
    finally { submitting.current = false; }
  }
  return <Modal open={Boolean(action)} onClose={() => { if (!busy) onClose(); }} title={review ? 'Review company' : action?.kind === 'suspend' ? 'Suspend company' : 'Reactivate company'} description={action?.company?.name} footer={<>
    <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
    {review ? <><Button variant="outline" disabled={busy || infoQuery.isFetching || !info || info.kycStatusCode !== 'IN_REVIEW' || Boolean(infoQuery.error)} onClick={() => submit('reject')}>Reject</Button><Button disabled={busy || infoQuery.isFetching || !info || info.kycStatusCode !== 'IN_REVIEW' || Boolean(infoQuery.error)} onClick={() => submit('approve')}>{busy ? 'Saving…' : 'Approve'}</Button></> : <Button disabled={busy || (action?.kind === 'suspend' && !reason.trim())} onClick={() => submit()}>{busy ? 'Saving…' : action?.kind === 'suspend' ? 'Suspend' : 'Reactivate'}</Button>}
  </>}>
    {error && <Banner tone="danger" title="Unable to save">{error}</Banner>}
    {review && (infoQuery.isFetching ? <div role="status" aria-label="Loading company verification" style={{ display: 'grid', gap: 16 }}>{[0, 1, 2, 3].map((item) => <Skeleton key={item} height={20} />)}</div> : infoQuery.error ? <Banner tone="danger" title="Unable to load company information">{companyError(infoQuery.error)}<Button variant="outline" onClick={infoQuery.refetch}>Retry</Button></Banner> : info && <div className="company-info-grid">{[['Company Name', info.name], ['RC Number', info.regNo], ['Business Address', info.location], ['Tax Identification Number (TIN)', info.taxId], ['KYB Status', info.verification]].map(([name, value]) => <div key={name}><small>{name}</small><strong>{value || '—'}</strong></div>)}</div>)}
    {action?.kind !== 'activate' && <Textarea label={review ? 'Reason for rejection (optional)' : 'Reason for suspension'} value={reason} onChange={(event) => setReason(event.target.value)} rows={4} />}
  </Modal>;
}
