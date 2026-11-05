'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '../ds.js';
import { SETTINGS_TABS, SettingsNav, resolveSettingsTab, settingsTabPath } from './settingsShared.jsx';
import { SettingsGeneral } from './SettingsGeneral.jsx';
import { SettingsFieldsRegistration } from './SettingsFieldsRegistration.jsx';
import { SettingsOperations } from './SettingsOperations.jsx';
import { SettingsFleet } from './SettingsFleet.jsx';
import { SettingsFinance } from './SettingsFinance.jsx';
import { SettingsNotifications } from './SettingsNotifications.jsx';
import { SettingsIntegrations } from './SettingsIntegrations.jsx';
import { SettingsSecurity } from './SettingsSecurity.jsx';
import { SettingsPasswords } from './SettingsPasswords.jsx';
import { SettingsSecurityAlerts } from './SettingsSecurityAlerts.jsx';
import { SettingsDataProtection } from './SettingsDataProtection.jsx';

// Each tab stacks one or more settings areas; every area keeps its own Save.
const TAB_SECTIONS = {
  general: [SettingsGeneral],
  operations: [SettingsOperations, SettingsFleet],
  finance: [SettingsFinance],
  notifications: [SettingsNotifications],
  onboarding: [SettingsFieldsRegistration],
  integrations: [SettingsIntegrations],
  security: [SettingsSecurity, SettingsPasswords, SettingsSecurityAlerts, SettingsDataProtection],
};

function SettingsTabs() {
  const active = resolveSettingsTab(useSearchParams().get('tab'));
  const label = SETTINGS_TABS.find((t) => t.key === active).label;
  // Switch in place; history.pushState keeps the URL shareable without a page load.
  const select = (key) => window.history.pushState(null, '', settingsTabPath(key));

  return (
    <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
      <PageHeader
        crumbs={[{ label: 'System Settings', onClick: () => select('general') }, label]}
        title="System Settings"
        description="Configure and manage your Trukkas platform settings, integrations, and preferences." />
      <div className="tk-settings-layout">
        <SettingsNav active={active} onChange={select} />
        <div className="tk-settings-content">
          {TAB_SECTIONS[active].map((Section, i) => <section key={`${active}-${i}`} className="tk-settings-area"><Section /></section>)}
        </div>
      </div>
    </div>
  );
}

export function SystemSettings() {
  return <Suspense fallback={null}><SettingsTabs /></Suspense>;
}
