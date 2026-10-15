'use client';

import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';
import { useLazyGetAdminVerificationDownloadQuery, saveVerificationDocument, canManageVerification } from './verificationApi.js';

export function useVerificationOperations() {
  const owner = useSelector((state) => state.auth.admin?.id);
  const role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const [requestDownload, downloadState] = useLazyGetAdminVerificationDownloadQuery();
  const scope = [owner, role, authenticated].join(':');
  const pending = useRef(false), currentScope = useRef(scope), active = useRef(true);
  currentScope.current = scope;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function download(id, kind = 'report', filters) {
    if (pending.current || !authenticated) return;
    pending.current = true;
    try { const data = await requestDownload({ id, kind, filters, owner, role }).unwrap(); if (active.current && currentScope.current === scope) saveVerificationDocument(data); }
    catch (error) { if (active.current && currentScope.current === scope) window.alert(getApiErrorMessage(error)); }
    finally { pending.current = false; }
  }
  return { owner, role, authenticated, canManage: authenticated && canManageVerification(role), download, downloading: downloadState.isFetching };
}
