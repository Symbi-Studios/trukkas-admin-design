'use client';

import { useRef } from 'react';
import { useSelector } from 'react-redux';
import { useChangeAdminRoleMutation, useGetAdminRoleAccessLevelsQuery } from './rolesApi.js';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';

export function useRoleOperations() {
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const owner = admin?.id;
  const canRead = Boolean(owner && authenticated && ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(admin?.role));
  const access = useGetAdminRoleAccessLevelsQuery({ owner }, { skip: !canRead, refetchOnMountOrArgChange: true });
  const allowed = action => canRead && !access.error && ['SUPER_ADMIN', 'OPS_ADMIN'].includes(admin?.role)
    && access.currentData?.operations[action]?.includes(admin.role) === true;
  const canManage = ['create', 'edit', 'duplicate'].every(allowed);
  const canDelete = allowed('delete');
  const [change, mutation] = useChangeAdminRoleMutation();
  const pending = useRef(false), currentOwner = useRef(owner);
  currentOwner.current = owner;
  async function perform(args) {
    if (pending.current || mutation.isLoading) return null;
    if (!allowed(args.action)) throw new Error('Your admin access level does not allow this role operation.');
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
  return { owner, authenticated: canRead, canManage, canDelete, saving: mutation.isLoading, perform, performWithAlert };
}
