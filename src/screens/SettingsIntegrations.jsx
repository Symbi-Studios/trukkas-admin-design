'use client';

import { useSelector } from 'react-redux';
import { PageHeader, Card, Badge, EmptyState } from '../ds.js';
import { SettingsTabStrip } from './settingsShared.jsx';
import { SettingsReadNotice } from './settingsValues.jsx';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import { useGetAdminSettingsIntegrationsQuery } from '../store/features/settings/settingsApi.js';

export function SettingsIntegrations() {
  const owner = useSelector(state => state.auth.admin?.id);
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const skip = !owner || !authenticated;
  const query = useGetAdminSettingsIntegrationsQuery({ owner }, { skip, refetchOnMountOrArgChange: true });
  const rows = skip || query.error ? null : query.currentData;
  const loading = !skip && (query.isLoading || query.isFetching && !rows);

  return (
    <>
      <PageHeader crumbs={['System Settings', 'Integrations']} title="Integrations Settings"
        description="Configure integrations preferences for your Trukkas platform." />
      <SettingsTabStrip active="integrations" />
      <SettingsReadNotice error={query.error} />
      <Card>
        {loading ? <>
          <DriverLoadingNotice>Loading integrations…</DriverLoadingNotice>
          <DriverTableLoading columns={3} label="Loading integrations" />
        </> : rows == null ? '—' : rows.length === 0 ? <EmptyState icon="plug-zap" title="No integrations found" /> : (
          <div style={{ display: 'grid' }}>
            {rows.map((row, index) => (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 2px', borderTop: index ? '1px solid var(--tk-line)' : 'none', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0, display: 'grid', gap: 4, overflowWrap: 'anywhere' }}>
                  <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{row.name}</span>
                  <span className="tk-meta">{row.purpose}</span>
                </div>
                <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
