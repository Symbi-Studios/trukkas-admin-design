'use client';

import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';
import { reportConfiguration, reportEmails, reportTimestamp, validReportEmails } from './reportContracts.js';
import { REPORT_TYPES } from './reportsConfig.js';
import { useCreateAdminReportExportMutation, useSaveAdminReportTemplateMutation, useScheduleAdminReportMutation, useLazyDownloadAdminReportExportQuery, saveReportFile } from './reportsApi.js';

export function useReportSession() {
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  return { admin, owner: admin?.id, authenticated };
}
export function useReportOperations(draft) {
  const session = useReportSession(), { admin, owner, authenticated } = session;
  const [createExport, exporting] = useCreateAdminReportExportMutation();
  const [saveTemplate, saving] = useSaveAdminReportTemplateMutation();
  const [createSchedule, scheduling] = useScheduleAdminReportMutation();
  const [download, downloading] = useLazyDownloadAdminReportExportQuery();
  const [error, setError] = useState(null), [generated, setGenerated] = useState(null);
  const pending = useRef(false), fileCache = useRef(null), currentOwner = useRef(owner);
  currentOwner.current = owner;
  const config = reportConfiguration(draft, admin, 'export');
  const key = config.configuration ? JSON.stringify(config.configuration) : null;
  const busy = exporting.isLoading || saving.isLoading || scheduling.isLoading || downloading.isFetching;
  async function run(action) {
    if (pending.current || !authenticated) return false;
    pending.current = true; setError(null);
    try { await action(); return true; }
    catch (requestError) { if (currentOwner.current === owner) { const message = requestError instanceof Error ? requestError.message : getApiErrorMessage(requestError); setError({ owner, message }); window.alert(message); } return false; }
    finally { pending.current = false; }
  }
  async function schedule(form, configuration) {
    const recipients = reportEmails(form.recipients);
    if (!validReportEmails(recipients)) throw new Error('Enter valid email recipients separated by commas.');
    const frequency = form.frequency.toUpperCase(), type = REPORT_TYPES.find((r) => r.id === form.reportType);
    if (!type) throw new Error('Choose a supported report type.');
    if (form.reportType === 'audit' && admin?.role !== 'SUPER_ADMIN') throw new Error('Audit reports require Super Admin access.');
    const data = await createSchedule({ owner, name: type.title + ' — ' + form.frequency, reportType: form.reportType, frequency, recipients, configuration }).unwrap();
    if (currentOwner.current === owner) window.alert(data.runsAt || (data.nextRunAt ? 'Next report: ' + reportTimestamp(data.nextRunAt) : 'Report schedule created.'));
  }
  function scheduleDashboard(form, filters) {
    return run(() => schedule(form, { filters, format: 'XLSX', fileSettings: { includeCharts: true, includeSummary: true, compressFile: false } }));
  }
  function save(name) {
    return run(async () => {
      const result = reportConfiguration(draft, admin, 'template');
      if (result.error) throw new Error(result.error);
      await saveTemplate({ owner, name, configuration: result.configuration }).unwrap();
    });
  }
  function exportReport(preview) {
    return run(async () => {
      if (!preview?.available || !preview.canExport) throw new Error('This report is unavailable or exceeds the 10,000-row export limit. Narrow the filters before exporting.');
      const result = reportConfiguration(draft, admin, 'export');
      if (result.error) throw new Error(result.error);
      const configuration = result.configuration, configurationKey = JSON.stringify(configuration);
      if (draft.delivery === 'schedule') {
        const { dateRangePreset: _preset, dateFrom: _from, dateTo: _to, ...recurring } = configuration;
        await schedule({ reportType: draft.reportType, frequency: draft.scheduleFrequency, recipients: configuration.delivery.recipients }, recurring);
        return;
      }
      let file = fileCache.current?.owner === owner && fileCache.current.key === configurationKey && fileCache.current.file.status === 'COMPLETED' && draft.delivery === 'download' ? fileCache.current.file : null;
      if (file?.expiresAt && new Date(file.expiresAt).getTime() <= Date.now()) file = null;
      if (!file) {
        file = await createExport({ owner, configuration }).unwrap();
        if (currentOwner.current !== owner) return;
        fileCache.current = { owner, key: configurationKey, file };
        setGenerated({ owner, key: configurationKey, file });
      }
      if (file.status !== 'COMPLETED') throw new Error(file.error || 'The report file could not be generated.');
      if (configuration.fileSettings.compressFile && !file.contentType?.includes('zip') && !file.filename?.toLowerCase().endsWith('.zip')) throw new Error('The backend did not confirm the requested ZIP compression.');
      if (draft.delivery === 'email') {
        if (file.deliveryStatus !== 'SENT' || !Array.isArray(file.deliveredTo) || configuration.delivery.recipients.some((email) => !file.deliveredTo.includes(email))) throw new Error(file.deliveryError || 'The report was generated, but email delivery is ' + (file.deliveryStatus || 'unconfirmed') + '.');
        window.alert('Report link sent to your email.');
      } else {
        try {
          const data = await download({ owner, file }).unwrap();
          if (currentOwner.current === owner) saveReportFile(data);
        } catch (error) {
          if (error?.status === 410) { fileCache.current = null; if (currentOwner.current === owner) setGenerated(null); }
          throw error;
        }
      }
    });
  }
  return { ...session, busy, error: error?.owner === owner ? error.message : null, clearError: () => setError(null), save, scheduleDashboard, exportReport,
    generated: generated?.owner === owner && generated.key === key ? generated.file : null };
}
