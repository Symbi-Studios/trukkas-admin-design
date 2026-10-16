'use client';

import { useEffect, useState } from 'react';
import { usePreviewAdminReportQuery, useGetAdminReportMetaQuery, unavailableReportPreview } from './reportsApi.js';
import { useReportSession } from './useReportOperations.js';
import { reportConfiguration } from './reportContracts.js';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';

export function useReportPreview(draft, page = 1, limit = 10) {
  const session = useReportSession();
  const config = reportConfiguration(draft, session.admin);
  const meta = useGetAdminReportMetaQuery({ owner: session.owner, role: session.role }, { skip: !session.authenticated, refetchOnMountOrArgChange: true });
  const metadata = session.authenticated && !meta.error ? meta.currentData : null;
  const key = config.configuration && metadata ? JSON.stringify({ configuration: config.configuration, page, limit, owner: session.owner, role: session.role, metadata }) : null;
  const [stableKey, setStableKey] = useState(key);
  const pending = key !== stableKey;
  useEffect(() => { if (key === stableKey) return; const timer = setTimeout(() => setStableKey(key), 300); return () => clearTimeout(timer); }, [key, stableKey]);
  const query = usePreviewAdminReportQuery(stableKey ? JSON.parse(stableKey) : undefined, { skip: !session.authenticated || !key || pending, refetchOnMountOrArgChange: true });
  const current = session.authenticated && key && !pending && !query.error ? query.currentData : null;
  return { ...session, query, configuration: config.configuration, configurationError: config.error,
    preview: current || unavailableReportPreview, loading: session.authenticated && !config.error && (meta.isLoading || meta.isFetching || Boolean(key) && (pending || query.isLoading || query.isFetching)),
    error: config.error || (meta.error ? getApiErrorMessage(meta.error) : null) || (!pending && query.error ? getApiErrorMessage(query.error) : null) || (current && !current.canExport ? 'This report exceeds the backend export limit or has truncated source data. Narrow the filters before exporting.' : null) };
}
