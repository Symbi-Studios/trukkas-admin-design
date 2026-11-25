'use client';
import { useEffect, useState } from 'react';
import { Banner, Button, Checkbox, Modal, Skeleton, Textarea } from '../ds.js';
import { DriverLoadingNotice } from './DriversLoading.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { useGetAdminFeedbackSettingsQuery } from '../store/features/feedback/feedbackApi.js';

function FeedbackSettingsForm({ data, operations, onClose, onSaved }) {
  const [values, setValues] = useState(data.settings), [topics, setTopics] = useState(data.settings.topics.join('\n')), [error, setError] = useState('');
  const saving = operations.saving;
  const next = { ...values, topics: topics.split('\n').map((topic) => topic.trim()).filter(Boolean) };
  const changed = JSON.stringify(next) !== JSON.stringify(data.settings);
  async function save() {
    if (!changed || saving || !operations.canManageSettings) return;
    try { const result = await operations.perform('settings', next, data.version); if (result) { onSaved(); onClose(); } }
    catch (failure) { setError(getApiErrorMessage(failure)); }
  }
  return <Modal open title="Feedback settings" width={560} onClose={() => { if (!saving) onClose(); }} footer={<>
    <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
    <Button loading={saving} disabled={saving || !changed || !operations.canManageSettings} onClick={save}>Save</Button>
  </>}>
    <div style={{ display: 'grid', gap: 14 }}>
      {error && <Banner tone="danger" title="Couldn’t save settings">{error}</Banner>}
      <Checkbox label="Let people send feedback from the apps" checked={values.allowAppSubmissions} disabled={saving || !operations.canManageSettings} onChange={(checked) => setValues({ ...values, allowAppSubmissions: checked })} />
      <Checkbox label="Send an automatic “we got your feedback” notification" checked={values.autoAcknowledge} disabled={saving || !operations.canManageSettings} onChange={(checked) => setValues({ ...values, autoAcknowledge: checked })} />
      <Textarea label="Topics people can pick (one per line, up to 20)" rows={6} value={topics} disabled={saving || !operations.canManageSettings} onChange={(event) => setTopics(event.target.value)} />
    </div>
  </Modal>;
}
export function FeedbackSettingsDialog({ operations, onClose, onSaved }) {
  const query = useGetAdminFeedbackSettingsQuery({ owner: operations.owner }, { skip: !operations.authenticated, refetchOnMountOrArgChange: true });
  const data = operations.authenticated && !query.error ? query.currentData : null;
  if (query.isFetching || !data) return <Modal open title="Feedback settings" width={560} onClose={onClose} footer={<Button variant="outline" onClick={onClose}>Cancel</Button>}>
    {query.isFetching ? <Skeleton height={120} /> : <DriverLoadingNotice>{query.error ? getApiErrorMessage(query.error) : '—'}</DriverLoadingNotice>}
  </Modal>;
  return <FeedbackSettingsForm key={operations.owner + ':' + data.version} data={data} operations={operations} onClose={onClose} onSaved={onSaved} />;
}
