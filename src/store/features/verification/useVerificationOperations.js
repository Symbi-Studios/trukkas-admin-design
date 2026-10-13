'use client';

import { useRef } from 'react';
import { useSelector } from 'react-redux';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';
import { useLazyGetAdminVerificationDownloadQuery, saveVerificationDocument, canManageVerification } from './verificationApi.js';

export function useVerificationOperations() {
  const owner = useSelector((state) => state.auth.admin?.id);
  const role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const [requestDownload, downloadState] = useLazyGetAdminVerificationDownloadQuery();
  const pending = useRef(false), currentOwner = useRef(owner);
  currentOwner.current = owner;
  async function download(id, kind = 'report', filters) {
    if (pending.current || !authenticated) return;
    pending.current = true;
    try { const data = await requestDownload({ id, kind, filters, owner }).unwrap(); if (currentOwner.current === owner) saveVerificationDocument(data); }
    catch (error) { if (currentOwner.current === owner) window.alert(getApiErrorMessage(error)); }
    finally { pending.current = false; }
  }
  return { owner, role, authenticated, canManage: authenticated && canManageVerification(role), download, downloading: downloadState.isFetching };
}
