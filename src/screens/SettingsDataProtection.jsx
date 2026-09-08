'use client';

import { useState } from 'react';
import { PageHeader, Button, SectionCard, Select, Switch, Banner, Icon } from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { complianceStandards, thirdPartyProcessors, dataProtectionStatus } from '../mock/fixtures/settings.js';
import {
  updateDataPrivacyConsent, updateDataEncryption, updateDataRetentionSecurity, updateDataExportAccess,
  updateDataDeletion, saveDataProtectionSettings, resetDataProtectionSettings,
} from '../mock/api.js';
import { SettingsTabStrip, SettingsDangerZone, SettingsMetaFooter } from './settingsShared.jsx';

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
  const consent = useCollection('settingsDataPrivacyConsent')?.[0];
  const encryption = useCollection('settingsDataEncryption')?.[0];
  const retention = useCollection('settingsDataRetentionSecurity')?.[0];
  const exportAccess = useCollection('settingsDataExportAccess')?.[0];
  const deletion = useCollection('settingsDataDeletion')?.[0];
  const meta = useCollection('settingsMeta')?.[0];
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!consent || !encryption || !retention || !exportAccess || !deletion) return null;

  async function handleSave() {
    setSaving(true);
    await saveDataProtectionSettings();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
      <PageHeader crumbs={['System Settings', 'Data Protection']} title="Data Protection"
        description="Manage how your data is collected, stored, used, and protected across the platform."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetDataProtectionSettings()}>Reset to Default</Button>
          <Button icon="save" disabled={saving} onClick={handleSave}>{saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Changes'}</Button>
        </>} />
      <SettingsTabStrip active="data-protection" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr)) 300px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Data Privacy & Consent" icon="shield">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Manage user consent and data collection preferences.</span>
            <Field><Switch checked={consent.collectOnlyNecessaryData} label="Collect only necessary data"
              hint="Limit data collection to what is required for platform operation."
              onChange={(v) => updateDataPrivacyConsent({ collectOnlyNecessaryData: v })} /></Field>
            <Field><Switch checked={consent.enableUserConsentTracking} label="Enable user consent tracking"
              hint="Record and manage user consent for data processing."
              onChange={(v) => updateDataPrivacyConsent({ enableUserConsentTracking: v })} /></Field>
            <Switch checked={consent.showPrivacyNoticeToUsers} label="Show privacy notice to users"
              hint="Display privacy notice during sign up and at key touchpoints."
              onChange={(v) => updateDataPrivacyConsent({ showPrivacyNoticeToUsers: v })} />
          </SectionCard>

          <SectionCard title="Data Retention" icon="database">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Set how long different types of data are kept.</span>
            <RetentionRow label="User account data" hint="Includes profile information and account activity."
              value={retention.userAccountData} onChange={(e) => updateDataRetentionSecurity({ userAccountData: e.target.value })} />
            <RetentionRow label="Job & trip data" hint="Includes job details, communications, and logs."
              value={retention.jobTripData} onChange={(e) => updateDataRetentionSecurity({ jobTripData: e.target.value })} />
            <RetentionRow label="Financial records" hint="Includes transactions, payouts, and invoices."
              value={retention.financialRecords} onChange={(e) => updateDataRetentionSecurity({ financialRecords: e.target.value })} />
            <RetentionRow label="Support tickets" hint="Includes customer and support communications."
              value={retention.supportTickets} onChange={(e) => updateDataRetentionSecurity({ supportTickets: e.target.value })} />
          </SectionCard>

          <SectionCard title="Data Deletion" icon="trash-2">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Manage how data is deleted and handled.</span>
            <Field><Switch checked={deletion.allowAccountDeletion} label="Allow account deletion"
              hint="Let users permanently delete their account."
              onChange={(v) => updateDataDeletion({ allowAccountDeletion: v })} /></Field>
            <Field><Switch checked={deletion.anonymizeDataAfterDeletion} label="Anonymize data after deletion"
              hint="Anonymize data instead of immediate deletion where required."
              onChange={(v) => updateDataDeletion({ anonymizeDataAfterDeletion: v })} /></Field>
            <Banner tone="warning">
              Some data may be retained longer due to legal, financial, or regulatory obligations.
            </Banner>
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Data Encryption" icon="lock">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Ensure your data is encrypted both in transit and at rest.</span>
            <Field><Switch checked={encryption.encryptDataInTransit} label="Encrypt data in transit (TLS)"
              hint="Use TLS 1.2+ for all data transmissions."
              onChange={(v) => updateDataEncryption({ encryptDataInTransit: v })} /></Field>
            <Field><Switch checked={encryption.encryptDataAtRest} label="Encrypt data at rest"
              hint="All sensitive data is encrypted using AES-256."
              onChange={(v) => updateDataEncryption({ encryptDataAtRest: v })} /></Field>
            <Banner tone="info">
              All sensitive information (e.g. passwords, personal data, payment details) is encrypted using industry best practices.
            </Banner>
          </SectionCard>

          <SectionCard title="Data Export & Access" icon="download">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Allow users to access or export their data.</span>
            <Field><Switch checked={exportAccess.allowUsersDownloadData} label="Allow users to download their data"
              hint="Users can request a copy of their personal data."
              onChange={(v) => updateDataExportAccess({ allowUsersDownloadData: v })} /></Field>
            <Field><Switch checked={exportAccess.notifyUsersWhenDataReady} label="Notify users when data is ready"
              hint="Send an email notification when export is completed."
              onChange={(v) => updateDataExportAccess({ notifyUsersWhenDataReady: v })} /></Field>
            <Button variant="outline" fullWidth iconRight="chevron-right">Manage Data Export Requests</Button>
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Data Protection Status" icon="shield-check">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 14,
                         borderRadius: 'var(--tk-r-lg)', background: 'var(--tk-success-soft)' }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--tk-success)', flex: '0 0 auto',
                             display: 'grid', placeItems: 'center', marginTop: 1 }}>
                <Icon name="check" size={13} color="#fff" />
              </span>
              <div style={{ display: 'grid', gap: 2 }}>
                <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-success)' }}>{dataProtectionStatus.headline}</span>
                <span className="tk-meta">{dataProtectionStatus.caption}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Compliance & Standards" icon="file-check">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Manage compliance with data protection regulations.</span>
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
            </div>
            <Button variant="outline" fullWidth iconRight="chevron-right">View Compliance Details</Button>
          </SectionCard>

          <SectionCard title="Third-Party Data Processors" icon="share-2">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 10 }}>Manage third-party services that process your data.</span>
            <div style={{ display: 'grid' }}>
              {thirdPartyProcessors.map((p, i) => (
                <button key={p.label} type="button"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px', border: 0,
                           borderTop: i ? '1px solid var(--tk-line)' : 'none', background: 'transparent',
                           cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-blue-soft)',
                                color: 'var(--tk-blue)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                    <Icon name={p.icon} size={15} />
                  </span>
                  <span style={{ flex: 1, display: 'grid', gap: 1 }}>
                    <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{p.label}</span>
                    <span className="tk-meta">{p.detail}</span>
                  </span>
                  <Icon name="chevron-right" size={15} color="var(--tk-ink-300)" />
                </button>
              ))}
            </div>
          </SectionCard>

          <SettingsDangerZone title="Permanently Delete All Platform Data" hint="This action cannot be undone."
            onConfirm={() => {}} />
          <SettingsMetaFooter meta={meta} />
        </div>
      </div>
    </>
  );
}
