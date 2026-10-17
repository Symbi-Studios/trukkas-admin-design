'use client';

import { useRef } from 'react';
import { useSelector } from 'react-redux';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';
import {
  useSetAdminFeeRuleStatusMutation, useLazyGetAdminFeeRulesExportQuery,
  useLazyGetAdminFeeRuleExportQuery, useLazyGetAdminFeeReportQuery, editableFeeRule, saveFeeDocument,
} from './feesApi.js';

export function useFeeOperations() {
  const owner = useSelector((state) => state.auth.admin?.id);
  const role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const canManage = authenticated && ['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(role);
  const [setStatus, statusState] = useSetAdminFeeRuleStatusMutation();
  const [exportRules, rulesExportState] = useLazyGetAdminFeeRulesExportQuery();
  const [exportRule, ruleExportState] = useLazyGetAdminFeeRuleExportQuery();
  const [report, reportState] = useLazyGetAdminFeeReportQuery();
  const pending = useRef(false), currentOwner = useRef(owner);
  currentOwner.current = owner;
  const busy = statusState.isLoading || rulesExportState.isFetching || ruleExportState.isFetching || reportState.isFetching;
  const unavailable = (feature) => window.alert(feature + ' is not supported by the backend.');
  async function toggle(rule) {
    if (pending.current || busy) return;
    if (!canManage) { window.alert('Fee changes require Super Admin or Finance Admin access.'); return; }
    if (!editableFeeRule(rule) || !['ACTIVE', 'INACTIVE'].includes(rule.statusCode)) { unavailable('Changing this fee rule'); return; }
    pending.current = true;
    try { await setStatus({ rule, status: rule.statusCode === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }).unwrap(); }
    catch (error) { if (currentOwner.current === owner) window.alert(getApiErrorMessage(error)); }
    finally { pending.current = false; }
  }
  async function download(kind, format = 'csv', rule, filters) {
    if (pending.current || busy || !authenticated) return;
    pending.current = true;
    try {
      const result = await (kind === 'rule' ? exportRule({ id: rule.id, format, owner }) : kind === 'report' ? report({ format, period: filters?.period ?? 'month', owner }) : exportRules({ format, filters, owner })).unwrap();
      if (currentOwner.current === owner) saveFeeDocument(result, kind === 'rule' ? 'fee-rule' : kind === 'report' ? 'fee-report' : 'fee-rules');
    } catch (error) { if (currentOwner.current === owner) window.alert(getApiErrorMessage(error)); }
    finally { pending.current = false; }
  }
  return { owner, authenticated, canManage, busy, toggle, download, unavailable };
}
