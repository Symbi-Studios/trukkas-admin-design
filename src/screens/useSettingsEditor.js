'use client';

import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import { useGetAdminSystemSettingsQuery, useGetAdminSettingsPreferencesQuery, useGetAdminSettingsStatusQuery, useGetAdminSettingsVersionQuery, useGetAdminSettingsChannelsQuery, useGetAdminSettingsProcessorsQuery, useGetAdminSettingsEventsQuery, useSaveAdminSettingsSectionMutation, useResetAdminSettingsSectionMutation, useResetAllAdminSettingsMutation, useTestAdminSettingsNotificationMutation } from '../store/features/settings/settingsApi.js';
import { canEditSettings, statusForTemplate } from '../store/features/settings/settingsContracts.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

export function useSettingsEditor(page) {
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const owner = admin?.id, role = admin?.role, personal = page === 'notifications';
  const skip = !owner || !authenticated;
  const navigate = useNavigate();
  const config = useGetAdminSystemSettingsQuery({ page, owner }, { skip: skip || personal, refetchOnMountOrArgChange: true });
  const preferences = useGetAdminSettingsPreferencesQuery({ owner }, { skip: skip || !personal, refetchOnMountOrArgChange: true });
  const status = useGetAdminSettingsStatusQuery({ page, owner }, { skip: skip || personal, refetchOnMountOrArgChange: true });
  const version = useGetAdminSettingsVersionQuery({ owner }, { skip: skip || page !== 'general', refetchOnMountOrArgChange: true });
  const channels = useGetAdminSettingsChannelsQuery({ owner }, { skip: skip || !personal, refetchOnMountOrArgChange: true });
  const processors = useGetAdminSettingsProcessorsQuery({ owner }, { skip: skip || page !== 'data-protection', refetchOnMountOrArgChange: true });
  const events = useGetAdminSettingsEventsQuery({ owner, page: 1, limit: 5 }, { skip: skip || !['security', 'security-alerts'].includes(page), refetchOnMountOrArgChange: true });
  const query = personal ? preferences : config;
  const [saveSettings, mutation] = useSaveAdminSettingsSectionMutation();
  const [resetSettings, resetMutation] = useResetAdminSettingsSectionMutation();
  const [resetAllSettings, resetAllMutation] = useResetAllAdminSettingsMutation();
  const [testNotification, testMutation] = useTestAdminSettingsNotificationMutation();
  const [draftState, setDraftState] = useState(null);
  const draft = draftState?.admin === admin && draftState.page === page ? draftState : null;
  const busy = useRef(false), currentAdmin = useRef(admin);
  currentAdmin.current = admin;
  const model = query.error ? null : query.currentData;
  const values = draft?.baseValues || model?.values;
  const unavailable = (action) => window.alert(action + ' is not supported by the documented settings API.');
  function group(name) {
    if (name === 'settingsMeta') return model?.meta || { lastUpdated: '—', updatedBy: '—' };
    return { ...values?.[name], ...draft?.groups[name] };
  }
  function change(name) {
    return (changes) => {
      if (busy.current || skip) return;
      if (query.error) { window.alert(getApiErrorMessage(query.error)); return; }
      if (!model || query.isFetching) { window.alert('Wait for the current settings to finish loading.'); return; }
      if (!canEditSettings(page, role)) { window.alert('Your admin access level cannot change this settings section.'); return; }
      const contracts = Object.keys(changes).map((field) => model.contracts[name + '.' + field]);
      if (contracts.some((contract) => !contract?.editable)) { unavailable('Changing this fixed or unavailable setting'); return; }
      setDraftState((current) => {
        const prior = current?.admin === admin && current.page === page ? current : { admin, page, groups: {}, version: model.version, baseValues: model.values };
        return { ...prior, groups: { ...prior.groups, [name]: { ...prior.groups[name], ...changes } } };
      });
    };
  }
  async function save(onlyGroup) {
    if (busy.current || mutation.isLoading || skip) return false;
    if (query.isFetching) { window.alert('Wait for the current settings to finish loading.'); return false; }
    if (query.error) { window.alert(getApiErrorMessage(query.error)); return false; }
    const changes = Object.entries(draft?.groups || {}).flatMap(([name, fields]) => onlyGroup && name !== onlyGroup ? [] : Object.entries(fields).filter(([field, value]) => value !== draft.baseValues?.[name]?.[field]).map(([field, value]) => ({ group: name, field, value })));
    if (!changes.length) { window.alert('There are no supported changes to save.'); return false; }
    busy.current = true;
    try {
      const result = await saveSettings({ page, changes, owner, expectedVersion: draft.version }).unwrap();
      if (currentAdmin.current !== admin) return false;
      setDraftState((current) => {
        if (current?.admin !== admin) return current;
        const groups = { ...current.groups };
        for (const change of changes) { const fields = { ...groups[change.group] }; delete fields[change.field]; groups[change.group] = fields; }
        return { ...current, groups, version: result.section.version, baseValues: result.section.values };
      });
      if (result.savedOnly) window.alert('Preferences saved. Some of these settings are stored only and do not affect platform behavior or notification delivery yet.');
      return true;
    } catch (error) { if (currentAdmin.current === admin) window.alert(getApiErrorMessage(error)); return false; }
    finally { busy.current = false; }
  }
  async function reset() {
    if (busy.current || skip) return false;
    if (query.isFetching || query.error || !model) { window.alert(query.error ? getApiErrorMessage(query.error) : 'Wait for the current settings to finish loading.'); return false; }
    busy.current = true;
    try {
      await resetSettings({ page, owner, expectedVersion: model.version }).unwrap();
      if (currentAdmin.current !== admin) return false;
      setDraftState(null); window.alert('Settings reset to their documented defaults.'); return true;
    } catch (error) { if (currentAdmin.current === admin) window.alert(getApiErrorMessage(error)); return false; }
    finally { busy.current = false; }
  }
  async function testEmail() {
    if (busy.current || skip) return;
    busy.current = true;
    try { const result = await testNotification({ owner }).unwrap(); if (currentAdmin.current === admin) window.alert('Test email sent to ' + result.recipient + '.'); }
    catch (error) { if (currentAdmin.current === admin) window.alert(getApiErrorMessage(error)); }
    finally { busy.current = false; }
  }
  async function resetAll() {
    if (busy.current || skip) return false;
    busy.current = true;
    try {
      await resetAllSettings({ owner }).unwrap();
      if (currentAdmin.current !== admin) return false;
      setDraftState(null); window.alert('Settings reset to their documented defaults.'); return true;
    } catch (error) { if (currentAdmin.current === admin) window.alert(getApiErrorMessage(error)); return false; }
    finally { busy.current = false; }
  }
  function quickActions(items, handlers = {}) {
    const destinations = { 'Set Default Pricing Rules': '/pricing', 'Configure Notifications': '/settings/notifications', 'Manage Integrations': '/settings/integrations', 'Manage User Roles': '/roles', 'Review Active Sessions': '/settings/passwords', 'View Audit Logs': '/audit' };
    return items.map((item) => ({ ...item, onClick: () => {
      if (item.label === 'View Audit Logs' && role !== 'SUPER_ADMIN') { window.alert('Only Super Admins can view audit logs.'); return; }
      if (handlers[item.label]) { handlers[item.label](); return; }
      if (item.label === 'Test Notification') { void testEmail(); return; }
      const path = destinations[item.label];
      if (path) navigate(path); else unavailable(item.label);
    } }));
  }
  const loading = [query, status, version, channels, processors, events].some((read) => read.isLoading || (read.isFetching && !read.currentData));
  return { group, change, save, reset, resetAll, unavailable, quickActions, owner, admin, authenticated: !skip,
    status: (template) => statusForTemplate(status.error ? null : status.currentData, template),
    platformVersion: version.error ? null : version.currentData,
    channels: channels.error ? null : channels.currentData,
    processors: processors.error ? [] : processors.currentData || [],
    events: events.error ? [] : events.currentData?.rows || [],
    loading, error: query.error || status.error || version.error || channels.error || processors.error || events.error,
    saving: mutation.isLoading || resetMutation.isLoading || resetAllMutation.isLoading || testMutation.isLoading,
  };
}
