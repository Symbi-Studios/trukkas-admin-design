'use client';

import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Banner, Button, DataTable, Modal, Pagination, Skeleton, TextField, Textarea } from '../ds.js';
import { useGetAdminSettingsEventsQuery, useTerminateAdminSettingsSessionMutation, useChangeAdminSettingsPasswordMutation } from '../store/features/settings/settingsApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

export function SettingsSessionReasonDialog({ admin, session, all = false, onClose, onSaved }) {
  const [reason, setReason] = useState(''), [error, setError] = useState(null);
  const [terminate, mutation] = useTerminateAdminSettingsSessionMutation();
  const activeAdmin = useSelector((state) => state.auth.admin);
  const pending = useRef(false);
  const allowed = activeAdmin === admin && (!all || admin?.role === 'SUPER_ADMIN') && (all || session?.status === 'ACTIVE');
  async function submit() {
    if (pending.current || !allowed || !reason.trim()) return;
    pending.current = true; setError(null);
    try {
      const result = await terminate({ owner: admin.id, id: session?.id, expectedVersion: session?.version, all, reason }).unwrap();
      onSaved(result); onClose();
    } catch (failure) { setError(getApiErrorMessage(failure)); }
    finally { pending.current = false; }
  }
  return <Modal open title={all ? 'Reset All User Sessions' : 'Terminate Session'} width={520} onClose={() => { if (!mutation.isLoading) onClose(); }} footer={<>
    <Button variant="outline" disabled={mutation.isLoading} onClick={onClose}>Cancel</Button>
    <Button variant="danger" disabled={!allowed || !reason.trim() || mutation.isLoading} onClick={submit}>{mutation.isLoading ? 'Terminating…' : 'Terminate'}</Button>
  </>}>
    <div style={{ display: 'grid', gap: 16 }}>
      {error && <Banner tone="danger">{error}</Banner>}
      <p className="tk-meta">{all ? 'Ends every app-user session on their next request. Admin sessions are unaffected.' : 'Ends this app-user session on their next request.'}</p>
      {!all && <span>{session?.name || '—'} · {session?.device || '—'}</span>}
      <Textarea label="Reason" value={reason} rows={3} onChange={(event) => setReason(event.target.value)} />
    </div>
  </Modal>;
}

export function SettingsPasswordDialog({ admin, onClose }) {
  const [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState(''), [confirmation, setConfirmation] = useState(''), [error, setError] = useState(null);
  const [change, mutation] = useChangeAdminSettingsPasswordMutation();
  const activeAdmin = useSelector((state) => state.auth.admin);
  const pending = useRef(false);
  const valid = activeAdmin === admin && currentPassword && newPassword.length >= 8 && currentPassword !== newPassword && newPassword === confirmation;
  async function submit() {
    if (pending.current || !valid) return;
    pending.current = true; setError(null);
    try { await change({ owner: admin.id, currentPassword, newPassword }).unwrap(); setCurrent(''); setNew(''); setConfirmation(''); onClose(); }
    catch (failure) { setCurrent(''); setNew(''); setConfirmation(''); setError(getApiErrorMessage(failure)); }
    finally { pending.current = false; }
  }
  return <Modal open title="Update Password" width={520} onClose={() => { if (!mutation.isLoading) onClose(); }} footer={<>
    <Button variant="outline" disabled={mutation.isLoading} onClick={onClose}>Cancel</Button>
    <Button disabled={!valid || mutation.isLoading} onClick={submit}>{mutation.isLoading ? 'Saving…' : 'Update Password'}</Button>
  </>}>
    <div style={{ display: 'grid', gap: 16 }}>
      {error && <Banner tone="danger">{error}</Banner>}
      <p className="tk-meta">Changing your password signs you out everywhere. Sign in again with your new password.</p>
      <TextField label="Current Password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrent(event.target.value)} />
      <TextField label="New Password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNew(event.target.value)} hint="At least 8 characters; must differ from your current password." />
      <TextField label="Confirm New Password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
    </div>
  </Modal>;
}

export function SettingsEventsDialog({ admin, type, onClose }) {
  const [page, setPage] = useState(1);
  const activeAdmin = useSelector((state) => state.auth.admin);
  const query = useGetAdminSettingsEventsQuery({ owner: admin.id, type, page, limit: 20 }, { skip: activeAdmin !== admin, refetchOnMountOrArgChange: true });
  const data = query.error ? null : query.currentData;
  return <Modal open title={type === 'login' ? 'Login History' : 'Security Events'} width={900} onClose={onClose} footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
    {query.error ? <Banner tone="danger">{getApiErrorMessage(query.error)}</Banner> : query.isLoading || (query.isFetching && !query.currentData) ? <Skeleton height={180} /> : <>
      <DataTable rows={data?.rows || []} rowKey={(row) => row.id} columns={[
        { key: 'label', header: 'Event' }, { key: 'detail', header: 'Description' }, { key: 'time', header: 'Time' },
        { key: 'device', header: 'Device' }, { key: 'ip', header: 'IP Address' }, { key: 'location', header: 'Location' },
      ]} />
      <Pagination page={page} pageSize={20} total={data?.total ?? null} pageCount={data?.pageCount ?? null} onPage={setPage} />
    </>}
  </Modal>;
}
