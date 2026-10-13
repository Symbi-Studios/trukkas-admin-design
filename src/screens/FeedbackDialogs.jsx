'use client';
import { useEffect, useState } from 'react';
import { Button, Checkbox, Modal, Pagination, Skeleton, Textarea } from '../ds.js';
import { DriverLoadingNotice } from './DriversLoading.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { useGetAdminFeedbackHistoryQuery, useGetAdminFeedbackSettingsQuery } from '../store/features/feedback/feedbackApi.js';

function FeedbackSettingsForm({ data, operations, onClose, onSaved }) {
  const [values, setValues] = useState(data.settings), [topics, setTopics] = useState(data.settings.topics.join('\n'));
  const saving = operations.saving;
  const next = { ...values, topics: topics.split('\n').map((topic) => topic.trim()).filter(Boolean) };
  const changed = JSON.stringify(next) !== JSON.stringify(data.settings);
  async function save() {
    if (!changed || saving || !operations.canManageSettings) return;
    try { const result = await operations.perform('settings', next, data.version); if (result) { onSaved(); onClose(); } }
    catch (error) { window.alert(error instanceof Error ? error.message : getApiErrorMessage(error)); }
  }
  return <Modal open title="Manage Feedback Settings" width={560} onClose={() => { if (!saving) onClose(); }} footer={<>
    <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
    <Button disabled={saving || !changed || !operations.canManageSettings} onClick={save}>Save Changes</Button>
  </>}>
    <div style={{ display: 'grid', gap: 14 }}>
      <Checkbox label="Allow App Submissions" checked={values.allowAppSubmissions} disabled={saving || !operations.canManageSettings} onChange={(checked) => setValues({ ...values, allowAppSubmissions: checked })} />
      <Checkbox label="Automatically Acknowledge Feedback" checked={values.autoAcknowledge} disabled={saving || !operations.canManageSettings} onChange={(checked) => setValues({ ...values, autoAcknowledge: checked })} />
      <Textarea label="Topics (one per line)" rows={6} value={topics} disabled={saving || !operations.canManageSettings} onChange={(event) => setTopics(event.target.value)} />
    </div>
  </Modal>;
}
export function FeedbackSettingsDialog({ operations, onClose, onSaved }) {
  const query = useGetAdminFeedbackSettingsQuery({ owner: operations.owner }, { skip: !operations.authenticated, refetchOnMountOrArgChange: true });
  const data = operations.authenticated && !query.error ? query.currentData : null;
  if (query.isFetching || !data) return <Modal open title="Manage Feedback Settings" width={560} onClose={onClose} footer={<Button variant="outline" onClick={onClose}>Cancel</Button>}>
    {query.isFetching ? <Skeleton height={120} /> : <DriverLoadingNotice>{query.error ? getApiErrorMessage(query.error) : '—'}</DriverLoadingNotice>}
  </Modal>;
  return <FeedbackSettingsForm key={operations.owner + ':' + data.version} data={data} operations={operations} onClose={onClose} onSaved={onSaved} />;
}
export function FeedbackHistoryDialog({ id, owner, authenticated, onClose }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [id, owner]);
  const query = useGetAdminFeedbackHistoryQuery({ owner, id, page }, { skip: !authenticated || !id, refetchOnMountOrArgChange: true });
  const data = authenticated && !query.error ? query.currentData : null;
  useEffect(() => { if (data?.pages != null && page > data.pages) setPage(data.pages); }, [data?.pages, page]);
  return <Modal open title="Conversation History" width={640} onClose={onClose} footer={<>
    <Pagination page={page} pageSize={20} total={data?.total ?? null} pageCount={data?.pages ?? null} onPage={(next) => { if (!query.isFetching && data?.pages != null) setPage(next); }} />
    <Button variant="outline" onClick={onClose}>Close</Button>
  </>}>
    {query.isFetching ? <Skeleton height={140} /> : query.error ? <DriverLoadingNotice>{getApiErrorMessage(query.error)}</DriverLoadingNotice>
      : data?.rows.length ? data.rows.map((entry) => <div key={entry.id} className="history-item"><span><strong>{entry.title}</strong><small style={{ whiteSpace: 'pre-line' }}>{entry.detail}</small>{entry.reply.message && <div className="note-box">{entry.reply.message}</div>}</span></div>)
      : <span className="tk-meta">{data ? 'No conversation history.' : '—'}</span>}
  </Modal>;
}
