'use client';

import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useGetAdminRegistrationFieldsQuery, useGetAdminRegistrationSummaryQuery, useGetAdminRegistrationMetaQuery, useCreateAdminRegistrationFieldMutation, useUpdateAdminRegistrationFieldMutation, useDeleteAdminRegistrationFieldMutation, useDuplicateAdminRegistrationFieldMutation, useReorderAdminRegistrationFieldsMutation, useBulkUpdateAdminRegistrationFieldsMutation } from './registrationFieldsApi.js';
import { registrationFieldsError } from './registrationFieldsContracts.js';

const EMPTY = [];
export function useRegistrationFields(entity) {
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const owner = admin?.id, skip = !owner || !authenticated;
  const options = { skip, refetchOnMountOrArgChange: true };
  const list = useGetAdminRegistrationFieldsQuery({ owner, entity }, options);
  const summary = useGetAdminRegistrationSummaryQuery({ owner }, options);
  const meta = useGetAdminRegistrationMetaQuery({ owner }, options);
  const [create] = useCreateAdminRegistrationFieldMutation();
  const [update] = useUpdateAdminRegistrationFieldMutation();
  const [remove] = useDeleteAdminRegistrationFieldMutation();
  const [duplicate] = useDuplicateAdminRegistrationFieldMutation();
  const [reorder] = useReorderAdminRegistrationFieldsMutation();
  const [bulk] = useBulkUpdateAdminRegistrationFieldsMutation();
  const lock = useRef(false), current = useRef(null);
  const [busy, setBusy] = useState(false);
  current.current = { admin, entity, authenticated };
  const fields = !skip && !list.error ? list.currentData : null;
  const metadata = !skip && !meta.error ? meta.currentData : null;
  const ready = Boolean(fields && metadata && !list.isFetching && !meta.isFetching);
  async function perform(trigger, args) {
    if (lock.current) throw new Error('Wait for the current change to finish.');
    if (skip) throw new Error('Please sign in again before using Settings.');
    if (admin.role !== 'SUPER_ADMIN') throw new Error('Only Super Admins can change registration fields.');
    if (!ready) throw new Error('Wait for the current settings to finish loading.');
    const check = () => {
      if (current.current.admin !== admin || current.current.entity !== entity || !current.current.authenticated) throw new Error('The form or admin session changed. Reload before continuing.');
    };
    lock.current = true; setBusy(true);
    try {
      const result = await trigger({ owner, entity, ...args }).unwrap();
      check();
      // Refetch the whole form: create/delete/update can renumber other rows.
      try { await list.refetch().unwrap(); }
      catch { throw new Error('The change was sent, but the updated form could not be loaded. Reload before trying again.'); }
      check();
      return result;
    } catch (error) { throw registrationFieldsError(error); }
    finally { lock.current = false; setBusy(false); }
  }
  return {
    owner, fields: fields || EMPTY, available: fields != null, ready, busy,
    loading: !skip && !fields && !list.error,
    error: list.error || summary.error || meta.error,
    counts: !skip && !summary.error ? summary.currentData : null,
    metadata,
    save: (draft, original) => perform(original ? update : create, { draft, original, id: original?.id }),
    toggle: (field, enabled) => perform(update, { id: field.id, original: field, draft: { ...field, enabled } }),
    remove: (field) => perform(remove, { id: field.id }),
    duplicate: (field) => perform(duplicate, { id: field.id }),
    reorder: (fieldIds) => perform(reorder, { fieldIds }),
    bulk: (fieldIds, changes) => perform(bulk, { fieldIds, changes }),
  };
}
