'use client';

import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import { useGetAdminSystemSettingsQuery, useGetAdminSettingsPreferencesQuery, useSaveAdminSettingsSectionMutation, findSettingsField } from '../store/features/settings/settingsApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

export function useSettingsEditor(page) {
  const admin = useSelector((state) => state.auth.admin);
  const role = admin?.role, owner = admin?.id;
  const navigate = useNavigate();
  const configPage = ['general', 'finance'].includes(page), personal = page === 'notifications';
  const config = useGetAdminSystemSettingsQuery(undefined, { skip: !configPage, refetchOnMountOrArgChange: true });
  const preferences = useGetAdminSettingsPreferencesQuery(owner, { skip: !personal || !owner, refetchOnMountOrArgChange: true });
  const query = personal ? preferences : configPage ? config : null;
  const [saveSettings, mutation] = useSaveAdminSettingsSectionMutation();
  const [draftState, setDraftState] = useState({ owner, groups: {} });
  const draft = draftState.owner === owner ? draftState.groups : {};
  const submitting = useRef(false);
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const values = query?.error ? null : query?.currentData?.values;
  const unavailable = (action) => window.alert(`${action} is not supported by the documented settings API.`);

  function group(name) {
    if (name === 'settingsMeta') return { lastUpdated: '—', updatedBy: '—' };
    return { ...values?.[name], ...draft[name] };
  }
  function change(name) {
    return (changes) => {
      if (submitting.current) return;
      if (query?.error) { window.alert(getApiErrorMessage(query.error)); return; }
      const fields = Object.keys(changes);
      if (fields.some((field) => !findSettingsField(page, name, field))) { unavailable('Changing this setting'); return; }
      if (personal ? !['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(role) : role !== 'SUPER_ADMIN') { window.alert(personal ? 'Admin access is required.' : 'Only Super Admins can change platform configuration.'); return; }
      // These are unsaved form edits. Only a confirmed mutation can report Saved.
      setDraftState((current) => {
        const groups = current.owner === owner ? current.groups : {};
        return { owner, groups: { ...groups, [name]: { ...groups[name], ...changes } } };
      });
    };
  }
  async function save(onlyGroup) {
    if (submitting.current || mutation.isLoading) return false;
    if (!query) { unavailable('Saving these settings'); return false; }
    if (query.isFetching) { window.alert('Wait for the current settings to finish loading.'); return false; }
    if (query.error) { window.alert(getApiErrorMessage(query.error)); return false; }
    const changes = Object.entries(draft).flatMap(([name, fields]) => onlyGroup && name !== onlyGroup ? []
      : Object.entries(fields).filter(([field, value]) => value !== values?.[name]?.[field]).map(([field, value]) => ({ group: name, field, value })));
    if (!changes.length) { window.alert('There are no supported changes to save.'); return false; }
    submitting.current = true;
    try {
      await saveSettings({ page, changes }).unwrap();
      if (currentOwner.current !== owner) return false;
      setDraftState((current) => {
        if (current.owner !== owner) return current;
        const next = { ...current.groups };
        for (const change of changes) {
          const fields = { ...next[change.group] };
          if (fields[change.field] === change.value) delete fields[change.field];
          next[change.group] = fields;
        }
        return { owner, groups: next };
      });
      return true;
    } catch (error) { window.alert(getApiErrorMessage(error)); return false; }
    finally { submitting.current = false; }
  }
  function quickActions(items, handlers = {}) {
    const destinations = { 'Set Default Pricing Rules': '/pricing', 'Configure Notifications': '/settings/notifications', 'Manage Integrations': '/settings/integrations', 'Manage User Roles': '/roles', 'Review Active Sessions': '/settings/passwords', 'View Audit Logs': '/audit' };
    return items.map((item) => ({ ...item, onClick: () => {
      if (item.label === 'View Audit Logs' && role !== 'SUPER_ADMIN') { window.alert('Only Super Admins can view audit logs.'); return; }
      if (handlers[item.label]) { handlers[item.label](); return; }
      const path = destinations[item.label];
      if (path) navigate(path); else unavailable(item.label);
    } }));
  }
  return { group, change, save, unavailable, quickActions, loading: Boolean(query?.isLoading || (query?.isFetching && !query.currentData)), error: query?.error, saving: mutation.isLoading };
}
