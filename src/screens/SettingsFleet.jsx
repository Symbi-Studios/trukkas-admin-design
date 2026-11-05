'use client';

import { useState } from 'react';
import { Button, Card, EmptyState, Tabs } from '../ds.js';
import { SettingsTextField as TextField, SettingsSelect as Select, SettingsSwitch as Switch, SettingsCheckbox as Checkbox, SettingsReadNotice } from './settingsValues.jsx';
import { useSettingsEditor } from './useSettingsEditor.js';

import { FLEET_TABS, TRUCK_STATUSES, OWNERSHIP_TYPES, HOME_LOCATIONS, FUEL_UNITS, WEIGHT_UNITS, ACCESS_LEVELS, RETENTION_YEARS } from '../mock/fixtures/settings.js';

import { SettingsSectionHeader, SettingsPanelLoading, SettingsGrid, SettingsCard, SettingsCardSave } from './settingsShared.jsx';

const DISTANCE_UNITS = ['Kilometers (km)', 'Miles (mi)'];

function Field({ children }) { return <div style={{ marginBottom: 14 }}>{children}</div>; }

export function SettingsFleet() {
  const editor = useSettingsEditor('fleet');
  const updateFleetPreferences = editor.change('settingsFleetPreferences');
  const updateAssetNumbering = editor.change('settingsAssetNumbering');
  const updateDefaultReminders = editor.change('settingsDefaultReminders');
  const updateFleetVisibility = editor.change('settingsFleetVisibility');
  const updateDeletionArchiving = editor.change('settingsDeletionArchiving');
  const updateFleetDataRetention = editor.change('settingsFleetDataRetention');
  const resetFleetSettings = () => editor.reset();
  const prefs = editor.group('settingsFleetPreferences');
  const numbering = editor.group('settingsAssetNumbering');
  const reminders = editor.group('settingsDefaultReminders');
  const visibility = editor.group('settingsFleetVisibility');
  const deletion = editor.group('settingsDeletionArchiving');
  const retention = editor.group('settingsFleetDataRetention');
  const meta = editor.group('settingsMeta');
  const [subTab, setSubTab] = useState('General');

  if (editor.loading) return <SettingsPanelLoading />;
  if (!prefs || !numbering || !reminders || !visibility || !deletion || !retention) return null;


  return (
    <>
      <SettingsSectionHeader title="Fleet"
        description="Configure fleet management preferences, maintenance rules, and asset tracking settings."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetFleetSettings()}>Reset to Default</Button>
        </>} />
      <SettingsReadNotice error={editor.error} />

    

      {subTab !== 'General' ? (
        <Card>
          <EmptyState icon="hammer" title={`${subTab} isn't built yet`}
            description="This tab is wired into navigation, but its screen hasn't been transcribed from the source screenshots yet." />
        </Card>
      ) : (
        <SettingsGrid>
          {editor.groupVisible('settingsFleetPreferences') && (<SettingsCard description="Set general preferences for fleet management." title="Fleet Preferences" save={<SettingsCardSave editor={editor} group="settingsFleetPreferences" />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
              {editor.visible('settingsFleetPreferences', 'defaultTruckStatus') && (<Select label="Default Truck Status" options={TRUCK_STATUSES} value={prefs.defaultTruckStatus}
                onChange={(e) => updateFleetPreferences({ defaultTruckStatus: e.target.value })} />) }
              {editor.visible('settingsFleetPreferences', 'defaultOwnershipType') && (<Select label="Default Ownership Type" options={OWNERSHIP_TYPES} value={prefs.defaultOwnershipType}
                onChange={(e) => updateFleetPreferences({ defaultOwnershipType: e.target.value })} />) }
              {editor.visible('settingsFleetPreferences', 'defaultHomeLocation') && (<Select label="Default Home Location" options={HOME_LOCATIONS} value={prefs.defaultHomeLocation}
                onChange={(e) => updateFleetPreferences({ defaultHomeLocation: e.target.value })} />) }
              {editor.visible('settingsFleetPreferences', 'distanceUnit') && (<Select label="Distance Unit" options={DISTANCE_UNITS} value={prefs.distanceUnit}
                onChange={(e) => updateFleetPreferences({ distanceUnit: e.target.value })} />) }
              {editor.visible('settingsFleetPreferences', 'fuelUnit') && (<Select label="Fuel Unit" options={FUEL_UNITS} value={prefs.fuelUnit}
                onChange={(e) => updateFleetPreferences({ fuelUnit: e.target.value })} />) }
              {editor.visible('settingsFleetPreferences', 'weightUnit') && (<Select label="Weight Unit" options={WEIGHT_UNITS} value={prefs.weightUnit}
                onChange={(e) => updateFleetPreferences({ weightUnit: e.target.value })} />) }
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {editor.visible('settingsFleetPreferences', 'enableFleetModules') && (<Checkbox checked={prefs.enableFleetModules} label="Enable fleet modules"
                hint="Activate fleet management features across the platform."
                onChange={(v) => updateFleetPreferences({ enableFleetModules: v })} />) }
              {editor.visible('settingsFleetPreferences', 'allowAssetAssignment') && (<Checkbox checked={prefs.allowAssetAssignment} label="Allow asset assignment"
                hint="Allow trucks and equipment to be assigned to drivers."
                onChange={(v) => updateFleetPreferences({ allowAssetAssignment: v })} />) }
              {editor.visible('settingsFleetPreferences', 'requireVerification') && (<Checkbox checked={prefs.requireVerification} label="Require verification"
                hint="Require documentation before adding new assets."
                onChange={(v) => updateFleetPreferences({ requireVerification: v })} />) }
            </div>
          </SettingsCard>) }

          {editor.groupVisible('settingsAssetNumbering') && (<SettingsCard description="Configure how trucks and equipment are identified." title="Asset Numbering" save={<SettingsCardSave editor={editor} group="settingsAssetNumbering" />}>
            {editor.visible('settingsAssetNumbering', 'truckIdFormat') && (<Field><TextField label="Truck ID Format" value={numbering.truckIdFormat} hint="Example: TRK-00001"
              onChange={(e) => updateAssetNumbering({ truckIdFormat: e.target.value })} /></Field>) }
            {editor.visible('settingsAssetNumbering', 'trailerIdFormat') && (<Field><TextField label="Trailer ID Format" value={numbering.trailerIdFormat} hint="Example: TRL-00001"
              onChange={(e) => updateAssetNumbering({ trailerIdFormat: e.target.value })} /></Field>) }
            {editor.visible('settingsAssetNumbering', 'equipmentIdFormat') && (<Field><TextField label="Equipment ID Format" value={numbering.equipmentIdFormat} hint="Example: EQP-00001"
              onChange={(e) => updateAssetNumbering({ equipmentIdFormat: e.target.value })} /></Field>) }
            {editor.visible('settingsAssetNumbering', 'autoGenerateAssetNumbers') && (<Switch checked={numbering.autoGenerateAssetNumbers} label="Auto-generate asset numbers"
              hint="Automatically generate unique IDs for new assets."
              onChange={(v) => updateAssetNumbering({ autoGenerateAssetNumbers: v })} />) }
          </SettingsCard>) }

          {editor.groupVisible('settingsDefaultReminders') && (<SettingsCard description="Set default reminders for maintenance and compliance." title="Default Reminders" save={<SettingsCardSave editor={editor} group="settingsDefaultReminders" />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
              {editor.visible('settingsDefaultReminders', 'maintenanceReminderDays') && (<TextField label="Maintenance Reminder (Days)" type="number" value={reminders.maintenanceReminderDays}
                hint="Days before due date to send reminder."
                onChange={(e) => updateDefaultReminders({ maintenanceReminderDays: e.target.value })} />) }
              {editor.visible('settingsDefaultReminders', 'inspectionReminderDays') && (<TextField label="Inspection Reminder (Days)" type="number" value={reminders.inspectionReminderDays}
                hint="Days before due date to send reminder."
                onChange={(e) => updateDefaultReminders({ inspectionReminderDays: e.target.value })} />) }
              {editor.visible('settingsDefaultReminders', 'insuranceReminderDays') && (<TextField label="Insurance Reminder (Days)" type="number" value={reminders.insuranceReminderDays}
                hint="Days before due date to send reminder."
                onChange={(e) => updateDefaultReminders({ insuranceReminderDays: e.target.value })} />) }
              {editor.visible('settingsDefaultReminders', 'permitRenewalReminderDays') && (<TextField label="Permit Renewal Reminder (Days)" type="number" value={reminders.permitRenewalReminderDays}
                hint="Days before due date to send reminder."
                onChange={(e) => updateDefaultReminders({ permitRenewalReminderDays: e.target.value })} />) }
            </div>
            {editor.visible('settingsDefaultReminders', 'sendEmailNotifications') && (<Field><Switch checked={reminders.sendEmailNotifications} label="Send email notifications"
              hint="Notify fleet managers via email."
              onChange={(v) => updateDefaultReminders({ sendEmailNotifications: v })} /></Field>) }
            {editor.visible('settingsDefaultReminders', 'sendInAppNotifications') && (<Switch checked={reminders.sendInAppNotifications} label="Send in-app notifications"
              hint="Notify relevant users in the system."
              onChange={(v) => updateDefaultReminders({ sendInAppNotifications: v })} />) }
          </SettingsCard>) }

          {editor.groupVisible('settingsFleetVisibility') && (<SettingsCard description="Control who can view and manage fleet information." title="Fleet Visibility" save={<SettingsCardSave editor={editor} group="settingsFleetVisibility" />}>
            <Field>
              <div style={{ display: 'grid', gap: 6 }}>
                {editor.visible('settingsFleetVisibility', 'defaultAccessLevel') && (<Select label="Default Access Level" options={ACCESS_LEVELS} value={visibility.defaultAccessLevel}
                  onChange={(e) => updateFleetVisibility({ defaultAccessLevel: e.target.value })} />) }
                <span className="tk-meta">Minimum role required to view fleet data.</span>
              </div>
            </Field>
            {editor.visible('settingsFleetVisibility', 'allowDriverAccess') && (<Field><Switch checked={visibility.allowDriverAccess} label="Allow driver access"
              hint="Allow drivers to view assigned truck information."
              onChange={(v) => updateFleetVisibility({ allowDriverAccess: v })} /></Field>) }
            {editor.visible('settingsFleetVisibility', 'allowCustomerVisibility') && (<Field><Switch checked={visibility.allowCustomerVisibility} label="Allow customer visibility"
              hint="Allow customers to see assigned truck details."
              onChange={(v) => updateFleetVisibility({ allowCustomerVisibility: v })} /></Field>) }
            {editor.visible('settingsFleetVisibility', 'restrictSensitiveInformation') && (<Switch checked={visibility.restrictSensitiveInformation} label="Restrict sensitive information"
              hint="Hide cost and financial data from non-admin users."
              onChange={(v) => updateFleetVisibility({ restrictSensitiveInformation: v })} />) }
          </SettingsCard>) }

          {editor.groupVisible('settingsDeletionArchiving') && (<SettingsCard description="Manage how fleet assets are archived or deleted." title="Deletion & Archiving" save={<SettingsCardSave editor={editor} group="settingsDeletionArchiving" />}>
            {editor.visible('settingsDeletionArchiving', 'allowArchivingInactiveAssets') && (<Field><Switch checked={deletion.allowArchivingInactiveAssets} label="Allow archiving of inactive assets"
              hint="Keep historical records for inactive trucks."
              onChange={(v) => updateDeletionArchiving({ allowArchivingInactiveAssets: v })} /></Field>) }
            {editor.visible('settingsDeletionArchiving', 'requireAdminApprovalForDeletion') && (<Switch checked={deletion.requireAdminApprovalForDeletion} label="Require admin approval for deletion"
              hint="Prevent accidental deletion of fleet assets."
              onChange={(v) => updateDeletionArchiving({ requireAdminApprovalForDeletion: v })} />) }
          </SettingsCard>) }

          {editor.groupVisible('settingsFleetDataRetention') && (<SettingsCard description="Set how long to keep historical fleet data." title="Data Retention" save={<SettingsCardSave editor={editor} group="settingsFleetDataRetention" />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
              {editor.visible('settingsFleetDataRetention', 'tripHistoryRetention') && (<Select label="Trip History Retention" options={RETENTION_YEARS} value={retention.tripHistoryRetention}
                onChange={(e) => updateFleetDataRetention({ tripHistoryRetention: e.target.value })} />) }
              {editor.visible('settingsFleetDataRetention', 'maintenanceRecordsRetention') && (<Select label="Maintenance Records Retention" options={RETENTION_YEARS} value={retention.maintenanceRecordsRetention}
                onChange={(e) => updateFleetDataRetention({ maintenanceRecordsRetention: e.target.value })} />) }
              {editor.visible('settingsFleetDataRetention', 'fuelRecordsRetention') && (<Select label="Fuel Records Retention" options={RETENTION_YEARS} value={retention.fuelRecordsRetention}
                onChange={(e) => updateFleetDataRetention({ fuelRecordsRetention: e.target.value })} />) }
              {editor.visible('settingsFleetDataRetention', 'inspectionRecordsRetention') && (<Select label="Inspection Records Retention" options={RETENTION_YEARS} value={retention.inspectionRecordsRetention}
                onChange={(e) => updateFleetDataRetention({ inspectionRecordsRetention: e.target.value })} />) }
            </div>
          </SettingsCard>) }
        </SettingsGrid>
      )}
    </>
  );
}
