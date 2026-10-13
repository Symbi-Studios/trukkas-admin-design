'use client';
import { useRef } from 'react';
import { useSelector } from 'react-redux';
import { useChangeAdminAnnouncementMutation } from './announcementsApi.js';
export function useAnnouncementOperations() {
  const admin = useSelector((state) => state.auth.admin), authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const [change, mutation] = useChangeAdminAnnouncementMutation();
  const pending = useRef(false), uncertain = useRef(false), current = useRef(admin); current.current = admin;
  async function perform(args) {
    if (pending.current || mutation.isLoading) return null;
    if (!authenticated || !admin?.id) throw new Error('Please sign in before changing announcements.');
    if (uncertain.current) throw new Error('A previous write could not be confirmed. Reload and inspect the announcement before sending another request.');
    pending.current = true;
    try { const result = await change({ ...args, owner: admin.id }).unwrap(); return current.current === admin ? result : null; }
    catch (error) { if (error?.data?.writeSent || ['FETCH_ERROR', 'TIMEOUT_ERROR', 'PARSING_ERROR'].includes(error?.status) || typeof error?.status === 'number' && error.status >= 500) uncertain.current = true; throw error; }
    finally { pending.current = false; }
  }
  return { perform, saving: mutation.isLoading, admin, owner: admin?.id, authenticated };
}
