'use client';
import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useChangeAdminFeedbackMutation, useLazyDownloadAdminFeedbackQuery, saveFeedbackCsv } from './feedbackApi.js';

export function useFeedbackOperations(id = '') {
  const owner = useSelector((state) => state.auth.admin?.id), role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const [change, mutation] = useChangeAdminFeedbackMutation(), [requestDownload, downloadState] = useLazyDownloadAdminFeedbackQuery();
  const lock = useRef(false), keys = useRef(new Map()), currentScope = useRef(null);
  const scope = [owner || '', role || '', id].join(':');
  currentScope.current = scope;
  useEffect(() => { currentScope.current = scope; keys.current.clear(); return () => { currentScope.current = null; }; }, [scope]);
  async function perform(action, values = {}, expectedVersion) {
    if (lock.current || mutation.isLoading) return null;
    if (!authenticated) throw new Error('An active admin session is required.');
    const signature = JSON.stringify({ scope, action, values, expectedVersion });
    let key;
    if (['create', 'reply', 'spam'].includes(action)) {
      key = keys.current.get(signature);
      if (!key) {
        if (!globalThis.crypto?.randomUUID) throw new Error('A secure idempotency key could not be created.');
        key = crypto.randomUUID(); keys.current.set(signature, key);
      }
    }
    lock.current = true;
    try {
      const result = await change({ owner, id, action, values, expectedVersion, ...(key ? { idempotencyKey: key } : {}) }).unwrap();
      keys.current.delete(signature);
      return currentScope.current === scope ? result : null;
    } catch (error) { if (currentScope.current !== scope) return null; throw error; }
    finally { lock.current = false; }
  }
  async function download(filters) {
    if (lock.current || !authenticated) return;
    lock.current = true;
    try { const result = await requestDownload({ owner, ...filters }).unwrap(); if (currentScope.current === scope) { saveFeedbackCsv(result); return { truncated: result.truncated, exportedCount: result.exportedCount, matchingCount: result.matchingCount }; } return null; }
    catch (error) { if (currentScope.current !== scope) return; throw error; }
    finally { lock.current = false; }
  }
  return { owner, role, authenticated, saving: mutation.isLoading, downloading: downloadState.isFetching,
    canManageSettings: authenticated && ['SUPER_ADMIN', 'OPS_ADMIN'].includes(role), perform, download };
}
