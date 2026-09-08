'use client';

import { useState } from 'react';
import { PageHeader, Button, SectionCard, TextField, Select, Switch, QuickActionsCard } from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { financeStatus, financeQuickActions } from '../mock/fixtures/settings.js';
import {
  updateFinancialPolicies, updatePlatformFees, updateEscrowSettingsForm, updatePayoutSettingsForm,
  updateInvoicingReceipts, updateAccountingTax, saveFinanceSettings, resetFinanceSettings,
} from '../mock/api.js';
import { SettingsTabStrip, SettingsStatusCard, SettingsDangerZone, SettingsMetaFooter } from './settingsShared.jsx';

const CURRENCIES = ['Nigerian Naira (NGN)', 'US Dollar (USD)', 'Ghanaian Cedi (GHS)', 'Kenyan Shilling (KES)'];
const CURRENCY_FORMATS = ['₦1,234,567.00', '₦1.234.567,00', '1,234,567.00 ₦'];
const DECIMAL_PLACES = ['2 (e.g. 1,234.56)', '0 (e.g. 1,235)'];
const COMMISSION_TYPES = ['Percentage (%)', 'Flat Fee', 'Tiered'];
const AUTO_RELEASE = ['Enabled', 'Disabled', 'Manual Only'];
const PAYOUT_METHODS = ['Bank Transfer', 'Mobile Money', 'Wallet Credit'];
const PROCESSING_TIMES = ['Instant (≤ 1 hour)', 'Same Day', 'Next Business Day'];
const INVOICE_LOGOS = ['Company Logo', 'None'];
const TAX_CALC = ['Include VAT in price', 'Exclude VAT from price'];
const ACCOUNTING_INTEGRATIONS = ['None', 'Xero', 'QuickBooks', 'Wave'];

function Field({ children }) { return <div style={{ marginBottom: 14 }}>{children}</div>; }

function MiniSwitch({ checked, label, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
      <Switch checked={checked} onChange={onChange} />
      <span style={{ font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{label}</span>
    </div>
  );
}

export function SettingsFinance() {
  const policies = useCollection('settingsFinancialPolicies')?.[0];
  const fees = useCollection('settingsPlatformFees')?.[0];
  const escrow = useCollection('settingsEscrow')?.[0];
  const payout = useCollection('settingsPayout')?.[0];
  const invoicing = useCollection('settingsInvoicing')?.[0];
  const tax = useCollection('settingsAccountingTax')?.[0];
  const meta = useCollection('settingsMeta')?.[0];
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!policies || !fees || !escrow || !payout || !invoicing || !tax) return null;

  async function handleSave() {
    setSaving(true);
    await saveFinanceSettings();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
      <PageHeader crumbs={['System Settings', 'Finance']} title="Finance Settings"
        description="Configure financial rules, fees, escrow, payouts, and accounting preferences."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetFinanceSettings()}>Reset to Default</Button>
          <Button icon="save" disabled={saving} onClick={handleSave}>{saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Changes'}</Button>
        </>} />
      <SettingsTabStrip active="finance" />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Financial Policies" icon="landmark">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Set default financial rules and currency preferences.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
              <Select label="Default Currency" options={CURRENCIES} value={policies.defaultCurrency}
                onChange={(e) => updateFinancialPolicies({ defaultCurrency: e.target.value })} />
              <Select label="Currency Format" options={CURRENCY_FORMATS} value={policies.currencyFormat}
                onChange={(e) => updateFinancialPolicies({ currencyFormat: e.target.value })} />
              <Select label="Decimal Places" options={DECIMAL_PLACES} value={policies.decimalPlaces}
                onChange={(e) => updateFinancialPolicies({ decimalPlaces: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px 20px' }}>
              <Switch checked={policies.allowPartialPayments} label="Allow partial payments"
                hint="Permit customers to make partial payments for jobs."
                onChange={(v) => updateFinancialPolicies({ allowPartialPayments: v })} />
              <Switch checked={policies.autoCalculateFees} label="Auto-calculate fees"
                hint="Automatically apply platform fees and taxes."
                onChange={(v) => updateFinancialPolicies({ autoCalculateFees: v })} />
              <Switch checked={policies.requireFullEscrowBeforeDispatch} label="Require full escrow before dispatch"
                hint="Ensure funds are secured before trip assignment."
                onChange={(v) => updateFinancialPolicies({ requireFullEscrowBeforeDispatch: v })} />
              <Switch checked={policies.enableRefunds} label="Enable refunds"
                hint="Allow refunds for cancelled or disputed jobs."
                onChange={(v) => updateFinancialPolicies({ enableRefunds: v })} />
            </div>
          </SectionCard>

          <SectionCard title="Platform Fees & Commission" icon="percent">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Configure platform fees, commissions, and additional charges.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 6 }}>
              <Select label="Platform Commission Type" options={COMMISSION_TYPES} value={fees.platformCommissionType}
                onChange={(e) => updatePlatformFees({ platformCommissionType: e.target.value })} />
              <TextField label="Commission Rate (%)" value={fees.commissionRate} suffix={<span className="tk-meta">%</span>}
                onChange={(e) => updatePlatformFees({ commissionRate: e.target.value })} />
              <TextField label="Transaction Fee (per payment)" value={fees.transactionFeePerPayment}
                hint="Fixed fee charged per transaction."
                onChange={(e) => updatePlatformFees({ transactionFeePerPayment: e.target.value })} />
              <TextField label="VAT Rate (%)" value={fees.vatRate} suffix={<span className="tk-meta">%</span>}
                onChange={(e) => updatePlatformFees({ vatRate: e.target.value })} />
            </div>
            <div style={{ marginTop: 12 }}>
              <span style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>Additional Fees</span>
              <MiniSwitch checked={fees.applyVatOnCommission} label="Apply VAT on commission"
                onChange={(v) => updatePlatformFees({ applyVatOnCommission: v })} />
              <MiniSwitch checked={fees.includeTransactionFeeInCustomerBill} label="Include transaction fee in customer bill"
                onChange={(v) => updatePlatformFees({ includeTransactionFeeInCustomerBill: v })} />
              <MiniSwitch checked={fees.allowCustomFeesPerJob} label="Allow custom fees per job"
                onChange={(v) => updatePlatformFees({ allowCustomFeesPerJob: v })} />
              <MiniSwitch checked={fees.enablePromotionalDiscounts} label="Enable promotional discounts"
                onChange={(v) => updatePlatformFees({ enablePromotionalDiscounts: v })} />
            </div>
          </SectionCard>

          <SectionCard title="Escrow Settings" icon="lock">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Manage how escrow payments are handled.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
              <TextField label="Escrow Hold Period (Days)" type="number" value={escrow.escrowHoldPeriodDays}
                hint="Period to hold funds after job completion."
                onChange={(e) => updateEscrowSettingsForm({ escrowHoldPeriodDays: Number(e.target.value) })} />
              <div style={{ display: 'grid', gap: 6 }}>
                <Select label="Auto-release on POD" options={AUTO_RELEASE} value={escrow.autoReleaseOnPod}
                  onChange={(e) => updateEscrowSettingsForm({ autoReleaseOnPod: e.target.value })} />
                <span className="tk-meta">Automatically release funds after proof of delivery.</span>
              </div>
            </div>
            <Field><Switch checked={escrow.requireManualReviewForHighValueJobs} label="Require manual review for high-value jobs"
              hint="Jobs above a threshold require admin approval."
              onChange={(v) => updateEscrowSettingsForm({ requireManualReviewForHighValueJobs: v })} /></Field>
            <Switch checked={escrow.notifyStakeholdersOnEscrowRelease} label="Notify stakeholders on escrow release"
              hint="Send notifications when escrow is released."
              onChange={(v) => updateEscrowSettingsForm({ notifyStakeholdersOnEscrowRelease: v })} />
          </SectionCard>

          <SectionCard title="Payout Settings" icon="banknote">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Manage driver and vendor payouts.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
              <Select label="Default Payout Method" options={PAYOUT_METHODS} value={payout.defaultPayoutMethod}
                onChange={(e) => updatePayoutSettingsForm({ defaultPayoutMethod: e.target.value })} />
              <Select label="Payout Processing Time" options={PROCESSING_TIMES} value={payout.payoutProcessingTime}
                onChange={(e) => updatePayoutSettingsForm({ payoutProcessingTime: e.target.value })} />
              <TextField label="Minimum Payout Amount" value={payout.minimumPayoutAmount}
                onChange={(e) => updatePayoutSettingsForm({ minimumPayoutAmount: e.target.value })} />
              <TextField label="Maximum Payout Amount" value={payout.maximumPayoutAmount}
                onChange={(e) => updatePayoutSettingsForm({ maximumPayoutAmount: e.target.value })} />
            </div>
            <Field><Switch checked={payout.requireBankAccountVerification} label="Require bank account verification"
              hint="Drivers must verify bank accounts before payouts."
              onChange={(v) => updatePayoutSettingsForm({ requireBankAccountVerification: v })} /></Field>
            <Switch checked={payout.allowInstantPayouts} label="Allow instant payouts"
              hint="Process payouts automatically when eligible."
              onChange={(v) => updatePayoutSettingsForm({ allowInstantPayouts: v })} />
          </SectionCard>

          <SectionCard title="Invoicing & Receipts" icon="receipt">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Configure invoice, receipt, and billing preferences.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
              <TextField label="Invoice Number Format" value={invoicing.invoiceNumberFormat}
                hint="Example: INV-2026-0001"
                onChange={(e) => updateInvoicingReceipts({ invoiceNumberFormat: e.target.value })} />
              <TextField label="Receipt Number Format" value={invoicing.receiptNumberFormat}
                hint="Example: RCP-2026-0001"
                onChange={(e) => updateInvoicingReceipts({ receiptNumberFormat: e.target.value })} />
              <TextField label="Default Invoice Terms (Days)" type="number" value={invoicing.defaultInvoiceTermsDays}
                onChange={(e) => updateInvoicingReceipts({ defaultInvoiceTermsDays: Number(e.target.value) })} />
              <Select label="Invoice Logo" options={INVOICE_LOGOS} value={invoicing.invoiceLogo}
                onChange={(e) => updateInvoicingReceipts({ invoiceLogo: e.target.value })} />
            </div>
            <Field><Switch checked={invoicing.automaticallyGenerateInvoices} label="Automatically generate invoices"
              hint="Create invoice after payment is confirmed."
              onChange={(v) => updateInvoicingReceipts({ automaticallyGenerateInvoices: v })} /></Field>
            <Switch checked={invoicing.sendInvoiceViaEmail} label="Send invoice via email"
              hint="Email invoices to customers automatically."
              onChange={(v) => updateInvoicingReceipts({ sendInvoiceViaEmail: v })} />
          </SectionCard>

          <SectionCard title="Accounting & Tax" icon="calculator">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Configure tax settings and accounting integration.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <Select label="Tax Calculation" options={TAX_CALC} value={tax.taxCalculation}
                  onChange={(e) => updateAccountingTax({ taxCalculation: e.target.value })} />
                <span className="tk-meta">How VAT is applied to invoices.</span>
              </div>
              <TextField label="Tax Identification Number (TIN)" value={tax.taxIdentificationNumber}
                hint="Used for tax compliance and invoicing."
                onChange={(e) => updateAccountingTax({ taxIdentificationNumber: e.target.value })} />
              <Select label="Accounting Integration" options={ACCOUNTING_INTEGRATIONS} value={tax.accountingIntegration}
                onChange={(e) => updateAccountingTax({ accountingIntegration: e.target.value })} />
            </div>
            <Field><Switch checked={tax.enableTaxReports} label="Enable tax reports"
              hint="Generate tax reports for compliance."
              onChange={(v) => updateAccountingTax({ enableTaxReports: v })} /></Field>
            <Switch checked={tax.syncFinancialData} label="Sync financial data"
              hint="Automatically sync transactions to accounting software."
              onChange={(v) => updateAccountingTax({ syncFinancialData: v })} />
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SettingsStatusCard title="Finance Status" headline={financeStatus.headline} caption={financeStatus.caption}
            items={financeStatus.items} />
          <QuickActionsCard items={financeQuickActions} />
          <SettingsDangerZone title="Reset Finance Settings" hint="Restore all financial settings to default values."
            onConfirm={() => resetFinanceSettings()} />
          <SettingsMetaFooter meta={meta} />
        </div>
      </div>
    </>
  );
}
