'use client';

import { useRef } from 'react';
import { useSelector } from 'react-redux';
import { useChangeAdminRoleMutation } from './rolesApi.js';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';

export function useRoleOperations() {
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const owner = admin?.id;
  const canManage = Boolean(owner && authenticated && ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(admin?.role));
  const [change, mutation] = useChangeAdminRoleMutation();
  const pending = useRef(false), currentOwner = useRef(owner);
  currentOwner.current = owner;
  async function perform(args) {
    if (pending.current || mutation.isLoading) return null;
    if (!canManage) throw new Error('An active admin session is required.');
    pending.current = true;
    try {
      const result = await change({ ...args, owner }).unwrap();
      return currentOwner.current === owner ? result : null;
    } finally { pending.current = false; }
  }
  async function performWithAlert(args) {
    try { return await perform(args); }
    catch (error) { if (currentOwner.current === owner) window.alert(error instanceof Error ? error.message : getApiErrorMessage(error)); return null; }
  }
  return { owner, authenticated: canManage, canManage, saving: mutation.isLoading, perform, performWithAlert };
}
