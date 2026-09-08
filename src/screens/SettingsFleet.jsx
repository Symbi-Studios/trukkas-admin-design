'use client';

import { useState } from 'react';
import { PageHeader, Button, SectionCard, Card, TextField, Select, Switch, Checkbox, QuickActionsCard, EmptyState, Tabs } from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import {
  FLEET_TABS, fleetStatus, fleetQuickActions,
  TRUCK_STATUSES, OWNERSHIP_TYPES, HOME_LOCATIONS, FUEL_UNITS, WEIGHT_UNITS, ACCESS_LEVELS, RETENTION_YEARS,
} from '../mock/fixtures/settings.js';
import {
  updateFleetPreferences, updateAssetNumbering, updateDefaultReminders, updateFleetVisibility,
  updateDeletionArchiving, updateFleetDataRetention, saveFleetSettings, resetFleetSettings,
} from '../mock/api.js';
import { SettingsTabStrip, SettingsStatusCard, SettingsDangerZone, SettingsMetaFooter } from './settingsShared.jsx';

const DISTANCE_UNITS = ['Kilometers (km)', 'Miles (mi)'];

function Field({ children }) { return <div style={{ marginBottom: 14 }}>{children}</div>; }

export function SettingsFleet() {
  const prefs = useCollection('settingsFleetPreferences')?.[0];
  const numbering = useCollection('settingsAssetNumbering')?.[0];
  const reminders = useCollection('settingsDefaultReminders')?.[0];
  const visibility = useCollection('settingsFleetVisibility')?.[0];
  const deletion = useCollection('settingsDeletionArchiving')?.[0];
  const retention = useCollection('settingsFleetDataRetention')?.[0];
  const meta = useCollection('settingsMeta')?.[0];
  const [subTab, setSubTab] = useState('General');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!prefs || !numbering || !reminders || !visibility || !deletion || !retention) return null;

  async function handleSave() {
    setSaving(true);
    await saveFleetSettings();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
      <PageHeader crumbs={['System Settings', 'Fleet']} title="Fleet Settings"
        description="Configure fleet management preferences, maintenance rules, and asset tracking settings."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetFleetSettings()}>Reset to Default</Button>
          <Button icon="save" disabled={saving} onClick={handleSave}>{saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Changes'}</Button>
        </>} />
        <SettingsTabStrip active="fleet" />

    

      {subTab !== 'General' ? (
        <Card>
          <EmptyState icon="hammer" title={`${subTab} isn't built yet`}
            description="This tab is wired into navigation, but its screen hasn't been transcribed from the source screenshots yet." />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--tk-grid-gap)' }}>
            <SectionCard title="Fleet Preferences" icon="truck">
              <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Set general preferences for fleet management.</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
                <Select label="Default Truck Status" options={TRUCK_STATUSES} value={prefs.defaultTruckStatus}
                  onChange={(e) => updateFleetPreferences({ defaultTruckStatus: e.target.value })} />
                <Select label="Default Ownership Type" options={OWNERSHIP_TYPES} value={prefs.defaultOwnershipType}
                  onChange={(e) => updateFleetPreferences({ defaultOwnershipType: e.target.value })} />
                <Select label="Default Home Location" options={HOME_LOCATIONS} value={prefs.defaultHomeLocation}
                  onChange={(e) => updateFleetPreferences({ defaultHomeLocation: e.target.value })} />
                <Select label="Distance Unit" options={DISTANCE_UNITS} value={prefs.distanceUnit}
                  onChange={(e) => updateFleetPreferences({ distanceUnit: e.target.value })} />
                <Select label="Fuel Unit" options={FUEL_UNITS} value={prefs.fuelUnit}
                  onChange={(e) => updateFleetPreferences({ fuelUnit: e.target.value })} />
                <Select label="Weight Unit" options={WEIGHT_UNITS} value={prefs.weightUnit}
                  onChange={(e) => updateFleetPreferences({ weightUnit: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <Checkbox checked={prefs.enableFleetModules} label="Enable fleet modules"
                  hint="Activate fleet management features across the platform."
                  onChange={(v) => updateFleetPreferences({ enableFleetModules: v })} />
                <Checkbox checked={prefs.allowAssetAssignment} label="Allow asset assignment"
                  hint="Allow trucks and equipment to be assigned to drivers."
                  onChange={(v) => updateFleetPreferences({ allowAssetAssignment: v })} />
                <Checkbox checked={prefs.requireVerification} label="Require verification"
                  hint="Require documentation before adding new assets."
                  onChange={(v) => updateFleetPreferences({ requireVerification: v })} />
              </div>
            </SectionCard>

            <SectionCard title="Asset Numbering" icon="hash">
              <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Configure how trucks and equipment are identified.</span>
              <Field><TextField label="Truck ID Format" value={numbering.truckIdFormat} hint="Example: TRK-00001"
                onChange={(e) => updateAssetNumbering({ truckIdFormat: e.target.value })} /></Field>
              <Field><TextField label="Trailer ID Format" value={numbering.trailerIdFormat} hint="Example: TRL-00001"
                onChange={(e) => updateAssetNumbering({ trailerIdFormat: e.target.value })} /></Field>
              <Field><TextField label="Equipment ID Format" value={numbering.equipmentIdFormat} hint="Example: EQP-00001"
                onChange={(e) => updateAssetNumbering({ equipmentIdFormat: e.target.value })} /></Field>
              <Switch checked={numbering.autoGenerateAssetNumbers} label="Auto-generate asset numbers"
                hint="Automatically generate unique IDs for new assets."
                onChange={(v) => updateAssetNumbering({ autoGenerateAssetNumbers: v })} />
            </SectionCard>

            <SectionCard title="Default Reminders" icon="bell">
              <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Set default reminders for maintenance and compliance.</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
                <TextField label="Maintenance Reminder (Days)" type="number" value={reminders.maintenanceReminderDays}
                  hint="Days before due date to send reminder."
                  onChange={(e) => updateDefaultReminders({ maintenanceReminderDays: Number(e.target.value) })} />
                <TextField label="Inspection Reminder (Days)" type="number" value={reminders.inspectionReminderDays}
                  hint="Days before due date to send reminder."
                  onChange={(e) => updateDefaultReminders({ inspectionReminderDays: Number(e.target.value) })} />
                <TextField label="Insurance Reminder (Days)" type="number" value={reminders.insuranceReminderDays}
                  hint="Days before due date to send reminder."
                  onChange={(e) => updateDefaultReminders({ insuranceReminderDays: Number(e.target.value) })} />
                <TextField label="Permit Renewal Reminder (Days)" type="number" value={reminders.permitRenewalReminderDays}
                  hint="Days before due date to send reminder."
                  onChange={(e) => updateDefaultReminders({ permitRenewalReminderDays: Number(e.target.value) })} />
              </div>
              <Field><Switch checked={reminders.sendEmailNotifications} label="Send email notifications"
                hint="Notify fleet managers via email."
                onChange={(v) => updateDefaultReminders({ sendEmailNotifications: v })} /></Field>
              <Switch checked={reminders.sendInAppNotifications} label="Send in-app notifications"
                hint="Notify relevant users in the system."
                onChange={(v) => updateDefaultReminders({ sendInAppNotifications: v })} />
            </SectionCard>

            <SectionCard title="Fleet Visibility" icon="eye">
              <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Control who can view and manage fleet information.</span>
              <Field>
                <div style={{ display: 'grid', gap: 6 }}>
                  <Select label="Default Access Level" options={ACCESS_LEVELS} value={visibility.defaultAccessLevel}
                    onChange={(e) => updateFleetVisibility({ defaultAccessLevel: e.target.value })} />
                  <span className="tk-meta">Minimum role required to view fleet data.</span>
                </div>
              </Field>
              <Field><Switch checked={visibility.allowDriverAccess} label="Allow driver access"
                hint="Allow drivers to view assigned truck information."
                onChange={(v) => updateFleetVisibility({ allowDriverAccess: v })} /></Field>
              <Field><Switch checked={visibility.allowCustomerVisibility} label="Allow customer visibility"
                hint="Allow customers to see assigned truck details."
                onChange={(v) => updateFleetVisibility({ allowCustomerVisibility: v })} /></Field>
              <Switch checked={visibility.restrictSensitiveInformation} label="Restrict sensitive information"
                hint="Hide cost and financial data from non-admin users."
                onChange={(v) => updateFleetVisibility({ restrictSensitiveInformation: v })} />
            </SectionCard>

            <SectionCard title="Deletion & Archiving" icon="trash-2">
              <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Manage how fleet assets are archived or deleted.</span>
              <Field><Switch checked={deletion.allowArchivingInactiveAssets} label="Allow archiving of inactive assets"
                hint="Keep historical records for inactive trucks."
                onChange={(v) => updateDeletionArchiving({ allowArchivingInactiveAssets: v })} /></Field>
              <Switch checked={deletion.requireAdminApprovalForDeletion} label="Require admin approval for deletion"
                hint="Prevent accidental deletion of fleet assets."
                onChange={(v) => updateDeletionArchiving({ requireAdminApprovalForDeletion: v })} />
            </SectionCard>

            <SectionCard title="Data Retention" icon="database">
              <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Set how long to keep historical fleet data.</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
                <Select label="Trip History Retention" options={RETENTION_YEARS} value={retention.tripHistoryRetention}
                  onChange={(e) => updateFleetDataRetention({ tripHistoryRetention: e.target.value })} />
                <Select label="Maintenance Records Retention" options={RETENTION_YEARS} value={retention.maintenanceRecordsRetention}
                  onChange={(e) => updateFleetDataRetention({ maintenanceRecordsRetention: e.target.value })} />
                <Select label="Fuel Records Retention" options={RETENTION_YEARS} value={retention.fuelRecordsRetention}
                  onChange={(e) => updateFleetDataRetention({ fuelRecordsRetention: e.target.value })} />
                <Select label="Inspection Records Retention" options={RETENTION_YEARS} value={retention.inspectionRecordsRetention}
                  onChange={(e) => updateFleetDataRetention({ inspectionRecordsRetention: e.target.value })} />
              </div>
            </SectionCard>
          </div>

          <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
            <SettingsStatusCard title="Fleet Settings Status" headline={fleetStatus.headline} caption={fleetStatus.caption}
              items={fleetStatus.items} />
            <QuickActionsCard items={fleetQuickActions} />
            <SettingsDangerZone title="Reset Fleet Settings" hint="Restore all fleet settings to default values."
              onConfirm={() => resetFleetSettings()} />
            <SettingsMetaFooter meta={meta} />
          </div>
        </div>
      )}
    </>
  );
}
