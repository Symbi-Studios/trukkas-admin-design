'use client';
import { useState } from 'react';
import { Banner, Button, Checkbox, Modal, Pagination, SearchField, Skeleton, Textarea } from '../ds.js';
import { useGetAdminAnnouncementOptionsQuery, useGetAdminAnnouncementUsersQuery } from '../store/features/announcements/announcementsApi.js';
import { audiences } from '../store/features/announcements/announcementContracts.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

export function AnnouncementAudienceDialog({ name, owner, selected = [], onApply, onClose }) {
  const [ids, setIds] = useState(selected || []), [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const custom = name === 'Custom Users';
  const catalog = useGetAdminAnnouncementOptionsQuery({ owner }, { skip: custom, refetchOnMountOrArgChange: true });
  const users = useGetAdminAnnouncementUsersQuery({ owner, search, page }, { skip: !custom, refetchOnMountOrArgChange: true });
  const query = custom ? users : catalog;
  const options = query.error ? [] : custom ? users.currentData?.users || [] : catalog.currentData?.modes.find((mode) => mode.mode === audiences[name])?.options || [];
  function toggle(id, checked) { setIds((current) => checked ? [...new Set([...current, id])] : current.filter((value) => value !== id)); }
  return <Modal open title={name} width={580} onClose={onClose} footer={<>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button disabled={!ids.length || query.isFetching || Boolean(query.error)} onClick={() => onApply(ids)}>Apply</Button>
  </>}>
    <div style={{ display: 'grid', gap: 14 }}>
      {custom && <SearchField value={search} placeholder="Search users..." onChange={(event) => { setSearch(event.target.value); setPage(1); }} />}
      {query.error ? <Banner tone="danger">{getApiErrorMessage(query.error)}</Banner> : query.isLoading || (query.isFetching && !query.currentData) ? <Skeleton height={140} /> : options.length ? options.map((option) => <Checkbox key={option.id} label={option.label} checked={ids.includes(option.id)} onChange={(checked) => toggle(option.id, checked)} />) : <span>—</span>}
      {custom && <Pagination page={page} pageSize={20} total={users.currentData?.total ?? null} pageCount={users.currentData?.pageCount ?? null} onPage={setPage} />}
    </div>
  </Modal>;
}
export function AnnouncementReasonDialog({ action, announcement, operations, onClose, onSaved }) {
  const [reason, setReason] = useState(''), [error, setError] = useState(null);
  async function submit() {
    if (!reason.trim() || operations.saving) return;
    setError(null);
    try { const result = await operations.perform({ action, id: announcement.id, reason }); if (result) { onSaved(result); onClose(); } }
    catch (failure) { setError(failure instanceof Error ? failure.message : getApiErrorMessage(failure)); }
  }
  return <Modal open title={action === 'archive' ? 'Archive Announcement' : 'Unpublish Announcement'} width={520} onClose={() => { if (!operations.saving) onClose(); }} footer={<>
    <Button variant="outline" disabled={operations.saving} onClick={onClose}>Cancel</Button>
    <Button variant="danger" disabled={!reason.trim() || operations.saving} onClick={submit}>{operations.saving ? 'Saving…' : action === 'archive' ? 'Archive' : 'Unpublish'}</Button>
  </>}>
    <div style={{ display: 'grid', gap: 14 }}>
      {error && <Banner tone="danger">{error}</Banner>}
      <strong>{announcement.t}</strong>
      <Textarea label="Reason" value={reason} rows={3} onChange={(event) => setReason(event.target.value)} />
    </div>
  </Modal>;
}
