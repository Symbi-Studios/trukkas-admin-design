'use client';

import { useEffect, useState } from 'react';
import { usePreviewAdminReportQuery, unavailableReportPreview } from './reportsApi.js';
import { useReportSession } from './useReportOperations.js';
import { reportConfiguration } from './reportContracts.js';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';

export function useReportPreview(draft, page = 1, limit = 10) {
  const session = useReportSession();
  const config = reportConfiguration(draft, session.admin);
  const key = config.configuration ? JSON.stringify({ configuration: config.configuration, page, limit, owner: session.owner }) : null;
  const [stableKey, setStableKey] = useState(key);
  const pending = key !== stableKey;
  useEffect(() => { if (key === stableKey) return; const timer = setTimeout(() => setStableKey(key), 300); return () => clearTimeout(timer); }, [key, stableKey]);
  const query = usePreviewAdminReportQuery(stableKey ? JSON.parse(stableKey) : undefined, { skip: !session.authenticated || !key || pending, refetchOnMountOrArgChange: true });
  const current = session.authenticated && key && !pending && !query.error ? query.currentData : null;
  return { ...session, query, configuration: config.configuration, configurationError: config.error,
    preview: current || unavailableReportPreview, loading: session.authenticated && Boolean(key) && (pending || query.isLoading || query.isFetching),
    error: config.error || (!pending && query.error ? getApiErrorMessage(query.error) : null) || (current && !current.canExport ? 'This report exceeds the backend export limit or has truncated source data. Narrow the filters before exporting.' : null) };
}
