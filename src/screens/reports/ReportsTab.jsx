'use client';

import { useState } from 'react';
import { Badge, Button, Icon, IconButton, Modal, Banner } from '../../ds.js';
import { useReportDraft } from '../../store/features/reports/useReportDraft.js';
import { REPORT_TYPES } from '../../store/features/reports/reportsConfig.js';
import { draftFromConfiguration, initialReportDraft } from '../../store/features/reports/reportDraft.js';
import { useLazyDownloadAdminReportExportQuery, saveReportFile } from '../../store/features/reports/reportsApi.js';
import {
  useGetAdminReportTemplatesQuery, useDeleteAdminReportTemplateMutation, useGetAdminReportSchedulesQuery,
  useSetAdminReportScheduleStatusMutation, useDeleteAdminReportScheduleMutation, useGetAdminReportExportsQuery,
} from '../../store/features/reports/reportLibraryApi.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { showToast } from '../../components/ActionToast.jsx';
import { Panel, Quiet, SectionStatus, TextLink, fmtCount, sectionState } from './analyticsShared.jsx';
import styles from './Analytics.module.css';

const STARTERS = [
  { key: 'blank', title: 'Blank report', note: 'Pick everything yourself', icon: 'plus', reportType: 'custom', preset: 'Last 30 days' },
  { key: 'ops', title: 'Weekly operations', note: 'Every job, last 7 days', icon: 'package', reportType: 'operations', preset: 'Last 7 days' },
  { key: 'fin', title: 'Monthly financial', note: 'Wallets with activity, this month', icon: 'wallet', reportType: 'financial', preset: 'This Month' },
  { key: 'ver', title: 'Verifications', note: 'Submissions, last 30 days', icon: 'shield-check', reportType: 'verification', preset: 'Last 30 days' },
  { key: 'comp', title: 'Compliance snapshot', note: 'Every entity, current state', icon: 'file-check-2', reportType: 'compliance', preset: 'Last 30 days' },
  { key: 'fleet', title: 'Fleet register', note: 'Trucks added, last 30 days', icon: 'truck', reportType: 'fleet', preset: 'Last 30 days' },
];

const typeTitle = (id) => REPORT_TYPES.find((t) => t.id === id)?.title || (id ? id[0].toUpperCase() + id.slice(1) : '—');
const day = (iso, withTime = false) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(iso)) : '—');
const size = (bytes) => (bytes == null ? '—' : bytes < 1000 ? `${bytes} B` : bytes < 1000000 ? `${(bytes / 1000).toFixed(0)} KB` : `${(bytes / 1000000).toFixed(1)} MB`);
const plural = (n, word) => `${fmtCount(n)} ${n === 1 ? word : word + 's'}`;

export function ReportsTab({ ctx }) {
  const { loadReportDraft } = useReportDraft();
  const scope = { owner: ctx.owner, role: ctx.role };
  const skip = !ctx.authenticated;
  const templates = sectionState(useGetAdminReportTemplatesQuery(scope, { skip }), ctx.authenticated);
  const schedules = sectionState(useGetAdminReportSchedulesQuery(scope, { skip }), ctx.authenticated);
  const [page, setPage] = useState(1);
  const exportsQuery = useGetAdminReportExportsQuery({ ...scope, page, limit: 10 }, { skip });
  const exportsState = sectionState(exportsQuery, ctx.authenticated);
  const [deleteTemplate, deletingTemplate] = useDeleteAdminReportTemplateMutation();
  const [setScheduleStatus, settingStatus] = useSetAdminReportScheduleStatusMutation();
  const [deleteSchedule, deletingSchedule] = useDeleteAdminReportScheduleMutation();
  const [download, downloading] = useLazyDownloadAdminReportExportQuery();
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState(null);
  const busy = deletingTemplate.isLoading || settingStatus.isLoading || deletingSchedule.isLoading;

  function open(draft, unsupported = []) {
    loadReportDraft(draft);
    if (unsupported.length) showToast('Opened with defaults for: ' + unsupported.join(', ') + '.', { tone: 'info' });
    ctx.navigate('/reports/export');
  }
  function openStarter(starter) {
    const base = initialReportDraft();
    const { draft } = draftFromConfiguration({ reportType: starter.reportType, dateRangePreset: { 'Last 7 days': 'last_7_days', 'Last 30 days': 'last_30_days', 'This Month': 'this_month' }[starter.preset] }, base);
    open(draft);
  }
  async function run(action, success) {
    setError(null);
    try { await action(); if (success) showToast(success); setConfirm(null); }
    catch (e) { setError(getApiErrorMessage(e)); }
  }
  async function getFile(row) {
    setError(null);
    try { saveReportFile(await download({ ...scope, file: row }).unwrap()); }
    catch (e) { setError(e?.status === 410 ? 'That file has expired. Generate the report again.' : getApiErrorMessage(e)); }
  }

  const now = Date.now();

  return (
    <div className={styles.stack}>
      {error && !confirm && <Banner tone="error" title={error} />}

      <section className={styles.starters} aria-label="Start a report">
        {STARTERS.map((s) => (
          <button key={s.key} type="button" className={styles.starter} onClick={() => openStarter(s)}>
            <span className={styles.starterIcon}><Icon name={s.icon} size={16} aria-hidden="true" /></span>
            <span className={styles.starterTitle}>{s.title}</span>
            <span className={styles.starterNote}>{s.note}</span>
          </button>
        ))}
      </section>

      <div className={styles.grid2}>
        <Panel title="Saved templates" description="Report setups you can open and run again">
          <SectionStatus state={templates}>
            {templates.data?.length ? (
              <ul className={styles.list}>
                {templates.data.map((t) => {
                  const columns = Array.isArray(t.configuration.columns) ? t.configuration.columns.length : null;
                  return (
                    <li key={t.id}>
                      <button type="button" className={styles.listMain} onClick={() => { const { draft, unsupported } = draftFromConfiguration(t.configuration); open(draft, unsupported); }}>
                        <span className={styles.listTitle}>{t.name}</span>
                        <span className={styles.listMeta}>
                          {[typeTitle(t.configuration.reportType), columns != null && plural(columns, 'column'), t.configuration.format, t.createdAt && 'saved ' + day(t.createdAt)].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                      {t.ownerId === ctx.owner && (
                        <IconButton icon="trash-2" label={'Delete ' + t.name} size={28} onClick={() => setConfirm({ kind: 'template', item: t })} />
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <Quiet>No saved templates yet. Set up a report, then choose Save as template.</Quiet>}
          </SectionStatus>
        </Panel>

        <Panel title="Scheduled" description="Reports emailed automatically at 07:00 Lagos time">
          <SectionStatus state={schedules}>
            {schedules.data?.length ? (
              <ul className={styles.list}>
                {schedules.data.map((s) => {
                  const paused = s.status === 'PAUSED';
                  return (
                    <li key={s.id}>
                      <div className={styles.listMain}>
                        <span className={styles.listTitle}>
                          {s.name}
                          {s.status && s.status !== 'ACTIVE' && <Badge tone={paused ? 'neutral' : 'danger'}>{paused ? 'Paused' : s.status[0] + s.status.slice(1).toLowerCase()}</Badge>}
                        </span>
                        <span className={styles.listMeta}>
                          {[s.runsAt || (s.frequency && s.frequency[0] + s.frequency.slice(1).toLowerCase()), plural(s.recipients.length, 'recipient'), !paused && s.nextRunAt && 'next ' + day(s.nextRunAt)].filter(Boolean).join(' · ')}
                        </span>
                        {s.lastError && <span className={styles.listError}>{s.lastError}</span>}
                      </div>
                      {(s.status === 'ACTIVE' || paused) && (
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => setScheduleStatus({ ...scope, id: s.id, status: paused ? 'ACTIVE' : 'PAUSED' }).unwrap(), paused ? 'Schedule resumed.' : 'Schedule paused.')}>
                          {paused ? 'Resume' : 'Pause'}
                        </Button>
                      )}
                      <IconButton icon="trash-2" label={'Delete ' + s.name} size={28} onClick={() => setConfirm({ kind: 'schedule', item: s })} />
                    </li>
                  );
                })}
              </ul>
            ) : <Quiet>Nothing scheduled. In a report, choose Schedule under Delivery.</Quiet>}
          </SectionStatus>
        </Panel>
      </div>

      <Panel title="Recent exports" description="Files are kept for 7 days" flush>
        <SectionStatus state={exportsState}>
          {exportsState.data?.rows.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Report</th><th>Format</th><th className={styles.num}>Rows</th><th className={styles.num}>Size</th><th>Created</th><th>Status</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {exportsState.data.rows.map((row) => {
                    const expired = row.expiresAt && Date.parse(row.expiresAt) <= now;
                    const ready = row.status === 'COMPLETED' && !expired;
                    return (
                      <tr key={row.id}>
                        <td><span className={styles.cellTitle}>{typeTitle(row.reportType)}</span><span className={styles.cellMeta}>{row.reportId || row.id}{row.scheduleId ? ' · scheduled' : ''}</span></td>
                        <td>{row.format ? row.format.replace('+', ' · ') : '—'}</td>
                        <td className={styles.num}>{fmtCount(row.rowCount)}</td>
                        <td className={styles.num}>{size(row.sizeBytes)}</td>
                        <td>{day(row.createdAt, true)}</td>
                        <td>
                          {row.status === 'FAILED' ? <span className={styles.listError} title={row.error || undefined}>Failed</span>
                            : row.status !== 'COMPLETED' ? <span className={styles.cellMeta}>{row.status ? row.status[0] + row.status.slice(1).toLowerCase() : '—'}</span>
                            : expired ? <span className={styles.cellMeta}>Expired</span>
                            : <span className={styles.cellMeta}>Expires {day(row.expiresAt)}</span>}
                        </td>
                        <td className={styles.num}>
                          {ready && <Button variant="ghost" size="sm" icon="download" disabled={downloading.isFetching} onClick={() => getFile(row)}>Download</Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {exportsState.data.totalPages > 1 && (
                <div className={styles.pager}>
                  <span>Page {page} of {exportsState.data.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= exportsState.data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </div>
          ) : <div className={styles.panelBody}><Quiet>No exports yet.</Quiet></div>}
        </SectionStatus>
      </Panel>

      <Modal open={Boolean(confirm)} onClose={() => { if (!busy) setConfirm(null); }}
        title={confirm?.kind === 'schedule' ? 'Delete this schedule?' : 'Delete this template?'}
        description={confirm ? `“${confirm.item.name}” will be removed${confirm.kind === 'schedule' ? ' and no more reports will be sent' : ''}. This can’t be undone.` : undefined}
        footer={<>
          <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy} onClick={() => run(
            () => (confirm.kind === 'schedule' ? deleteSchedule({ ...scope, id: confirm.item.id }) : deleteTemplate({ ...scope, id: confirm.item.id })).unwrap(),
            confirm.kind === 'schedule' ? 'Schedule deleted.' : 'Template deleted.',
          )}>{busy ? 'Deleting…' : 'Delete'}</Button>
        </>}>
        {error && <Banner tone="error" title={error} />}
      </Modal>
    </div>
  );
}
