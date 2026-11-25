'use client';

import { AnalyticsHub } from './reports/AnalyticsHub.jsx';
import { useReportSession } from '../store/features/reports/useReportOperations.js';

export function ReportsAnalytics() {
  const session = useReportSession();
  return <AnalyticsHub key={session.key} />;
}
