'use client';

;
import { Button } from '../ds.js';
import { SettingsTextField as TextField, SettingsSelect as Select, SettingsSwitch as Switch, SettingsReadNotice } from './settingsValues.jsx';
import { useSettingsEditor } from './useSettingsEditor.js';
import { useNavigate } from '../router.js';


import { SettingsSectionHeader, SettingsPanelLoading, SettingsGrid, SettingsCard, SettingsCardSave } from './settingsShared.jsx';

const CURRENCIES = ['Nigerian Naira (NGN)', 'US Dollar (USD)', 'Ghanaian Cedi (GHS)', 'Kenyan Shilling (KES)'];
const CURRENCY_FORMATS = ['₦1,234,567.00', '₦1.234.567,00', '1,234,567.00 ₦'];
const DECIMAL_PLACES = ['2 (e.g. 1,234.56)', '0 (e.g. 1,235)'];
const AUTO_RELEASE = ['Enabled', 'Disabled', 'Manual Only'];
const PAYOUT_METHODS = ['Bank Transfer', 'Mobile Money', 'Wallet Credit'];
const PROCESSING_TIMES = ['Instant (≤ 1 hour)', 'Same Day', 'Next Business Day'];
const INVOICE_LOGOS = ['Company Logo', 'None'];
const TAX_CALC = ['Include VAT in price', 'Exclude VAT from price'];
const ACCOUNTING_INTEGRATIONS = ['None', 'Xero', 'QuickBooks', 'Wave'];

function Field({ children }) { return <div style={{ marginBottom: 14 }}>{children}</div>; }

export function SettingsFinance() {
  const editor = useSettingsEditor('finance');
  const navigate = useNavigate();
  const updateFinancialPolicies = editor.change('settingsFinancialPolicies');
  const updateEscrowSettingsForm = editor.change('settingsEscrow');
  const updatePayoutSettingsForm = editor.change('settingsPayout');
  const updateInvoicingReceipts = editor.change('settingsInvoicing');
  const updateAccountingTax = editor.change('settingsAccountingTax');
  const resetFinanceSettings = () => editor.reset();
  const policies = editor.group('settingsFinancialPolicies');
  const escrow = editor.group('settingsEscrow');
  const payout = editor.group('settingsPayout');
  const invoicing = editor.group('settingsInvoicing');
  const tax = editor.group('settingsAccountingTax');
  const meta = editor.group('settingsMeta');

  if (editor.loading) return <SettingsPanelLoading />;
  if (!policies || !escrow || !payout || !invoicing || !tax) return null;


  return (
    <>
      <SettingsSectionHeader title="Finance"
        description="Configure financial policies, escrow handling, payouts, invoicing and accounting preferences."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetFinanceSettings()}>Reset to Default</Button>
        </>} />
      <SettingsReadNotice error={editor.error} />

      <SettingsGrid>
        {editor.groupVisible('settingsFinancialPolicies') && (<SettingsCard description="Set default financial rules and currency preferences." title="Financial Policies" save={<SettingsCardSave editor={editor} group="settingsFinancialPolicies" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 14, marginBottom: 18 }}>
            {editor.visible('settingsFinancialPolicies', 'defaultCurrency') && (<Select label="Default Currency" options={CURRENCIES} value={policies.defaultCurrency}
              onChange={(e) => updateFinancialPolicies({ defaultCurrency: e.target.value })} />) }
            {editor.visible('settingsFinancialPolicies', 'currencyFormat') && (<Select label="Currency Format" options={CURRENCY_FORMATS} value={policies.currencyFormat}
              onChange={(e) => updateFinancialPolicies({ currencyFormat: e.target.value })} />) }
            {editor.visible('settingsFinancialPolicies', 'decimalPlaces') && (<Select label="Decimal Places" options={DECIMAL_PLACES} value={policies.decimalPlaces}
              onChange={(e) => updateFinancialPolicies({ decimalPlaces: e.target.value })} />) }
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '14px 20px' }}>
            {editor.visible('settingsFinancialPolicies', 'allowPartialPayments') && (<Switch checked={policies.allowPartialPayments} label="Allow partial payments"
              hint="Permit customers to make partial payments for jobs."
              onChange={(v) => updateFinancialPolicies({ allowPartialPayments: v })} />) }
            {editor.visible('settingsFinancialPolicies', 'autoCalculateFees') && (<Switch checked={policies.autoCalculateFees} label="Auto-calculate fees"
              hint="Automatically apply platform fees and taxes."
              onChange={(v) => updateFinancialPolicies({ autoCalculateFees: v })} />) }
            {editor.visible('settingsFinancialPolicies', 'requireFullEscrowBeforeDispatch') && (<Switch checked={policies.requireFullEscrowBeforeDispatch} label="Require full escrow before dispatch"
              hint="Ensure funds are secured before trip assignment."
              onChange={(v) => updateFinancialPolicies({ requireFullEscrowBeforeDispatch: v })} />) }
            {editor.visible('settingsFinancialPolicies', 'enableRefunds') && (<Switch checked={policies.enableRefunds} label="Enable refunds"
              hint="Allow refunds for cancelled or disputed jobs."
              onChange={(v) => updateFinancialPolicies({ enableRefunds: v })} />) }
          </div>
        </SettingsCard>) }

        <SettingsCard title="Platform Fees & Rates" description="Platform fee, commission, VAT, mobilization, demurrage and cancellation rates are managed in Finance.">
          <p className="tk-meta" style={{ margin: '0 0 14px' }}>These values decide what every job is charged, so they are edited in one place alongside pricing and fee rules.</p>
          <Button variant="outline" icon="sliders-horizontal" onClick={() => navigate('/rates')}>Open Platform Rates</Button>
        </SettingsCard>

        {editor.groupVisible('settingsEscrow') && (<SettingsCard description="Manage how escrow payments are handled." title="Escrow Settings" save={<SettingsCardSave editor={editor} group="settingsEscrow" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 14, marginBottom: 14 }}>
            {editor.visible('settingsEscrow', 'escrowHoldPeriodDays') && (<TextField label="Escrow Hold Period (Days)" type="number" value={escrow.escrowHoldPeriodDays}
              hint="Period to hold funds after job completion."
              onChange={(e) => updateEscrowSettingsForm({ escrowHoldPeriodDays: e.target.value })} />) }
            <div style={{ display: 'grid', gap: 6 }}>
              {editor.visible('settingsEscrow', 'autoReleaseOnPod') && (<Select label="Auto-release on POD" options={AUTO_RELEASE} value={escrow.autoReleaseOnPod}
                onChange={(e) => updateEscrowSettingsForm({ autoReleaseOnPod: e.target.value })} />) }
              <span className="tk-meta">Automatically release funds after proof of delivery.</span>
            </div>
          </div>
          {editor.visible('settingsEscrow', 'requireManualReviewForHighValueJobs') && (<Field><Switch checked={escrow.requireManualReviewForHighValueJobs} label="Require manual review for high-value jobs"
            hint="Jobs above a threshold require admin approval."
            onChange={(v) => updateEscrowSettingsForm({ requireManualReviewForHighValueJobs: v })} /></Field>) }
          {editor.visible('settingsEscrow', 'notifyStakeholdersOnEscrowRelease') && (<Switch checked={escrow.notifyStakeholdersOnEscrowRelease} label="Notify stakeholders on escrow release"
            hint="Send notifications when escrow is released."
            onChange={(v) => updateEscrowSettingsForm({ notifyStakeholdersOnEscrowRelease: v })} />) }
        </SettingsCard>) }

        {editor.groupVisible('settingsPayout') && (<SettingsCard description="Manage driver and vendor payouts." title="Payout Settings" save={<SettingsCardSave editor={editor} group="settingsPayout" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 14, marginBottom: 14 }}>
            {editor.visible('settingsPayout', 'defaultPayoutMethod') && (<Select label="Default Payout Method" options={PAYOUT_METHODS} value={payout.defaultPayoutMethod}
              onChange={(e) => updatePayoutSettingsForm({ defaultPayoutMethod: e.target.value })} />) }
            {editor.visible('settingsPayout', 'payoutProcessingTime') && (<Select label="Payout Processing Time" options={PROCESSING_TIMES} value={payout.payoutProcessingTime}
              onChange={(e) => updatePayoutSettingsForm({ payoutProcessingTime: e.target.value })} />) }
            {editor.visible('settingsPayout', 'minimumPayoutAmount') && (<TextField label="Minimum Payout Amount" money value={payout.minimumPayoutAmount}
              onChange={(e) => updatePayoutSettingsForm({ minimumPayoutAmount: e.target.value })} />) }
            {editor.visible('settingsPayout', 'maximumPayoutAmount') && (<TextField label="Maximum Payout Amount" money value={payout.maximumPayoutAmount}
              onChange={(e) => updatePayoutSettingsForm({ maximumPayoutAmount: e.target.value })} />) }
          </div>
          {editor.visible('settingsPayout', 'requireBankAccountVerification') && (<Field><Switch checked={payout.requireBankAccountVerification} label="Require bank account verification"
            hint="Drivers must verify bank accounts before payouts."
            onChange={(v) => updatePayoutSettingsForm({ requireBankAccountVerification: v })} /></Field>) }
          {editor.visible('settingsPayout', 'allowInstantPayouts') && (<Switch checked={payout.allowInstantPayouts} label="Allow instant payouts"
            hint="Process payouts automatically when eligible."
            onChange={(v) => updatePayoutSettingsForm({ allowInstantPayouts: v })} />) }
        </SettingsCard>) }

        {editor.groupVisible('settingsInvoicing') && (<SettingsCard description="Configure invoice, receipt, and billing preferences." title="Invoicing & Receipts" save={<SettingsCardSave editor={editor} group="settingsInvoicing" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 14, marginBottom: 14 }}>
            {editor.visible('settingsInvoicing', 'invoiceNumberFormat') && (<TextField label="Invoice Number Format" value={invoicing.invoiceNumberFormat}
              hint="Example: INV-2026-0001"
              onChange={(e) => updateInvoicingReceipts({ invoiceNumberFormat: e.target.value })} />) }
            {editor.visible('settingsInvoicing', 'receiptNumberFormat') && (<TextField label="Receipt Number Format" value={invoicing.receiptNumberFormat}
              hint="Example: RCP-2026-0001"
              onChange={(e) => updateInvoicingReceipts({ receiptNumberFormat: e.target.value })} />) }
            {editor.visible('settingsInvoicing', 'defaultInvoiceTermsDays') && (<TextField label="Default Invoice Terms (Days)" type="number" value={invoicing.defaultInvoiceTermsDays}
              onChange={(e) => updateInvoicingReceipts({ defaultInvoiceTermsDays: e.target.value })} />) }
            {editor.visible('settingsInvoicing', 'invoiceLogo') && (<Select label="Invoice Logo" options={INVOICE_LOGOS} value={invoicing.invoiceLogo}
              onChange={(e) => updateInvoicingReceipts({ invoiceLogo: e.target.value })} />) }
          </div>
          {editor.visible('settingsInvoicing', 'automaticallyGenerateInvoices') && (<Field><Switch checked={invoicing.automaticallyGenerateInvoices} label="Automatically generate invoices"
            hint="Create invoice after payment is confirmed."
            onChange={(v) => updateInvoicingReceipts({ automaticallyGenerateInvoices: v })} /></Field>) }
          {editor.visible('settingsInvoicing', 'sendInvoiceViaEmail') && (<Switch checked={invoicing.sendInvoiceViaEmail} label="Send invoice via email"
            hint="Email invoices to customers automatically."
            onChange={(v) => updateInvoicingReceipts({ sendInvoiceViaEmail: v })} />) }
        </SettingsCard>) }

        {editor.groupVisible('settingsAccountingTax') && (<SettingsCard description="Configure tax settings and accounting integration." title="Accounting & Tax" save={<SettingsCardSave editor={editor} group="settingsAccountingTax" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 14, marginBottom: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              {editor.visible('settingsAccountingTax', 'taxCalculation') && (<Select label="Tax Calculation" options={TAX_CALC} value={tax.taxCalculation}
                onChange={(e) => updateAccountingTax({ taxCalculation: e.target.value })} />) }
              <span className="tk-meta">How VAT is applied to invoices.</span>
            </div>
            {editor.visible('settingsAccountingTax', 'taxIdentificationNumber') && (<TextField label="Tax Identification Number (TIN)" value={tax.taxIdentificationNumber}
              hint="Used for tax compliance and invoicing."
              onChange={(e) => updateAccountingTax({ taxIdentificationNumber: e.target.value })} />) }
            {editor.visible('settingsAccountingTax', 'accountingIntegration') && (<Select label="Accounting Integration" options={ACCOUNTING_INTEGRATIONS} value={tax.accountingIntegration}
              onChange={(e) => updateAccountingTax({ accountingIntegration: e.target.value })} />) }
          </div>
          {editor.visible('settingsAccountingTax', 'enableTaxReports') && (<Field><Switch checked={tax.enableTaxReports} label="Enable tax reports"
            hint="Generate tax reports for compliance."
            onChange={(v) => updateAccountingTax({ enableTaxReports: v })} /></Field>) }
          {editor.visible('settingsAccountingTax', 'syncFinancialData') && (<Switch checked={tax.syncFinancialData} label="Sync financial data"
            hint="Automatically sync transactions to accounting software."
            onChange={(v) => updateAccountingTax({ syncFinancialData: v })} />) }
        </SettingsCard>) }
      </SettingsGrid>
    </>
  );
}
