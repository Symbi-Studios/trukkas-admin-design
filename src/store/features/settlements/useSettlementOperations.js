'use client';

import { useEffect, useRef } from 'react';
import { useSelector, useStore } from 'react-redux';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';
import {
  useApproveAdminSettlementMutation, useRetryAdminSettlementMutation,
  useLazyGetAdminSettlementReceiptQuery, useLazyGetAdminSettlementReportQuery,
  canApproveSettlement, canRetrySettlement, saveSettlementPdf,
} from './settlementsApi.js';

export function useSettlementOperations() {
  const store = useStore(), active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const owner = useSelector((state) => state.auth.admin?.id);
  const role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const canManage = authenticated && ['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(role);
  const [approve, approveState] = useApproveAdminSettlementMutation();
  const [retry, retryState] = useRetryAdminSettlementMutation();
  const [receipt, receiptState] = useLazyGetAdminSettlementReceiptQuery();
  const [report, reportState] = useLazyGetAdminSettlementReportQuery();
  const operation = useRef(false), keys = useRef(new Map());
  const sameSession = () => active.current && Boolean(store.getState().auth.accessToken) && store.getState().auth.admin?.id === owner && store.getState().auth.admin?.role === role;
  const busy = approveState.isLoading || retryState.isLoading || receiptState.isFetching || reportState.isFetching;
  async function settle(row, action) {
    if (operation.current || busy || !sameSession()) return;
    if (!canManage) { window.alert('Settlement approval and retry require Super Admin or Finance Admin access.'); return; }
    if (!(action === 'retry' ? canRetrySettlement(row) : canApproveSettlement(row))) {
      window.alert(row.allocated ? 'Open the settlement detail to act on the full settlement.' : row.eligibilityReason || 'This settlement cannot perform that action. Refresh its details.'); return;
    }
    const key = JSON.stringify([owner, row.id, row.version, action]);
    if (!keys.current.has(key)) {
      if (!globalThis.crypto?.randomUUID) { window.alert('This browser cannot generate a secure settlement request key.'); return; }
      keys.current.set(key, globalThis.crypto.randomUUID());
    }
    operation.current = true;
    try {
      await (action === 'retry' ? retry : approve)({ row, owner, role, idempotencyKey: keys.current.get(key) }).unwrap();
      keys.current.delete(key);
    } catch (error) {
      // Reuse the key after an ambiguous network failure; a click must not pay twice.
      if ([400, 403, 404, 409, 422].includes(error?.status)) keys.current.delete(key);
      if (sameSession()) window.alert(getApiErrorMessage(error));
    } finally { operation.current = false; }
  }
  async function download(row) {
    if (operation.current || busy || !authenticated || !sameSession()) return;
    if (row.statusCode !== 'COMPLETED') { window.alert('Receipts are available for completed settlements only.'); return; }
    operation.current = true;
    try { const result = await receipt({ id: row.id, owner, role }).unwrap(); if (sameSession()) saveSettlementPdf(result, 'settlement-receipt.pdf'); }
    catch (error) { if (sameSession()) window.alert(getApiErrorMessage(error)); }
    finally { operation.current = false; }
  }
  async function downloadReport(dateParams = {}) {
    if (operation.current || busy || !authenticated || !sameSession()) return;
    operation.current = true;
    try { const result = await report({ owner, role, dateFrom:dateParams.dateFrom, dateTo:dateParams.dateTo }).unwrap(); if (sameSession()) saveSettlementPdf(result, 'settlements-report.pdf'); }
    catch (error) { if (sameSession()) window.alert(getApiErrorMessage(error)); }
    finally { operation.current = false; }
  }
  return { owner, role, authenticated, canManage, busy, settle, download, downloadReport };
}
