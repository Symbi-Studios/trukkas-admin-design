// Mock API — every function is async and shaped like a real network call
// (await, resolves with the affected record) even though it just reads/writes
// the in-memory db. See HANDOFF.md, "Mock data contract" for what a real
// backend implementation of each function needs to do.
import { seed, patchRow, prependRow, getRow, getSnapshot, setRows } from './db.js';
import { trucks } from './fixtures/trucks.js';
import { verifications } from './fixtures/verifications.js';
import { walletSummary, transactions, bankAccounts } from './fixtures/wallet.js';
import { announcements } from './fixtures/announcements.js';
import { jobs } from './fixtures/jobs.js';
import { triangulationMatches } from './fixtures/triangulation.js';
import { triangulationOpportunities } from './fixtures/triangulationOpportunities.js';
import { drivers } from './fixtures/drivers.js';
import { companies } from './fixtures/companies.js';
import { cargo } from './fixtures/cargo.js';
import { cargoTypes } from './fixtures/cargoTypes.js';
import { feeRules } from './fixtures/fees.js';
import {
  servicePricing, pricingRules, surcharges, priceLists, priceExceptions, priceHistory,
} from './fixtures/pricing.js';
import {
  escrowSummary, escrowAccounts, escrowHolds, escrowReleases, disputes, escrowTransactions,
} from './fixtures/escrow.js';
import { settlements } from './fixtures/settlements.js';
import { transactionRows, makeTransaction } from './fixtures/transactions.js';
import { payoutRequests } from './fixtures/payouts.js';
import { COLUMN_GROUPS, verificationPerformanceRows } from './fixtures/reports.js';
import { users } from './fixtures/users.js';
import { roles } from './fixtures/roles.js';
import { feedback } from './fixtures/feedback.js';
import { demurrageRecords } from './fixtures/demurrage.js';
import { documents } from './fixtures/documents.js';
import { maintenanceRecords } from './fixtures/maintenance.js';
import { notifications } from './fixtures/notifications.js';
import { supportTickets, knowledgeArticles } from './fixtures/support.js';
import {
  platformInfo, operationalGeneral, notificationGeneral,
  jobTripSettings, biddingAssignment, dispatchTracking, documentCompliance, timingSlas, operationsCommunication,
  financialPolicies, platformFees, escrowSettingsForm, payoutSettingsForm, invoicingReceipts, accountingTax,
  settingsMeta, notificationChannelDefaults, quietHours, eventNotificationGroups,
  companyProfile, companyContact, companyBusinessInfo,
  fleetPreferences, assetNumbering, defaultReminders, fleetVisibility, deletionArchiving, fleetDataRetention,
  dataPrivacyConsent, dataEncryption, dataRetentionSecurity, dataExportAccess, dataDeletionSettings,
  authSettings, passwordPolicyOverview, sessionManagementOverview, ipDeviceRestrictionsOverview,
  dataProtectionOverview, securityAlertsOverview,
  passwordRequirements, sessionSettings, loginNotificationsSettings, activeSessions,
  securityAlertEvents, alertDeliverySettings, securityAlertsQuietHours,
} from './fixtures/settings.js';
import { faqGroups } from './fixtures/faq.js';

seed('trucks', trucks);
seed('feeRules', feeRules);
seed('verifications', verifications);
seed('walletSummary', [walletSummary]);
seed('transactions', transactions);
seed('bankAccounts', bankAccounts);
seed('announcements', announcements);
seed('jobs', jobs);
seed('triangulation', triangulationMatches);
seed('triangulationOpportunities', triangulationOpportunities);
seed('drivers', drivers);
seed('companies', companies);
seed('cargo', cargo);
seed('cargoTypes', cargoTypes);
seed('servicePricing', servicePricing);
seed('pricingRules', pricingRules);
seed('surcharges', surcharges);
seed('priceLists', priceLists);
seed('priceExceptions', priceExceptions);
seed('priceHistory', priceHistory);
seed('escrowSummary', [escrowSummary]);
seed('escrowAccounts', escrowAccounts);
seed('escrowHolds', escrowHolds);
seed('escrowReleases', escrowReleases);
seed('disputes', disputes);
seed('escrowTransactions', escrowTransactions);
seed('settlements', settlements);
seed('transactionRows', transactionRows);
seed('payoutRequests', payoutRequests);
seed('verificationPerformanceRows', verificationPerformanceRows);
seed('users', users);
seed('roles', roles);
seed('feedback', feedback);
seed('demurrage', demurrageRecords);
seed('documents', documents);
seed('maintenance', maintenanceRecords);
seed('notifications', notifications);
seed('supportTickets', supportTickets);
seed('knowledgeArticles', knowledgeArticles);
seed('settingsPlatformInfo', [platformInfo]);
seed('settingsOperationalGeneral', [operationalGeneral]);
seed('settingsNotificationGeneral', [notificationGeneral]);
seed('settingsJobTrip', [jobTripSettings]);
seed('settingsBiddingAssignment', [biddingAssignment]);
seed('settingsDispatchTracking', [dispatchTracking]);
seed('settingsDocumentCompliance', [documentCompliance]);
seed('settingsTimingSlas', [timingSlas]);
seed('settingsOperationsCommunication', [operationsCommunication]);
seed('settingsFinancialPolicies', [financialPolicies]);
seed('settingsPlatformFees', [platformFees]);
seed('settingsEscrow', [escrowSettingsForm]);
seed('settingsPayout', [payoutSettingsForm]);
seed('settingsInvoicing', [invoicingReceipts]);
seed('settingsAccountingTax', [accountingTax]);
seed('settingsMeta', [settingsMeta]);
seed('settingsNotificationChannels', [notificationChannelDefaults]);
seed('settingsQuietHours', [quietHours]);
seed('settingsEventNotifications', eventNotificationGroups);
seed('settingsFleetPreferences', [fleetPreferences]);
seed('settingsAssetNumbering', [assetNumbering]);
seed('settingsDefaultReminders', [defaultReminders]);
seed('settingsFleetVisibility', [fleetVisibility]);
seed('settingsDeletionArchiving', [deletionArchiving]);
seed('settingsFleetDataRetention', [fleetDataRetention]);
seed('settingsDataPrivacyConsent', [dataPrivacyConsent]);
seed('settingsDataEncryption', [dataEncryption]);
seed('settingsDataRetentionSecurity', [dataRetentionSecurity]);
seed('settingsDataExportAccess', [dataExportAccess]);
seed('settingsDataDeletion', [dataDeletionSettings]);
seed('settingsAuth', [authSettings]);
seed('settingsPasswordPolicyOverview', [passwordPolicyOverview]);
seed('settingsSessionManagementOverview', [sessionManagementOverview]);
seed('settingsIpDeviceRestrictionsOverview', [ipDeviceRestrictionsOverview]);
seed('settingsDataProtectionOverview', [dataProtectionOverview]);
seed('settingsSecurityAlertsOverview', [securityAlertsOverview]);
seed('settingsPasswordRequirements', [passwordRequirements]);
seed('settingsSessionSettings', [sessionSettings]);
seed('settingsLoginNotifications', [loginNotificationsSettings]);
seed('settingsActiveSessions', activeSessions);
seed('settingsSecurityAlertEvents', securityAlertEvents);
seed('settingsAlertDelivery', [alertDeliverySettings]);
seed('settingsSecurityAlertsQuietHours', [securityAlertsQuietHours]);
seed('faqGroups', faqGroups);
seed('reportTemplates', []);
seed('reportDraft', [{
  reportType: 'verification',
  dateRangePreset: 'Custom Range',
  dateFrom: '2024-05-14',
  dateTo: '2024-05-20',
  filters: { entityType: 'All Types', entity: 'All Entities', status: 'All Statuses', location: 'All Locations', minAmount: '', maxAmount: '' },
  showMoreFilters: false,
  columnGroups: COLUMN_GROUPS.map((g) => ({ group: g.group, columns: g.columns.map((c) => ({ ...c })) })),
  columnSearch: '',
  format: 'xlsx',
  delivery: 'download',
  scheduleFrequency: 'Daily',
  fileSettings: { includeCharts: true, includeSummary: true, compressFile: true },
}]);

const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Fleet -----------------------------------------------------------
export async function setTruckStatus(plate, status) {
  await delay();
  return patchRow('trucks', 'plate', plate, { status });
}

export async function updateTruck(plate, changes) {
  await delay(80);
  return patchRow('trucks', 'plate', plate, changes);
}

// ---- Jobs & Trips --------------------------------------------------------
let tripSeq = 15;

export async function assignTruckToJob(jobId, plate) {
  await delay();
  const truck = getRow('trucks', 'plate', plate);
  const tripId = `TK-2026-${String(tripSeq++).padStart(6, '0')}`;
  patchRow('trucks', 'plate', plate, { status: 'On Trip', trip: tripId });
  return patchRow('jobs', 'id', jobId, {
    status: 'Assigned',
    truckPlate: truck.plate, driver: truck.driver, truckCompany: truck.company,
    trip: tripId,
  });
}

export async function markJobDelivered(jobId) {
  await delay();
  return patchRow('jobs', 'id', jobId, { status: 'Delivered', etaCountdown: null });
}

export async function cancelJob(jobId) {
  await delay();
  return patchRow('jobs', 'id', jobId, { status: 'Cancelled', etaCountdown: null });
}

// ---- Container Triangulation ----------------------------------------------
export async function approveTriangulationMatch(id) {
  await delay();
  const m = getRow('triangulation', 'id', id);
  return patchRow('triangulation', 'id', id, {
    status: 'Matched',
    matchedJob: m.candidateMatchedJob, matchedLabel: m.candidateLabel, matchedDate: m.candidateDate,
    distanceSavedKm: m.candidateDistanceSavedKm, estSavings: m.candidateEstSavings,
    history: [{ text: 'Match approved by admin', time: 'Just now' }, ...m.history],
  });
}

export async function rejectTriangulationMatch(id) {
  await delay();
  const m = getRow('triangulation', 'id', id);
  return patchRow('triangulation', 'id', id, {
    status: 'Expired',
    history: [{ text: 'Candidate match rejected by admin', time: 'Just now' }, ...m.history],
  });
}

// ---- Triangulation Opportunities (opportunity review / detail page) -------
export async function createTriangulationOpportunityMatch(id) {
  await delay();
  const o = getRow('triangulationOpportunities', 'id', id);
  return patchRow('triangulationOpportunities', 'id', id, {
    status: 'Matched',
    notes: [{ text: 'Match created — current and proposed segments linked into one multi-leg trip.', actor: 'Admin', time: 'Just now' }, ...o.notes],
  });
}

export async function proposeOpportunityToTruckingCompany(id) {
  await delay();
  const o = getRow('triangulationOpportunities', 'id', id);
  return patchRow('triangulationOpportunities', 'id', id, {
    status: 'Awaiting Trucking Company',
    notes: [{ text: `Proposal sent to ${o.currentSegment.truckingCompany}.`, actor: 'Admin', time: 'Just now' }, ...o.notes],
  });
}

export async function proposeOpportunityToForwarder(id) {
  await delay();
  const o = getRow('triangulationOpportunities', 'id', id);
  return patchRow('triangulationOpportunities', 'id', id, {
    status: 'Awaiting Forwarder',
    notes: [{ text: `Proposal sent to ${o.proposedSegment.forwarder}.`, actor: 'Admin', time: 'Just now' }, ...o.notes],
  });
}

export async function rejectTriangulationOpportunity(id, reason) {
  await delay();
  const o = getRow('triangulationOpportunities', 'id', id);
  return patchRow('triangulationOpportunities', 'id', id, {
    status: 'Rejected',
    notes: [{ text: reason ? `Opportunity rejected — ${reason}` : 'Opportunity rejected by admin.', actor: 'Admin', time: 'Just now' }, ...o.notes],
  });
}

export async function addOpportunityTag(id, label) {
  await delay();
  const o = getRow('triangulationOpportunities', 'id', id);
  return patchRow('triangulationOpportunities', 'id', id, { tags: [...o.tags, { label, tone: 'neutral' }] });
}

export async function addOpportunityNote(id, text) {
  await delay();
  const o = getRow('triangulationOpportunities', 'id', id);
  return patchRow('triangulationOpportunities', 'id', id, {
    notes: [{ text, actor: 'Admin (You)', time: 'Just now' }, ...o.notes],
  });
}

// ---- Fleet (continued) ---------------------------------------------------
export async function addTruck(truck) {
  await delay();
  return prependRow('trucks', {
    status: 'Available', loc: '—', state: '—', trip: '—', date: '—',
    ...truck,
  });
}

// ---- Drivers ---------------------------------------------------------
export async function setDriverStatus(id, status) {
  await delay();
  return patchRow('drivers', 'id', id, { status });
}

// ---- Truck Companies ---------------------------------------------------
export async function setCompanyStatus(id, status) {
  await delay();
  return patchRow('companies', 'id', id, { status });
}

export async function setCompanyVerification(id, verification) {
  await delay();
  return patchRow('companies', 'id', id, { verification });
}

export async function addCompany(company) {
  await delay();
  return prependRow('companies', {
    status: 'Active', verification: 'Pending', trucks: 0, drivers: 0, performance: null,
    joined: 'Just now', ...company,
  });
}

// ---- Cargo Types ---------------------------------------------------------
export async function addCargoType(type) {
  await delay();
  return prependRow('cargoTypes', { status: 'Active', ...type });
}

// ---- Verification ------------------------------------------------------
export async function approveVerification(id) {
  await delay();
  return patchRow('verifications', 'id', id, {
    status: 'Verified',
    assessment: 'Compliant',
    activity: [
      { text: 'Verification approved', actor: 'Admin', time: 'Just now', tone: 'var(--tk-success)' },
      ...(getRow('verifications', 'id', id)?.activity || []),
    ],
  });
}

export async function markNonCompliant(id) {
  await delay();
  return patchRow('verifications', 'id', id, {
    status: 'Non-Compliant',
    assessment: 'Non-Compliant',
    riskLevel: 'High',
    activity: [
      { text: 'Marked as non-compliant', actor: 'Admin', time: 'Just now', tone: 'var(--tk-danger)' },
      ...(getRow('verifications', 'id', id)?.activity || []),
    ],
  });
}

export async function cancelVerification(id) {
  await delay();
  return patchRow('verifications', 'id', id, {
    status: 'Cancelled',
    activity: [
      { text: 'Verification cancelled', actor: 'Admin', time: 'Just now' },
      ...(getRow('verifications', 'id', id)?.activity || []),
    ],
  });
}

// ---- Wallet -------------------------------------------------------------
export async function addFunds(amount, { party = 'Manual Top-up', desc = 'Funds added by admin' } = {}) {
  await delay();
  const summary = getSnapshot('walletSummary')[0];
  setRows('walletSummary', [{
    ...summary,
    totalBalance: summary.totalBalance + amount,
    availableBalance: summary.availableBalance + amount,
    totalFundsAdded: summary.totalFundsAdded + amount,
  }]);
  return prependRow('transactions', {
    id: `TRX-2024-${Math.floor(Math.random() * 900 + 100)}`,
    type: 'Funds Added', icon: 'arrow-down', tone: 'var(--tk-success)',
    desc, sub: 'Manual Entry', party, amt: amount, pos: true,
    status: 'Completed', date: 'Just now', time: '',
  });
}

export async function withdrawFunds(amount, { party = 'Bank Withdrawal', desc = 'Funds withdrawn by admin' } = {}) {
  await delay();
  const summary = getSnapshot('walletSummary')[0];
  setRows('walletSummary', [{
    ...summary,
    totalBalance: summary.totalBalance - amount,
    availableBalance: summary.availableBalance - amount,
    totalFundsWithdrawn: summary.totalFundsWithdrawn + amount,
  }]);
  return prependRow('transactions', {
    id: `TRX-2024-${Math.floor(Math.random() * 900 + 100)}`,
    type: 'Withdrawal', icon: 'arrow-up', tone: 'var(--tk-purple)',
    desc, sub: 'Manual Entry', party, amt: -amount, pos: false,
    status: 'Pending', date: 'Just now', time: '',
  });
}

// ---- Announcements --------------------------------------------------------
export async function createAnnouncement(draft) {
  await delay();
  return prependRow('announcements', {
    id: `ANN-2024-${Math.floor(Math.random() * 900 + 100)}`,
    type: 'System', tone: 'orange', icon: 'megaphone', aud: 'All Users',
    st: 'Draft', d: '—', tm: '', v: null,
    ...draft,
  });
}

export async function publishAnnouncement(id) {
  await delay();
  return patchRow('announcements', 'id', id, { st: 'Published', d: 'Just now', tm: '', v: 0 });
}

export async function updateAnnouncement(id, changes) {
  await delay(90);
  return patchRow('announcements', 'id', id, changes);
}

export async function updateFeedback(id, changes) {
  await delay(90);
  return patchRow('feedback', 'id', id, changes);
}

export async function createFeedback(draft) {
  await delay(90);
  return prependRow('feedback', {
    id: `FBK-${String(Math.floor(Math.random() * 900000)).padStart(6, '0')}`,
    excerpt: draft.body, user: 'Trukkas Admin', email: 'admin@trukkas.com',
    phone: '—', topic: 'General', channel: 'Web', status: 'Open', date: 'Just now', time: '',
    location: 'Lagos, Nigeria', device: 'Web Portal', resolution: '—', memberSince: 'Today',
    totalFeedback: 1, assignee: 'Unassigned', tags: [], unread: true, spam: false, note: '', reply: '',
    ...draft,
  });
}

export async function replyToFeedback(id, reply) {
  await delay(90);
  return patchRow('feedback', 'id', id, { reply, status: 'Resolved', unread: false, resolvedOn: 'Just now' });
}

export async function updateDemurrage(id, changes) {
  await delay(90);
  return patchRow('demurrage', 'id', id, changes);
}

export async function createDemurrage(draft) {
  await delay(90);
  return prependRow('demurrage', {
    id: `DEM-2026-${String(Math.floor(Math.random() * 900000)).padStart(6, '0')}`,
    reference: `DMG-${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
    status: 'Active', paid: 0, daysUsed: draft.freeDays + draft.daysOver,
    charge: draft.rate * draft.daysOver, freePeriod: 'Custom', usedPeriod: 'Custom',
    size: '40HC', vessel: 'Manual Entry', voyage: '—', jobType: 'Port Discharge',
    overSince: 'Created just now', chargeStart: 'Just now', dischargePort: '—',
    dischargeDate: '—', customerType: 'Forwarder', note: '',
    ...draft,
  });
}

export async function updateDocument(id, changes) {
  await delay(70);
  return patchRow('documents', 'id', id, changes);
}

export async function deleteDocument(id) {
  await delay(70);
  setRows('documents', getSnapshot('documents').filter((d) => d.id !== id));
}

export async function createDocument(draft) {
  await delay(90);
  return prependRow('documents', {
    id: 'd' + Math.random().toString(36).slice(2, 8), status: 'Pending', route: '—',
    date: 'Just now', time: '', dept: 'Operations', entity: 'Trukkas Admin', entityType: 'Administrator',
    issueDate: 'Just now', expiryDate: '—', issuedBy: 'Trukkas Admin', fileSize: '—',
    uploadedBy: 'Trukkas Admin', uploadDate: 'Just now', risk: 'Low Risk', compliance: 'Pending',
    watchlist: false, notes: [], number: 'DOC/' + Date.now().toString().slice(-8),
    ...draft,
  });
}

export async function bulkUpdateDocuments(ids, changes) {
  await delay(70);
  setRows('documents', getSnapshot('documents').map((d) => ids.includes(d.id) ? { ...d, ...changes } : d));
}

export async function bulkDeleteDocuments(ids) {
  await delay(70);
  setRows('documents', getSnapshot('documents').filter((d) => !ids.includes(d.id)));
}

export async function updateMaintenance(id, changes) {
  await delay(80);
  return patchRow('maintenance', 'id', id, changes);
}

export async function createMaintenance(draft) {
  await delay(100);
  const truck = getRow('trucks', 'plate', draft.plate);
  const id = `MTN-2026-${String(Math.floor(Math.random() * 90000)).padStart(5, '0')}`;
  setTruckStatus(draft.plate, 'In Maintenance');
  return prependRow('maintenance', {
    id, created: 'Just now', truckType: truck?.type || 'Truck', truckRef: truck?.ref || '—',
    company: truck?.company || '—', companyId: truck?.tc || '—', driver: truck?.driver || '—',
    driverId: truck?.dr || '—', makeModel: 'Not specified', year: '—', vin: '—',
    currentOdometer: 0, nextDueOdometer: null, nextDueDate: '—', nextDueDays: null,
    lastUpdated: 'Just now', estimatedCost: Number(draft.estimatedCost || 0), actualCost: null,
    createdBy: 'Trukkas Admin', createdOn: 'Just now', attachments: [],
    status: 'Scheduled', ...draft,
  });
}

export async function updateNotification(id, changes) {
  await delay(60);
  return patchRow('notifications', 'id', id, changes);
}

export async function markAllNotificationsRead() {
  await delay(60);
  setRows('notifications', getSnapshot('notifications').map((row) => ({ ...row, read: true })));
}

export async function deleteNotification(id) {
  await delay(60);
  setRows('notifications', getSnapshot('notifications').filter((row) => row.id !== id));
}

// ---- Pricing Management ---------------------------------------------------
export async function setServicePricingStatus(id, status) {
  await delay();
  return patchRow('servicePricing', 'id', id, { status });
}

export async function addServicePricing(entry) {
  await delay();
  const basePrice = Number(entry.basePrice) || 0;
  const surcharge = Number(entry.surcharge) || 0;
  return prependRow('servicePricing', {
    id: `SVC-2026-${String(Math.floor(Math.random() * 9000 + 1000))}`,
    status: 'Active', unit: 'Per Trip', surchargePct: basePrice ? `${((surcharge / basePrice) * 100).toFixed(1)}%` : '0%',
    updated: 'Just now', updatedTime: '',
    ...entry, basePrice, surcharge, totalPrice: basePrice + surcharge,
  });
}

export async function approvePriceException(id) {
  await delay();
  return patchRow('priceExceptions', 'id', id, { status: 'Approved' });
}

export async function rejectPriceException(id) {
  await delay();
  return patchRow('priceExceptions', 'id', id, { status: 'Rejected' });
}

export async function setSurchargeStatus(id, status) {
  await delay();
  return patchRow('surcharges', 'id', id, { status });
}

// ---- Escrow & Wallets ------------------------------------------------------
export async function releaseEscrowHold(holdId) {
  await delay();
  const hold = getRow('escrowHolds', 'holdId', holdId);
  if (!hold) return null;
  patchRow('escrowHolds', 'holdId', holdId, { status: 'Released' });
  const summary = getSnapshot('escrowSummary')[0];
  setRows('escrowSummary', [{
    ...summary,
    heldInEscrow: summary.heldInEscrow - hold.amount,
    completedReleases: summary.completedReleases + hold.amount,
  }]);
  return prependRow('escrowReleases', {
    releaseId: `REL-${Math.floor(Math.random() * 90000 + 10000)}`,
    jobId: hold.jobId, releasedTo: hold.customer, amount: hold.amount,
    releasedOn: 'Just now', releasedTime: '', releasedBy: 'Admin User',
    reference: `SETT-${Math.floor(Math.random() * 90000 + 10000)}`, status: 'Completed',
  });
}

export async function addEscrowFunds(amount) {
  await delay();
  const summary = getSnapshot('escrowSummary')[0];
  setRows('escrowSummary', [{
    ...summary,
    totalEscrowBalance: summary.totalEscrowBalance + amount,
    availableToSettle: summary.availableToSettle + amount,
  }]);
  return summary;
}

export async function resolveDispute(id) {
  await delay();
  return patchRow('disputes', 'id', id, { status: 'Resolved' });
}

// ---- Settlements ------------------------------------------------------------
export async function retrySettlement(id) {
  await delay();
  return patchRow('settlements', 'id', id, {
    status: 'Completed', settledOn: 'Just now', settledTime: '',
  });
}

export async function approveSettlement(id) {
  await delay();
  return patchRow('settlements', 'id', id, {
    status: 'Completed', settledOn: 'Just now', settledTime: '',
  });
}

// ---- Payouts ------------------------------------------------------------
export async function approvePayoutRequest(id) {
  await delay();
  const p = getRow('payoutRequests', 'id', id);
  if (!p) return null;
  return patchRow('payoutRequests', 'id', id, {
    status: 'Completed',
    relatedTransaction: `TRX-${Math.floor(Math.random() * 90000 + 10000)}`,
    approvedOn: 'Just now', approvedTime: '',
    processedOn: 'Just now', processedTime: '',
  });
}

export async function disapprovePayoutRequest(id, reason) {
  await delay();
  const p = getRow('payoutRequests', 'id', id);
  if (!p) return null;
  return patchRow('payoutRequests', 'id', id, {
    status: 'Rejected',
    adminRemark: reason || p.adminRemark,
  });
}

export async function requestPayoutInfo(id, note) {
  await delay();
  const p = getRow('payoutRequests', 'id', id);
  if (!p) return null;
  return patchRow('payoutRequests', 'id', id, {
    adminRemark: note,
    issueNotes: [{ note: `More info requested: ${note}`, time: 'Just now' }, ...(p.issueNotes || [])],
  });
}

export async function raisePayoutIssue(id, note) {
  await delay();
  const p = getRow('payoutRequests', 'id', id);
  if (!p) return null;
  return patchRow('payoutRequests', 'id', id, {
    issueNotes: [{ note, time: 'Just now' }, ...(p.issueNotes || [])],
  });
}

export async function createPayoutRefund(id, amount) {
  await delay();
  const p = getRow('payoutRequests', 'id', id);
  if (!p) return null;
  return patchRow('payoutRequests', 'id', id, {
    issueNotes: [{ note: `Refund of ${amount.toLocaleString('en-NG')} created against this payout.`, time: 'Just now' }, ...(p.issueNotes || [])],
  });
}

// ---- Transactions ------------------------------------------------------------
let txSeq = 83000;

export async function retryTransaction(id) {
  await delay();
  const t = getRow('transactionRows', 'id', id);
  if (!t) return null;
  return patchRow('transactionRows', 'id', id, {
    status: 'Completed',
    timeline: [
      { title: 'Transaction retried', time: 'Just now', description: 'Retried by admin and confirmed.', state: 'done', icon: 'check' },
      ...t.timeline,
    ],
  });
}

export async function reverseTransaction(id) {
  await delay();
  const t = getRow('transactionRows', 'id', id);
  if (!t) return null;
  patchRow('transactionRows', 'id', id, {
    status: 'Reversed',
    timeline: [
      { title: 'Transaction reversed', time: 'Just now', description: 'Reversal issued by admin.', state: 'warning', icon: 'rotate-ccw' },
      ...t.timeline,
    ],
  });
  return prependRow('transactionRows', makeTransaction({
    id: `TRX-${txSeq++}`, date: 'Just now', time: '', description: `Reversed transaction (${t.id})`,
    type: 'Reversal', relatedTo: t.id, party: 'System', amount: t.amount, balanceAfter: t.balanceAfter, status: 'Reversed',
    payer: { name: 'Trukkas Platform', id: 'System', email: 'payment@trukkas.com', phone: '—' },
    payee: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    breakdown: null,
  }));
}

export async function createRefund(id, amount) {
  await delay();
  const t = getRow('transactionRows', 'id', id);
  if (!t) return null;
  const payer = t.parties?.find((p) => p.role.startsWith('Payer')) || { name: t.party, id: '—', email: '—', phone: '—' };
  return prependRow('transactionRows', makeTransaction({
    id: `TRX-${txSeq++}`, date: 'Just now', time: '', description: `Refund for ${t.id}`,
    type: 'Refund', relatedTo: t.relatedTo, party: payer.name, amount: -Math.abs(amount), balanceAfter: t.balanceAfter, status: 'Completed',
    payer: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    payee: { name: payer.name, id: payer.id, email: payer.email, phone: payer.phone },
    breakdown: null,
  }));
}

export async function reportTransactionIssue(id, note) {
  await delay();
  const t = getRow('transactionRows', 'id', id);
  if (!t) return null;
  return patchRow('transactionRows', 'id', id, {
    issueNotes: [{ note, time: 'Just now' }, ...(t.issueNotes || [])],
  });
}

// ---- Reports & Analytics ------------------------------------------------------
export function getReportDraft() {
  return getSnapshot('reportDraft')[0];
}

export function updateReportDraft(patch) {
  const cur = getSnapshot('reportDraft')[0];
  setRows('reportDraft', [{ ...cur, ...patch }]);
  return getSnapshot('reportDraft')[0];
}

export function toggleReportColumn(groupName, key) {
  const cur = getSnapshot('reportDraft')[0];
  const columnGroups = cur.columnGroups.map((g) => (
    g.group !== groupName ? g : { ...g, columns: g.columns.map((c) => (c.key === key ? { ...c, checked: !c.checked } : c)) }
  ));
  setRows('reportDraft', [{ ...cur, columnGroups }]);
  return getSnapshot('reportDraft')[0];
}

export function setReportColumnGroup(groupName, checked) {
  const cur = getSnapshot('reportDraft')[0];
  const columnGroups = cur.columnGroups.map((g) => (
    g.group !== groupName ? g : { ...g, columns: g.columns.map((c) => ({ ...c, checked })) }
  ));
  setRows('reportDraft', [{ ...cur, columnGroups }]);
  return getSnapshot('reportDraft')[0];
}

export function setAllReportColumns(checked) {
  const cur = getSnapshot('reportDraft')[0];
  const columnGroups = cur.columnGroups.map((g) => ({ ...g, columns: g.columns.map((c) => ({ ...c, checked })) }));
  setRows('reportDraft', [{ ...cur, columnGroups }]);
  return getSnapshot('reportDraft')[0];
}

export async function saveReportTemplate(name) {
  await delay();
  const draft = getSnapshot('reportDraft')[0];
  return prependRow('reportTemplates', {
    id: `TPL-${Math.floor(Math.random() * 9000 + 1000)}`, name, savedAt: 'Just now', draft,
  });
}

export async function scheduleReport({ reportType, frequency, recipients }) {
  await delay();
  return { reportType, frequency, recipients, scheduledAt: 'Just now' };
}

// ---- User Management ---------------------------------------------------
let userSeq = 91;

export async function setUserStatus(id, status) {
  await delay();
  return patchRow('users', 'id', id, { status });
}

export async function deactivateUser(id) {
  return setUserStatus(id, 'Inactive');
}

export async function activateUser(id) {
  return setUserStatus(id, 'Active');
}

export async function lockUserAccount(id) {
  return setUserStatus(id, 'Locked');
}

export async function unlockUserAccount(id) {
  return setUserStatus(id, 'Active');
}

export async function resetUserPassword(id) {
  await delay();
  return patchRow('users', 'id', id, { passwordLastChanged: 'Just now' });
}

export async function addUser(entry) {
  await delay();
  return prependRow('users', {
    id: `USR-2024-${String(userSeq++).padStart(5, '0')}`,
    status: 'Active', joinedOn: 'Just now', lastActive: '—', online: false,
    phone: '—', location: '—', department: '—',
    passwordLastChanged: 'Just now', totalLogins: 0, failedLogins: 0, activeSessions: 0,
    lastLoginDetail: '—', accountCreated: 'Just now', permissionsCaption: '0 modules • 0 actions',
    twoFactor: false, passwordStrength: 'Weak', passwordStrengthPct: 20, passwordExpires: '—',
    loginNotifications: true, emailVerified: false, phoneVerified: false, roleTone: 'neutral',
    ...entry,
  });
}

export async function deleteUser(id) {
  await delay();
  setRows('users', getSnapshot('users').filter((u) => u.id !== id));
}

// ---- Roles & Permissions -------------------------------------------------
let roleSeq = 9;

export async function setRoleStatus(id, status) {
  await delay();
  return patchRow('roles', 'id', id, { status });
}

export async function createRole(draft) {
  await delay();
  return prependRow('roles', {
    id: `ROL-2024-${String(roleSeq++).padStart(4, '0')}`,
    type: 'Custom', users: 0, status: 'Active',
    lastUpdated: 'Just now', createdOn: 'Just now', createdBy: 'Trukkas Admin',
    color: '#0241E8', icon: 'shield', permissionsCount: 0,
    permissionSummary: draft.description || '—', modules: [],
    ...draft,
  });
}

export async function deleteRole(id) {
  await delay();
  setRows('roles', getSnapshot('roles').filter((r) => r.id !== id));
}

// ---- Support & Knowledge Base -------------------------------------------
export async function updateTicket(id, changes) {
  await delay(90);
  return patchRow('supportTickets', 'id', id, { ...changes, updated: 'Just now' });
}

export async function createSupportTicket(draft) {
  await delay(90);
  return prependRow('supportTickets', {
    id: `TKTS-2024-${String(Math.floor(Math.random() * 9000)).padStart(4, '0')}`,
    status: 'Open', assignee: 'Unassigned', source: 'Admin Portal', company: draft.customer,
    subcategory: 'General', created: 'Just now', updated: 'Just now', attachments: [], messages: [],
    ...draft,
  });
}

export async function replyToTicket(id, body, internal = false) {
  await delay(90);
  const ticket = getRow('supportTickets', 'id', id);
  return patchRow('supportTickets', 'id', id, {
    updated: 'Just now',
    messages: [...(ticket.messages || []), {
      author: 'Trukkas Admin', initials: 'TA', role: internal ? 'Internal Note' : 'Support Agent',
      time: 'Just now', agent: true, internal, body,
    }],
  });
}

export async function createKnowledgeArticle(draft) {
  await delay(120);
  const id = (draft.title || 'untitled-article').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return prependRow('knowledgeArticles', {
    id: id || `article-${Date.now()}`, author: 'Trukkas Admin', views: 0, helpful: null,
    updated: 'Just now', time: '', visibility: 'Public', feedback: true, related: true,
    ...draft,
  });
}

export async function updateKnowledgeArticle(id, changes) {
  await delay(90);
  return patchRow('knowledgeArticles', 'id', id, { ...changes, updated: 'Just now' });
}

// ---- System Settings ------------------------------------------------------
function touchSettingsMeta() {
  setRows('settingsMeta', [{ lastUpdated: 'Just now', updatedBy: 'Trukkas Admin' }]);
}

function updateSettingsDomain(domain, patch) {
  const cur = getSnapshot(domain)?.[0] || {};
  const next = { ...cur, ...patch };
  setRows(domain, [next]);
  touchSettingsMeta();
  return next;
}

export async function updatePlatformInfo(patch) {
  await delay();
  return updateSettingsDomain('settingsPlatformInfo', patch);
}

export async function updateOperationalGeneral(patch) {
  await delay();
  return updateSettingsDomain('settingsOperationalGeneral', patch);
}

export async function updateNotificationGeneral(patch) {
  await delay();
  return updateSettingsDomain('settingsNotificationGeneral', patch);
}

export async function updateJobTripSettings(patch) {
  await delay();
  return updateSettingsDomain('settingsJobTrip', patch);
}

export async function updateBiddingAssignment(patch) {
  await delay();
  return updateSettingsDomain('settingsBiddingAssignment', patch);
}

export async function updateDispatchTracking(patch) {
  await delay();
  return updateSettingsDomain('settingsDispatchTracking', patch);
}

export async function updateDocumentCompliance(patch) {
  await delay();
  return updateSettingsDomain('settingsDocumentCompliance', patch);
}

export async function updateTimingSlas(patch) {
  await delay();
  return updateSettingsDomain('settingsTimingSlas', patch);
}

export async function updateOperationsCommunication(patch) {
  await delay();
  return updateSettingsDomain('settingsOperationsCommunication', patch);
}

export async function saveOperationsSettings() {
  await delay();
  touchSettingsMeta();
}

export async function resetOperationsSettings() {
  await delay();
  setRows('settingsJobTrip', [jobTripSettings]);
  setRows('settingsBiddingAssignment', [biddingAssignment]);
  setRows('settingsDispatchTracking', [dispatchTracking]);
  setRows('settingsDocumentCompliance', [documentCompliance]);
  setRows('settingsTimingSlas', [timingSlas]);
  setRows('settingsOperationsCommunication', [operationsCommunication]);
  touchSettingsMeta();
}

export async function updateFinancialPolicies(patch) {
  await delay();
  return updateSettingsDomain('settingsFinancialPolicies', patch);
}

export async function updatePlatformFees(patch) {
  await delay();
  return updateSettingsDomain('settingsPlatformFees', patch);
}

export async function updateEscrowSettingsForm(patch) {
  await delay();
  return updateSettingsDomain('settingsEscrow', patch);
}

export async function updatePayoutSettingsForm(patch) {
  await delay();
  return updateSettingsDomain('settingsPayout', patch);
}

export async function updateInvoicingReceipts(patch) {
  await delay();
  return updateSettingsDomain('settingsInvoicing', patch);
}

export async function updateAccountingTax(patch) {
  await delay();
  return updateSettingsDomain('settingsAccountingTax', patch);
}

export async function saveFinanceSettings() {
  await delay();
  touchSettingsMeta();
}

export async function resetFinanceSettings() {
  await delay();
  setRows('settingsFinancialPolicies', [financialPolicies]);
  setRows('settingsPlatformFees', [platformFees]);
  setRows('settingsEscrow', [escrowSettingsForm]);
  setRows('settingsPayout', [payoutSettingsForm]);
  setRows('settingsInvoicing', [invoicingReceipts]);
  setRows('settingsAccountingTax', [accountingTax]);
  touchSettingsMeta();
}

export async function resetPlatformSettings() {
  await delay();
  setRows('settingsPlatformInfo', [platformInfo]);
  setRows('settingsOperationalGeneral', [operationalGeneral]);
  setRows('settingsNotificationGeneral', [notificationGeneral]);
  touchSettingsMeta();
}

// ---- Notification Preferences (System Settings > Notifications) ----------
export async function updateNotificationChannels(patch) {
  await delay();
  return updateSettingsDomain('settingsNotificationChannels', patch);
}

export async function updateQuietHours(patch) {
  await delay();
  return updateSettingsDomain('settingsQuietHours', patch);
}

export async function toggleEventNotification(eventKey, channel, value) {
  await delay(80);
  const groups = getSnapshot('settingsEventNotifications') || [];
  const next = groups.map((g) => ({
    ...g,
    events: g.events.map((ev) => (ev.key === eventKey ? { ...ev, [channel]: value } : ev)),
  }));
  setRows('settingsEventNotifications', next);
  touchSettingsMeta();
  return next;
}

export async function setEventNotificationFrequency(eventKey, frequency) {
  await delay(80);
  const groups = getSnapshot('settingsEventNotifications') || [];
  const next = groups.map((g) => ({
    ...g,
    events: g.events.map((ev) => (ev.key === eventKey ? { ...ev, frequency } : ev)),
  }));
  setRows('settingsEventNotifications', next);
  touchSettingsMeta();
  return next;
}

export async function saveNotificationPreferences() {
  await delay();
  touchSettingsMeta();
}

export async function resetNotificationPreferences() {
  await delay();
  setRows('settingsNotificationChannels', [notificationChannelDefaults]);
  setRows('settingsQuietHours', [quietHours]);
  setRows('settingsEventNotifications', eventNotificationGroups);
  touchSettingsMeta();
}



export async function saveCompanySettings() {
  await delay();
  touchSettingsMeta();
}

// ---- Fleet Settings ----------------------------------------------------------
export async function updateFleetPreferences(patch) {
  await delay();
  return updateSettingsDomain('settingsFleetPreferences', patch);
}

export async function updateAssetNumbering(patch) {
  await delay();
  return updateSettingsDomain('settingsAssetNumbering', patch);
}

export async function updateDefaultReminders(patch) {
  await delay();
  return updateSettingsDomain('settingsDefaultReminders', patch);
}

export async function updateFleetVisibility(patch) {
  await delay();
  return updateSettingsDomain('settingsFleetVisibility', patch);
}

export async function updateDeletionArchiving(patch) {
  await delay();
  return updateSettingsDomain('settingsDeletionArchiving', patch);
}

export async function updateFleetDataRetention(patch) {
  await delay();
  return updateSettingsDomain('settingsFleetDataRetention', patch);
}

export async function saveFleetSettings() {
  await delay();
  touchSettingsMeta();
}

export async function resetFleetSettings() {
  await delay();
  setRows('settingsFleetPreferences', [fleetPreferences]);
  setRows('settingsAssetNumbering', [assetNumbering]);
  setRows('settingsDefaultReminders', [defaultReminders]);
  setRows('settingsFleetVisibility', [fleetVisibility]);
  setRows('settingsDeletionArchiving', [deletionArchiving]);
  setRows('settingsFleetDataRetention', [fleetDataRetention]);
  touchSettingsMeta();
}

// ---- Data Protection -----------------------------------------------------------
export async function updateDataPrivacyConsent(patch) {
  await delay();
  return updateSettingsDomain('settingsDataPrivacyConsent', patch);
}

export async function updateDataEncryption(patch) {
  await delay();
  return updateSettingsDomain('settingsDataEncryption', patch);
}

export async function updateDataRetentionSecurity(patch) {
  await delay();
  return updateSettingsDomain('settingsDataRetentionSecurity', patch);
}

export async function updateDataExportAccess(patch) {
  await delay();
  return updateSettingsDomain('settingsDataExportAccess', patch);
}

export async function updateDataDeletion(patch) {
  await delay();
  return updateSettingsDomain('settingsDataDeletion', patch);
}

export async function saveSecuritySettings() {
  await delay();
  touchSettingsMeta();
}

export async function saveDataProtectionSettings() {
  await delay();
  touchSettingsMeta();
}

export async function resetDataProtectionSettings() {
  await delay();
  setRows('settingsDataPrivacyConsent', [dataPrivacyConsent]);
  setRows('settingsDataEncryption', [dataEncryption]);
  setRows('settingsDataRetentionSecurity', [dataRetentionSecurity]);
  setRows('settingsDataExportAccess', [dataExportAccess]);
  setRows('settingsDataDeletion', [dataDeletionSettings]);
  touchSettingsMeta();
}

// ---- Security (overview) ------------------------------------------------------
export async function updateAuthSettings(patch) {
  await delay();
  return updateSettingsDomain('settingsAuth', patch);
}

export async function updatePasswordPolicyOverview(patch) {
  await delay();
  return updateSettingsDomain('settingsPasswordPolicyOverview', patch);
}

export async function updateSessionManagementOverview(patch) {
  await delay();
  return updateSettingsDomain('settingsSessionManagementOverview', patch);
}

export async function updateIpDeviceRestrictionsOverview(patch) {
  await delay();
  return updateSettingsDomain('settingsIpDeviceRestrictionsOverview', patch);
}

export async function updateDataProtectionOverview(patch) {
  await delay();
  return updateSettingsDomain('settingsDataProtectionOverview', patch);
}

export async function updateSecurityAlertsOverview(patch) {
  await delay();
  return updateSettingsDomain('settingsSecurityAlertsOverview', patch);
}

export async function resetSecuritySettings() {
  await delay();
  setRows('settingsAuth', [authSettings]);
  setRows('settingsPasswordPolicyOverview', [passwordPolicyOverview]);
  setRows('settingsSessionManagementOverview', [sessionManagementOverview]);
  setRows('settingsIpDeviceRestrictionsOverview', [ipDeviceRestrictionsOverview]);
  setRows('settingsDataProtectionOverview', [dataProtectionOverview]);
  setRows('settingsSecurityAlertsOverview', [securityAlertsOverview]);
  touchSettingsMeta();
}

// ---- Password & Sessions --------------------------------------------------------
export async function updatePasswordRequirements(patch) {
  await delay();
  return updateSettingsDomain('settingsPasswordRequirements', patch);
}

export async function updateSessionSettings(patch) {
  await delay();
  return updateSettingsDomain('settingsSessionSettings', patch);
}

export async function updateLoginNotifications(patch) {
  await delay();
  return updateSettingsDomain('settingsLoginNotifications', patch);
}

export async function terminateSession(id) {
  await delay(120);
  setRows('settingsActiveSessions', getSnapshot('settingsActiveSessions').filter((s) => s.id !== id));
}

export async function savePasswordSettings() {
  await delay();
  touchSettingsMeta();
}

export async function resetPasswordSettings() {
  await delay();
  setRows('settingsPasswordRequirements', [passwordRequirements]);
  setRows('settingsSessionSettings', [sessionSettings]);
  setRows('settingsLoginNotifications', [loginNotificationsSettings]);
  touchSettingsMeta();
}

export async function resetAllUserSessions() {
  await delay(150);
  setRows('settingsActiveSessions', []);
}

// ---- Security Alerts ---------------------------------------------------------
export async function toggleSecurityAlertChannel(eventKey, channel, value) {
  await delay(80);
  const events = getSnapshot('settingsSecurityAlertEvents') || [];
  setRows('settingsSecurityAlertEvents', events.map((ev) => (ev.key === eventKey ? { ...ev, [channel]: value } : ev)));
  touchSettingsMeta();
}

export async function updateAlertDelivery(patch) {
  await delay();
  return updateSettingsDomain('settingsAlertDelivery', patch);
}

export async function updateSecurityAlertsQuietHours(patch) {
  await delay();
  return updateSettingsDomain('settingsSecurityAlertsQuietHours', patch);
}

export async function saveSecurityAlertsSettings() {
  await delay();
  touchSettingsMeta();
}

export async function resetSecurityAlertsSettings() {
  await delay();
  setRows('settingsSecurityAlertEvents', securityAlertEvents);
  setRows('settingsAlertDelivery', [alertDeliverySettings]);
  setRows('settingsSecurityAlertsQuietHours', [securityAlertsQuietHours]);
  touchSettingsMeta();
}
