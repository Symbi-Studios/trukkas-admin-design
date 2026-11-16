'use client';

;
import { Button, Banner, Icon } from '../ds.js';
import { SettingsSelect as Select, SettingsSwitch as Switch, SettingsReadNotice } from './settingsValues.jsx';
import { useSettingsEditor } from './useSettingsEditor.js';


import { SettingsSectionHeader, SettingsPanelLoading, SettingsGrid, SettingsCard, SettingsCardSave } from './settingsShared.jsx';

const RETENTION_OPTIONS = ['1 year', '3 years', '5 years', '7 years', 'Indefinite'];

function Field({ children }) { return <div style={{ marginBottom: 14 }}>{children}</div>; }

function RetentionRow({ label, hint, value, onChange }) {
  return (
    <Field>
      <Select label={label} options={RETENTION_OPTIONS} value={value} onChange={onChange} />
      <span className="tk-meta">{hint}</span>
    </Field>
  );
}

export function SettingsDataProtection() {
  const editor = useSettingsEditor('data-protection');
  const updateDataPrivacyConsent = editor.change('settingsDataPrivacyConsent');
  const updateDataEncryption = editor.change('settingsDataEncryption');
  const updateDataRetentionSecurity = editor.change('settingsDataRetentionSecurity');
  const updateDataExportAccess = editor.change('settingsDataExportAccess');
  const updateDataDeletion = editor.change('settingsDataDeletion');
  const resetDataProtectionSettings = () => editor.reset();
  const complianceStandards = [];
  const thirdPartyProcessors = editor.processors;
  const consent = editor.group('settingsDataPrivacyConsent');
  const encryption = editor.group('settingsDataEncryption');
  const retention = editor.group('settingsDataRetentionSecurity');
  const exportAccess = editor.group('settingsDataExportAccess');
  const deletion = editor.group('settingsDataDeletion');
  const meta = editor.group('settingsMeta');

  if (editor.loading) return <SettingsPanelLoading />;
  if (!consent || !encryption || !retention || !exportAccess || !deletion) return null;


  return (
    <>
      <SettingsSectionHeader title="Data Protection"
        description="Manage how your data is collected, stored, used, and protected across the platform."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetDataProtectionSettings()}>Reset to Default</Button>
        </>} />
      <SettingsReadNotice error={editor.error} />

      <SettingsGrid>
        {editor.groupVisible('settingsDataPrivacyConsent') && (<SettingsCard description="Manage user consent and data collection preferences." title="Data Privacy & Consent" save={<SettingsCardSave editor={editor} group="settingsDataPrivacyConsent" />}>
          {editor.visible('settingsDataPrivacyConsent', 'collectOnlyNecessaryData') && (<Field><Switch checked={consent.collectOnlyNecessaryData} label="Collect only necessary data"
            hint="Limit data collection to what is required for platform operation."
            onChange={(v) => updateDataPrivacyConsent({ collectOnlyNecessaryData: v })} /></Field>) }
          {editor.visible('settingsDataPrivacyConsent', 'enableUserConsentTracking') && (<Field><Switch checked={consent.enableUserConsentTracking} label="Enable user consent tracking"
            hint="Record and manage user consent for data processing."
            onChange={(v) => updateDataPrivacyConsent({ enableUserConsentTracking: v })} /></Field>) }
          {editor.visible('settingsDataPrivacyConsent', 'showPrivacyNoticeToUsers') && (<Switch checked={consent.showPrivacyNoticeToUsers} label="Show privacy notice to users"
            hint="Display privacy notice during sign up and at key touchpoints."
            onChange={(v) => updateDataPrivacyConsent({ showPrivacyNoticeToUsers: v })} />) }
        </SettingsCard>) }

        {editor.groupVisible('settingsDataRetentionSecurity') && (<SettingsCard description="Set how long different types of data are kept." title="Data Retention" save={<SettingsCardSave editor={editor} group="settingsDataRetentionSecurity" />}>
          {editor.visible('settingsDataRetentionSecurity', 'userAccountData') && (<RetentionRow label="User account data" hint="Includes profile information and account activity."
            value={retention.userAccountData} onChange={(e) => updateDataRetentionSecurity({ userAccountData: e.target.value })} />) }
          {editor.visible('settingsDataRetentionSecurity', 'jobTripData') && (<RetentionRow label="Job & trip data" hint="Includes job details, communications, and logs."
            value={retention.jobTripData} onChange={(e) => updateDataRetentionSecurity({ jobTripData: e.target.value })} />) }
          {editor.visible('settingsDataRetentionSecurity', 'financialRecords') && (<RetentionRow label="Financial records" hint="Includes transactions, payouts, and invoices."
            value={retention.financialRecords} onChange={(e) => updateDataRetentionSecurity({ financialRecords: e.target.value })} />) }
          {editor.visible('settingsDataRetentionSecurity', 'supportTickets') && (<RetentionRow label="Support tickets" hint="Includes customer and support communications."
            value={retention.supportTickets} onChange={(e) => updateDataRetentionSecurity({ supportTickets: e.target.value })} />) }
        </SettingsCard>) }

        {editor.groupVisible('settingsDataDeletion') && (<SettingsCard description="Manage how data is deleted and handled." title="Data Deletion" save={<SettingsCardSave editor={editor} group="settingsDataDeletion" />}>
          {editor.visible('settingsDataDeletion', 'allowAccountDeletion') && (<Field><Switch checked={deletion.allowAccountDeletion} label="Allow account deletion"
            hint="Let users permanently delete their account."
            onChange={(v) => updateDataDeletion({ allowAccountDeletion: v })} /></Field>) }
          {editor.visible('settingsDataDeletion', 'anonymizeDataAfterDeletion') && (<Field><Switch checked={deletion.anonymizeDataAfterDeletion} label="Anonymize data after deletion"
            hint="Anonymize data instead of immediate deletion where required."
            onChange={(v) => updateDataDeletion({ anonymizeDataAfterDeletion: v })} /></Field>) }
          <Banner tone="warning">
            Some data may be retained longer due to legal, financial, or regulatory obligations.
          </Banner>
        </SettingsCard>) }
        
        {editor.groupVisible('settingsDataEncryption') && (<SettingsCard description="Ensure your data is encrypted both in transit and at rest." title="Data Encryption" save={<SettingsCardSave editor={editor} group="settingsDataEncryption" />}>
          {editor.visible('settingsDataEncryption', 'encryptDataInTransit') && (<Field><Switch checked={encryption.encryptDataInTransit} label="Encrypt data in transit (TLS)"
            hint="Use TLS 1.2+ for all data transmissions."
            onChange={(v) => updateDataEncryption({ encryptDataInTransit: v })} /></Field>) }
          {editor.visible('settingsDataEncryption', 'encryptDataAtRest') && (<Field><Switch checked={encryption.encryptDataAtRest} label="Encrypt data at rest"
            hint="All sensitive data is encrypted using AES-256."
            onChange={(v) => updateDataEncryption({ encryptDataAtRest: v })} /></Field>) }
          {editor.visible('settingsDataEncryption', 'enableDataMasking') && (<Field><Switch checked={encryption.enableDataMasking} label="Enable data masking"
            hint="Mask personal data in non-production environments."
            onChange={(v) => updateDataEncryption({ enableDataMasking: v })} /></Field>) }
          <Banner tone="info">
            All sensitive information (e.g. passwords, personal data, payment details) is encrypted using industry best practices.
          </Banner>
        </SettingsCard>) }

        {editor.groupVisible('settingsDataExportAccess') && (<SettingsCard description="Allow users to access or export their data." title="Data Export & Access" save={<SettingsCardSave editor={editor} group="settingsDataExportAccess" />}>
          {editor.visible('settingsDataExportAccess', 'allowUsersDownloadData') && (<Field><Switch checked={exportAccess.allowUsersDownloadData} label="Allow users to download their data"
            hint="Users can request a copy of their personal data."
            onChange={(v) => updateDataExportAccess({ allowUsersDownloadData: v })} /></Field>) }
          {editor.visible('settingsDataExportAccess', 'notifyUsersWhenDataReady') && (<Field><Switch checked={exportAccess.notifyUsersWhenDataReady} label="Notify users when data is ready"
            hint="Send an email notification when export is completed."
            onChange={(v) => updateDataExportAccess({ notifyUsersWhenDataReady: v })} /></Field>) }
          {editor.visible('settingsDataExportAccess', 'allowDataExport') && (<Field><Switch checked={exportAccess.allowDataExport} label="Allow data export"
            hint="Restrict or disable data export for non-admin users."
            onChange={(v) => updateDataExportAccess({ allowDataExport: v })} /></Field>) }
        </SettingsCard>) }
        

        {false && (<SettingsCard description="Manage compliance with data protection regulations." title="Compliance & Standards">
          <div style={{ display: 'grid', gap: 14, marginBottom: 14 }}>
            {complianceStandards.map((c) => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 18, height: 18, borderRadius: 999, background: 'var(--tk-success-soft)',
                              color: 'var(--tk-success)', display: 'grid', placeItems: 'center', flex: '0 0 auto', marginTop: 1 }}>
                  <Icon name="check" size={11} />
                </span>
                <div style={{ display: 'grid', gap: 1 }}>
                  <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{c.label}</span>
                  <span className="tk-meta">{c.detail}</span>
                </div>
              </div>
            ))}
            {'—'}
          </div>
        </SettingsCard>) }

        <SettingsCard description="Manage third-party services that process your data." title="Third-Party Data Processors">
          <div style={{ display: 'grid' }}>
            {thirdPartyProcessors.map((p, i) => (
              <div key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px', border: 0,
                         borderTop: i ? '1px solid var(--tk-line)' : 'none', background: 'transparent',
                         textAlign: 'left' }}>
                <span style={{ width: 30, height: 30, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-blue-soft)',
                              color: 'var(--tk-blue)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                  <Icon name={p.icon} size={15} />
                </span>
                <span style={{ flex: 1, display: 'grid', gap: 1 }}>
                  <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{p.label}</span>
                  <span className="tk-meta">{p.detail}</span>
                </span>
              </div>
            ))}
            {thirdPartyProcessors.length ? null : '—'}
          </div>
        </SettingsCard>
      </SettingsGrid>
    </>
  );
}
