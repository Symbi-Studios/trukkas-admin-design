'use client';

import { useRef } from 'react';
import { useSelector } from 'react-redux';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';
import {
  useApproveAdminSettlementMutation, useRetryAdminSettlementMutation,
  useLazyGetAdminSettlementReceiptQuery, useLazyGetAdminSettlementReportQuery,
  canApproveSettlement, canRetrySettlement, saveSettlementPdf,
} from './settlementsApi.js';

export function useSettlementOperations() {
  const owner = useSelector((state) => state.auth.admin?.id);
  const role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const canManage = authenticated && ['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(role);
  const [approve, approveState] = useApproveAdminSettlementMutation();
  const [retry, retryState] = useRetryAdminSettlementMutation();
  const [receipt, receiptState] = useLazyGetAdminSettlementReceiptQuery();
  const [report, reportState] = useLazyGetAdminSettlementReportQuery();
  const operation = useRef(false), keys = useRef(new Map());
  const busy = approveState.isLoading || retryState.isLoading || receiptState.isFetching || reportState.isFetching;
  async function settle(row, action) {
    if (operation.current || busy) return;
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
      await (action === 'retry' ? retry : approve)({ row, idempotencyKey: keys.current.get(key) }).unwrap();
      keys.current.delete(key);
    } catch (error) {
      // Reuse the key after an ambiguous network failure; a click must not pay twice.
      if ([400, 403, 404, 409, 422].includes(error?.status)) keys.current.delete(key);
      window.alert(getApiErrorMessage(error));
    } finally { operation.current = false; }
  }
  async function download(row) {
    if (operation.current || busy || !authenticated) return;
    if (row.statusCode !== 'COMPLETED') { window.alert('Receipts are available for completed settlements only.'); return; }
    operation.current = true;
    try { saveSettlementPdf(await receipt({ id: row.id, owner }).unwrap(), 'settlement-receipt.pdf'); }
    catch (error) { window.alert(getApiErrorMessage(error)); }
    finally { operation.current = false; }
  }
  async function downloadReport() {
    if (operation.current || busy || !authenticated) return;
    operation.current = true;
    try { saveSettlementPdf(await report({ owner }).unwrap(), 'settlements-report.pdf'); }
    catch (error) { window.alert(getApiErrorMessage(error)); }
    finally { operation.current = false; }
  }
  return { owner, authenticated, canManage, busy, settle, download, downloadReport };
}
