'use client';
import { useDispatch, useSelector } from 'react-redux';
import { reportActions } from './reportsSlice.js';
import { useGetAdminReportEntitiesQuery } from './reportsApi.js';

export function useReportDraft() {
  const dispatch = useDispatch();
  const draft = useSelector((state) => state.reports);
  return {
    draft,
    updateReportDraft: (patch) => dispatch(reportActions.updateReportDraft(patch)),
    toggleReportColumn: (group, key) => dispatch(reportActions.toggleReportColumn({ group, key })),
    setReportColumnGroup: (group, checked) => dispatch(reportActions.setReportColumnGroup({ group, checked })),
    setAllReportColumns: (checked) => dispatch(reportActions.setAllReportColumns(checked)),
  };
}
export function useReportEntities(entityType) {
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const query = useGetAdminReportEntitiesQuery(undefined, { skip: !authenticated });
  const options = (!authenticated || query.isError ? [] : query.currentData || [])
    .filter((row) => entityType === 'All Types' || row.entityType === entityType)
    .map((row) => ({ value: row.id, label: row.name }));
  return { ...query, options: [{ value: 'All Entities', label: 'All Entities' }, ...options] };
}
