// Escrow Wallet — transcribed from uploads/trukkas-admin/087.jpeg.

export const escrowSummary = {
  totalEscrowBalance: 62430000, totalEscrowBalanceDelta: '14.6%',
  heldInEscrow: 48670000, heldInEscrowDelta: '9.3%',
  pendingRelease: 8240000, pendingReleaseDelta: '4.7%', pendingReleaseDirection: 'down',
  availableToSettle: 5520000, availableToSettleDelta: '21.8%',
  completedReleases: 36210000, completedReleasesDelta: '18.5%',
  disputedAmounts: 1120000, disputedAmountsDelta: '12.1%', disputedAmountsDirection: 'down',
};

export const escrowBalanceBreakdown = [
  { label: 'Held in Escrow', value: 48670000, pct: '78.0%', color: 'var(--tk-viz-1)' },
  { label: 'Pending Release', value: 8240000, pct: '13.2%', color: 'var(--tk-viz-3)' },
  { label: 'Available to Settle', value: 5520000, pct: '8.8%', color: 'var(--tk-viz-5)' },
  { label: 'Disputed Amounts', value: 1120000, pct: '1.8%', color: 'var(--tk-danger-solid)' },
];

export const escrowWeeklyActivity = {
  fundsHeld: 22340000, fundsHeldTx: 23,
  fundsReleased: 18960000, fundsReleasedTx: 31,
  settlementsMade: 18440000, settlementsCount: 28,
  newDisputes: 2, newDisputesAmount: 1120000,
};

export const escrowAccounts = [
  { id: 'ACC-ESC-001', name: 'Trukkas Main Escrow', balance: 42150000, status: 'Active' },
  { id: 'ACC-ESC-002', name: 'Transporter Escrow Pool', balance: 13680000, status: 'Active' },
  { id: 'ACC-ESC-003', name: 'Customer Escrow Pool', balance: 5720000, status: 'Active' },
  { id: 'ACC-ESC-004', name: 'Dispute Escrow Pool', balance: 880000, status: 'Active' },
];

export const escrowHolds = [
  { holdId: 'HOLD-87291', jobId: 'JOB-29821', customer: 'Goodwill Forwarding Ltd.', route: 'Apapa Port → Ikeja Warehouse', amount: 3250000, heldOn: 'May 30, 2026', heldTime: '09:42 AM', releaseBy: 'Jun 2, 2026', status: 'Held' },
  { holdId: 'HOLD-87290', jobId: 'JOB-29820', customer: 'CargoLink Logistics', route: 'Tin Can Port → Onne Port', amount: 2800000, heldOn: 'May 30, 2026', heldTime: '09:37 AM', releaseBy: 'Jun 1, 2026', status: 'Held' },
  { holdId: 'HOLD-87289', jobId: 'JOB-29819', customer: 'ABC Forwarders Ltd.', route: 'Apapa Port → Ibadan Dry Port', amount: 4150000, heldOn: 'May 30, 2026', heldTime: '09:22 AM', releaseBy: 'Jun 3, 2026', status: 'Pending Release' },
  { holdId: 'HOLD-87288', jobId: 'JOB-29818', customer: 'DCL Shipping Services', route: 'Port Harcourt → Aba Depot', amount: 1980000, heldOn: 'May 30, 2026', heldTime: '08:58 AM', releaseBy: 'Jun 1, 2026', status: 'Held' },
  { holdId: 'HOLD-87287', jobId: 'JOB-29817', customer: 'Nigerian Bulk Consortia', route: 'Apapa Port → Ibadan Dry Port', amount: 2450000, heldOn: 'May 30, 2026', heldTime: '08:15 AM', releaseBy: 'Jun 2, 2026', status: 'Held' },
  { holdId: 'HOLD-87286', jobId: 'JOB-29816', customer: 'Transglobal Logistics', route: 'Onne Port → Owerri', amount: 2950000, heldOn: 'May 29, 2026', heldTime: '07:48 AM', releaseBy: 'May 31, 2026', status: 'Held' },
  { holdId: 'HOLD-87285', jobId: 'JOB-29815', customer: 'Innocent Logistics', route: 'Ikeja Warehouse → Apapa Port', amount: 1850000, heldOn: 'May 29, 2026', heldTime: '07:12 AM', releaseBy: 'May 31, 2026', status: 'Pending Release' },
  { holdId: 'HOLD-87284', jobId: 'JOB-29814', customer: 'Haulage Plus Ltd.', route: 'Lagos → Warri', amount: 3700000, heldOn: 'May 29, 2026', heldTime: '06:32 PM', releaseBy: 'Jun 3, 2026', status: 'Held' },
];

export const escrowReleases = [
  { releaseId: 'REL-67123', jobId: 'JOB-29816', releasedTo: 'Transporter: John Adewale', amount: 2950000, releasedOn: 'May 30, 2026', releasedTime: '07:48 AM', releasedBy: 'Admin User', reference: 'SETT-98231', status: 'Completed' },
  { releaseId: 'REL-67122', jobId: 'JOB-29815', releasedTo: 'Transporter: T. James', amount: 1850000, releasedOn: 'May 30, 2026', releasedTime: '07:12 AM', releasedBy: 'Admin User', reference: 'SETT-98230', status: 'Completed' },
  { releaseId: 'REL-67121', jobId: 'JOB-29814', releasedTo: 'Transporter: S. Musa', amount: 3700000, releasedOn: 'May 29, 2026', releasedTime: '06:32 PM', releasedBy: 'Admin User', reference: 'SETT-98229', status: 'Completed' },
  { releaseId: 'REL-67120', jobId: 'JOB-29813', releasedTo: 'Transporter: A. Ibrahim', amount: 1750000, releasedOn: 'May 29, 2026', releasedTime: '05:58 AM', releasedBy: 'Admin User', reference: 'SETT-98228', status: 'Completed' },
  { releaseId: 'REL-67119', jobId: 'JOB-29812', releasedTo: 'Transporter: O. Chinedu', amount: 980000, releasedOn: 'May 28, 2026', releasedTime: '03:33 PM', releasedBy: 'Admin User', reference: 'SETT-98227', status: 'Completed' },
];

export const escrowAlerts = [
  { icon: 'triangle-alert', tone: 'amber', title: '2 releases pending approval', description: 'Total amount: ₦2,450,000.00', time: '15m ago' },
  { icon: 'circle-alert', tone: 'red', title: 'Dispute opened for JOB-29813', description: 'Amount: ₦620,000.00', time: '1h ago' },
  { icon: 'circle-check', tone: 'green', title: 'Settlement completed for JOB-29812', description: 'Amount: ₦1,780,000.00', time: '3h ago' },
];

export const disputes = [
  { id: 'DSP-2026-0041', jobId: 'JOB-29813', holdId: 'HOLD-87280', customer: 'Zenith Transport Co.', amount: 620000, reason: 'Cargo shortage claim', status: 'Open', opened: 'May 30, 2026' },
  { id: 'DSP-2026-0040', jobId: 'JOB-29790', holdId: 'HOLD-87261', customer: 'Atlantic Logistics Ltd', amount: 500000, reason: 'Late delivery penalty dispute', status: 'Under Review', opened: 'May 26, 2026' },
];

export const escrowTransactions = [
  { id: 'TRX-ESC-3312', type: 'Held', icon: 'hourglass', tone: 'var(--tk-warning)', jobId: 'JOB-29821', party: 'Goodwill Forwarding Ltd.', amount: 3250000, pos: false, date: 'May 30, 2026', time: '09:42 AM' },
  { id: 'TRX-ESC-3311', type: 'Released', icon: 'arrow-up', tone: 'var(--tk-success)', jobId: 'JOB-29816', party: 'John Adewale', amount: 2950000, pos: true, date: 'May 30, 2026', time: '07:48 AM' },
  { id: 'TRX-ESC-3310', type: 'Held', icon: 'hourglass', tone: 'var(--tk-warning)', jobId: 'JOB-29820', party: 'CargoLink Logistics', amount: 2800000, pos: false, date: 'May 30, 2026', time: '09:37 AM' },
  { id: 'TRX-ESC-3309', type: 'Settled', icon: 'coins', tone: 'var(--tk-blue)', jobId: 'JOB-29815', party: 'T. James', amount: 1850000, pos: true, date: 'May 30, 2026', time: '07:12 AM' },
  { id: 'TRX-ESC-3308', type: 'Disputed', icon: 'circle-alert', tone: 'var(--tk-danger)', jobId: 'JOB-29813', party: 'Zenith Transport Co.', amount: 620000, pos: false, date: 'May 30, 2026', time: '05:10 AM' },
];

export const escrowRules = [
  { id: 'ESR-001', icon: 'lock', iconTint: 'blue', name: 'Standard Hold Period', description: 'Funds held until delivery confirmation + 48 hours', value: '48 hrs' },
  { id: 'ESR-002', icon: 'shield-check', iconTint: 'green', name: 'Auto-Release on Confirmation', description: 'Releases automatically when customer confirms delivery', value: 'Enabled' },
  { id: 'ESR-003', icon: 'circle-alert', iconTint: 'red', name: 'Dispute Freeze', description: 'Freezes release while a dispute is open', value: 'Enabled' },
  { id: 'ESR-004', icon: 'percent', iconTint: 'purple', name: 'Platform Fee Deduction', description: 'Deducted from held amount before release', value: '2.5%' },
];

export const escrowActivityLog = [
  { text: 'Escrow hold created for JOB-29821', actor: 'System', time: 'Today, 09:42 AM' },
  { text: 'Escrow hold created for JOB-29820', actor: 'System', time: 'Today, 09:37 AM' },
  { text: 'Release approved for HOLD-87286 (JOB-29816)', actor: 'Admin User', time: 'Today, 07:48 AM' },
  { text: 'Dispute opened for JOB-29813', actor: 'Zenith Transport Co.', time: 'Today, 05:10 AM' },
  { text: 'Settlement completed for JOB-29812', actor: 'Admin User', time: 'Yesterday, 03:33 PM' },
];
