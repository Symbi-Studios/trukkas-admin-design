'use client';
import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Banner, Select, Textarea, TextField } from '../ds.js';
import { DriverTableLoading } from './DriversLoading.jsx';
import { useGetAdminEscrowHoldQuery } from '../store/features/wallets/walletsApi.js';
import {
  escrowMoneyRoles, escrowResolutionOptions, walletActionError,
  useReleaseAdminEscrowFundsMutation, useOpenAdminEscrowDisputeMutation, useResolveAdminEscrowDisputeMutation,
} from '../store/features/wallets/walletActionsApi.js';

export function WalletActionDialog({ kind, record, owner, role, onClose }) {
  const [reason, setReason] = useState(''), [description, setDescription] = useState(''), [onBehalfOf, setOnBehalfOf] = useState('FORWARDER');
  const [type, setType] = useState(''), [refund, setRefund] = useState(''), [error, setError] = useState(null), [requiresRefresh, setRequiresRefresh] = useState(false);
  const running = useRef(false), active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [release, releaseState] = useReleaseAdminEscrowFundsMutation();
  const [openDispute, openState] = useOpenAdminEscrowDisputeMutation();
  const [resolveDispute, resolveState] = useResolveAdminEscrowDisputeMutation();
  const partial = kind === 'resolve' && type === 'PARTIAL_REFUND';
  const holdQuery = useGetAdminEscrowHoldQuery({ holdId: record.escrowApiId, owner, role }, { skip: !partial || !record.escrowApiId, refetchOnMountOrArgChange: true });
  const unpaid = holdQuery.error ? null : holdQuery.currentData?.amount;
  const busy = releaseState.isLoading || openState.isLoading || resolveState.isLoading;
  const canMoveMoney = escrowMoneyRoles.includes(role);
  const options = escrowResolutionOptions.filter(option => canMoveMoney || !['ACCEPT_POD','PARTIAL_REFUND'].includes(option.value));
  const validRefund = refund.trim() !== '' && Number.isFinite(Number(refund)) && Number(refund) >= 0 && (unpaid == null || Number(refund) <= unpaid);
  const valid = reason.trim() && (kind !== 'open' || reason.trim().length <= 200 && description.trim().length <= 2000)
    && (kind !== 'resolve' || options.some(option => option.value === type)) && (!partial || validRefund)
    && (kind !== 'release' || canMoveMoney && reason.trim().length <= 500);
  const title = kind === 'release' ? 'Release Funds' : kind === 'open' ? 'Open a Dispute' : 'Resolve Dispute';
  const close = () => { if (!running.current) onClose(); };
  async function submit() {
    if (running.current || busy || !valid || requiresRefresh) return;
    running.current = true; setError(null);
    const common = { owner, role, reason };
    try {
      if (kind === 'release') await release({ ...common, holdId:record.holdId, jobId:record.jobApiId }).unwrap();
      else if (kind === 'open') await openDispute({ ...common, holdId:record.holdId, jobId:record.jobApiId, description, onBehalfOf }).unwrap();
      else await resolveDispute({ ...common, id:record.id, jobId:record.jobApiId, type, compensationAmount:refund }).unwrap();
      if (active.current) onClose();
    } catch (failure) {
      if (active.current) { setError(failure); setRequiresRefresh(failure.requiresRefresh === true); }
    } finally { running.current = false; }
  }
  return <Modal open onClose={close} title={title}
    description={kind === 'release' ? 'Release the next eligible escrow tranche for '+record.jobId+'.' : kind === 'open' ? 'Open a dispute for '+record.jobId+' and freeze its escrow.' : 'Choose how to handle dispute '+record.id+'.'}
    footer={<><Button variant="outline" disabled={busy} onClick={close}>Cancel</Button><Button disabled={busy || !valid || requiresRefresh || partial && holdQuery.isFetching} onClick={submit}>{busy ? 'Processing…' : title}</Button></>}>
    <div style={{ display:'grid', gap:16 }}>
      {error && <Banner tone="danger" title="Unable to complete action">{walletActionError(error)}</Banner>}
      {kind === 'resolve' && <Select label="Resolution" value={type} disabled={busy || requiresRefresh} onChange={event => setType(event.target.value)} placeholder="Select resolution" options={options} />}
      <Textarea label="Reason" required rows={4} maxLength={kind === 'open' ? 200 : kind === 'release' ? 500 : undefined} value={reason} disabled={busy || requiresRefresh} onChange={event => setReason(event.target.value)} />
      {kind === 'open' && <><Textarea label="Description (optional)" rows={4} maxLength={2000} value={description} disabled={busy || requiresRefresh} onChange={event => setDescription(event.target.value)} /><Select label="On behalf of" value={onBehalfOf} disabled={busy || requiresRefresh} onChange={event => setOnBehalfOf(event.target.value)} options={[{ value:'FORWARDER',label:'Forwarder' },{ value:'TRUCKER',label:'Trucker' }]} /></>}
      {partial && <>{holdQuery.isFetching && <DriverTableLoading columns={2} label="Loading unpaid escrow balance" />}<TextField label="Refund amount (₦)" required type="number" min={0} max={unpaid ?? undefined} step="0.01" value={refund} disabled={busy || requiresRefresh} onChange={event => setRefund(event.target.value)} /></>}
    </div>
  </Modal>;
}
