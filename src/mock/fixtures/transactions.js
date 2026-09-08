// Transactions — transcribed from uploads/trukkas-admin/089.jpeg (list) and
// 090.jpeg (TRX-82931 detail). The screenshot's "Showing 1 to 10 of 3,842
// transactions" implies a much larger platform-wide ledger; this fixture mocks
// a real, paginated subset — same treatment Settlements gave its 1,248-row stat.
// Every row carries full detail-page data (parties, job info, timeline,
// documents) so any row in the list can be opened, not just TRX-82931.

export const transactionSummary = {
  totalTransactions: 3842, totalTransactionsDelta: '12.6%',
  totalInflow: 142560000, totalInflowDelta: '18.4%',
  totalOutflow: 98430000, totalOutflowDelta: '6.2%', totalOutflowDirection: 'down',
  netMovement: 44130000, netMovementDelta: '37.5%',
  successfulCount: 3701, successfulPct: '96.3%', successfulDelta: '2.1%',
  failedReversedCount: 141, failedReversedPct: '3.7%', failedReversedDelta: '1.8%', failedReversedDirection: 'down',
};

const BREAKDOWN_TYPES = ['Payment In', 'Payout', 'Payment Out', 'Escrow Release'];

function mkTimeline({ status, initiated, received, cleared, completed, verb = 'Payment received' }) {
  const steps = [
    { title: 'Transaction initiated', time: initiated, description: 'Customer initiated payment.', state: 'done', icon: 'check' },
    { title: verb, time: received, description: 'Amount received and queued for clearing.', state: 'done', icon: 'check' },
  ];
  if (status === 'Failed') {
    steps.push({ title: 'Transaction failed', time: cleared, description: 'Provider declined the transfer.', state: 'danger', icon: 'x' });
    return steps;
  }
  if (status === 'Reversed') {
    steps.push({ title: 'Funds cleared', time: cleared, description: 'Payment confirmed and cleared.', state: 'done', icon: 'check' });
    steps.push({ title: 'Transaction reversed', time: completed, description: 'Reversal issued and settled.', state: 'warning', icon: 'rotate-ccw' });
    return steps;
  }
  steps.push({ title: 'Funds cleared', time: cleared, description: 'Payment confirmed and cleared.', state: 'done', icon: 'check' });
  if (status === 'Pending') {
    steps.push({ title: 'Awaiting completion', description: 'Pending final confirmation.', state: 'current', icon: 'hourglass' });
  } else {
    steps.push({ title: 'Transaction completed', time: completed, description: 'Funds secured in escrow.', state: 'done', icon: 'check' });
  }
  return steps;
}

export function makeTransaction(o) {
  const {
    id, date, time, description, note: descNote, type, relatedTo, party, amount, status = 'Completed', balanceAfter,
    payer, payee, processedBy = { name: 'Trukkas Platform', id: 'System', email: 'payment@trukkas.com', phone: '—' },
    jobId, route, cargoType = 'General Cargo (Container)', truck, tripId,
    method = 'Bank Transfer', bank = 'Access Bank', accountNumber = '0123456789', accountName = 'Trukkas Escrow Account',
    customerRef, internalNote,
    initiatedTime, receivedTime, clearedTime, completedTime,
    documents,
  } = o;
  const pos = amount >= 0;
  const abs = Math.abs(amount);
  let breakdown = o.breakdown;
  if (breakdown === undefined && BREAKDOWN_TYPES.includes(type)) {
    const serviceFee = Math.round(abs * 0.04);
    const escrowFee = Math.round(abs * 0.02);
    const base = abs - serviceFee - escrowFee;
    breakdown = [
      { label: 'Base Freight Amount', value: base },
      { label: 'Service Fee (Platform)', value: serviceFee },
      { label: 'Escrow Fee (1%)', value: escrowFee },
    ];
  }
  return {
    id, date, time, description, note: descNote, type, relatedTo, party, amount: abs, pos, status, balanceAfter,
    parties: [
      payer && { role: 'Payer (Customer)', tint: 'blue', ...payer },
      payee && { role: 'Payee (Beneficiary)', tint: 'green', ...payee },
      { role: 'Processed By', tint: 'purple', ...processedBy },
    ].filter(Boolean),
    jobInfo: jobId ? { jobId, route, cargoType, truck, tripId } : null,
    breakdown: breakdown || null,
    paymentMethod: { method, bank, accountNumber, accountName },
    reference: { customerRef: customerRef || relatedTo, internalNote: internalNote || '—' },
    timeline: mkTimeline({
      status, initiated: initiatedTime || time, received: receivedTime || time, cleared: clearedTime || time, completed: completedTime || time,
      verb: pos ? 'Payment received' : 'Payment sent',
    }),
    documents: documents || [
      { name: `receipt_${id}.pdf`, size: '186 KB', kind: 'pdf' },
    ],
    issueNotes: [],
  };
}
const mk = makeTransaction;

export const transactionRows = [
  mk({
    id: 'TRX-82931', date: 'May 30, 2026', time: '09:42 AM', description: 'Payment received for JOB-29821',
    note: 'Funds received from customer into escrow for freight movement.',
    type: 'Payment In', relatedTo: 'JOB-29821', party: 'Goodwill Forwarding Ltd.', amount: 2450000, balanceAfter: 62430000,
    payer: { name: 'Goodwill Forwarding Ltd.', id: 'CUST-00123', email: 'payer@goodwillng.com', phone: '+234 803 123 4567' },
    payee: { name: 'John Adewale', id: 'DRV-0045', email: 'driver.john@trukkas.com', phone: '+234 806 987 6543' },
    jobId: 'JOB-29821', route: 'Apapa Port → Ikeja Warehouse', truck: 'TRK-1045', tripId: 'TRIP-98214',
    customerRef: 'INV-7782', internalNote: 'Advance payment for container movement.',
    initiatedTime: '09:40 AM', receivedTime: '09:42 AM', clearedTime: '09:45 AM', completedTime: '09:45 AM',
    documents: [
      { name: 'receipt_TRX-82931.pdf', size: '210 KB', kind: 'pdf' },
      { name: 'bank_confirmation.pdf', size: '154 KB', kind: 'pdf' },
      { name: 'invoice_INV-7782.pdf', size: '198 KB', kind: 'pdf' },
    ],
  }),
  mk({
    id: 'TRX-82930', date: 'May 30, 2026', time: '08:58 AM', description: 'Driver payout for Trip TRIP-98214',
    note: 'Driver payout released after trip completion.',
    type: 'Payout', relatedTo: 'TRIP-98214', party: 'John Adewale', amount: -1750000, balanceAfter: 59980000,
    payer: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    payee: { name: 'John Adewale', id: 'DRV-0045', email: 'driver.john@trukkas.com', phone: '+234 806 987 6543' },
    jobId: 'JOB-29821', route: 'Apapa Port → Ikeja Warehouse', truck: 'TRK-1045', tripId: 'TRIP-98214',
    initiatedTime: '08:55 AM', receivedTime: '08:57 AM', clearedTime: '08:58 AM', completedTime: '08:58 AM',
  }),
  mk({
    id: 'TRX-82929', date: 'May 30, 2026', time: '07:31 AM', description: 'Escrow release to transporter JOB-29820',
    note: 'Escrow funds released to transporter on delivery confirmation.',
    type: 'Escrow Release', relatedTo: 'JOB-29820', party: 'ABC Forwarders Ltd.', amount: -4800000, balanceAfter: 61730000,
    payer: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    payee: { name: 'ABC Forwarders Ltd.', id: 'CUST-00198', email: 'accounts@abcforwarders.ng', phone: '+234 802 445 1189' },
    jobId: 'JOB-29820', route: 'Tin Can Port → Onne Port', truck: 'TRK-1032', tripId: 'TRIP-98213',
    initiatedTime: '07:28 AM', receivedTime: '07:30 AM', clearedTime: '07:31 AM', completedTime: '07:31 AM',
  }),
  mk({
    id: 'TRX-82928', date: 'May 29, 2026', time: '06:52 PM', description: 'Wallet top-up (Bank Transfer)',
    note: 'Manual wallet top-up by admin.',
    type: 'Wallet Funding', relatedTo: 'WALLET', party: 'Trukkas Admin', amount: 5000000, balanceAfter: 66530000,
    payer: { name: 'Trukkas Admin', id: 'ADMIN-001', email: 'deecaulcrick@gmail.com', phone: '—' },
    payee: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    initiatedTime: '06:50 PM', receivedTime: '06:51 PM', clearedTime: '06:52 PM', completedTime: '06:52 PM',
  }),
  mk({
    id: 'TRX-82927', date: 'May 29, 2026', time: '05:20 PM', description: 'Service fee (5%)',
    note: 'Platform service fee on JOB-29819.',
    type: 'Fee', relatedTo: 'JOB-29819', party: 'System', amount: -87500, balanceAfter: 61530000,
    payer: { name: 'DCL Shipping Services', id: 'CUST-00145', email: 'ops@dclshipping.ng', phone: '+234 809 213 7765' },
    payee: { name: 'Trukkas Platform', id: 'System', email: 'billing@trukkas.com', phone: '—' },
    jobId: 'JOB-29819', route: 'Apapa Port → Lekki',
    initiatedTime: '05:19 PM', receivedTime: '05:20 PM', clearedTime: '05:20 PM', completedTime: '05:20 PM',
  }),
  mk({
    id: 'TRX-82926', date: 'May 29, 2026', time: '04:10 PM', description: 'Refund to customer',
    note: 'Refund issued for cancelled pickup on JOB-29818.',
    type: 'Refund', relatedTo: 'JOB-29818', party: 'DCL Shipping Services', amount: -320000, balanceAfter: 61617500,
    payer: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    payee: { name: 'DCL Shipping Services', id: 'CUST-00145', email: 'ops@dclshipping.ng', phone: '+234 809 213 7765' },
    jobId: 'JOB-29818', route: 'Apapa Port → Lekki',
    initiatedTime: '04:08 PM', receivedTime: '04:09 PM', clearedTime: '04:10 PM', completedTime: '04:10 PM',
  }),
  mk({
    id: 'TRX-82925', date: 'May 29, 2026', time: '03:48 PM', description: 'Settlement from customer',
    note: 'Customer settlement received for JOB-29817.',
    type: 'Payment In', relatedTo: 'JOB-29817', party: 'Nigerian Bulk Consortia', amount: 3250000, balanceAfter: 61937500,
    payer: { name: 'Nigerian Bulk Consortia', id: 'CUST-00176', email: 'finance@nbc.ng', phone: '+234 810 774 2201' },
    payee: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    jobId: 'JOB-29817', route: 'Apapa Port → Ibadan Dry Port', truck: 'TRK-1091', tripId: 'TRIP-98209',
    initiatedTime: '03:45 PM', receivedTime: '03:47 PM', clearedTime: '03:48 PM', completedTime: '03:48 PM',
  }),
  mk({
    id: 'TRX-82924', date: 'May 29, 2026', time: '02:33 PM', description: 'Reversed transaction (TRX-82910)',
    note: 'Reversal of a previously failed payout.',
    type: 'Reversal', relatedTo: 'TRX-82910', party: 'System', amount: 1200000, balanceAfter: 58687500, status: 'Reversed',
    payer: { name: 'Trukkas Platform', id: 'System', email: 'payment@trukkas.com', phone: '—' },
    payee: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    breakdown: null,
    initiatedTime: '02:30 PM', receivedTime: '02:31 PM', clearedTime: '02:32 PM', completedTime: '02:33 PM',
  }),
  mk({
    id: 'TRX-82923', date: 'May 29, 2026', time: '12:05 PM', description: 'Fuel surcharge payment',
    note: 'Fuel surcharge paid on Trip TRIP-98210.',
    type: 'Payment Out', relatedTo: 'TRIP-98210', party: 'TotalEnergies', amount: -480000, balanceAfter: 57487500,
    payer: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    payee: { name: 'TotalEnergies', id: 'VEND-0032', email: 'billing@totalenergies.ng', phone: '+234 700 100 2000' },
    tripId: 'TRIP-98210',
    initiatedTime: '12:02 PM', receivedTime: '12:04 PM', clearedTime: '12:05 PM', completedTime: '12:05 PM',
  }),
  mk({
    id: 'TRX-82922', date: 'May 29, 2026', time: '10:15 AM', description: 'Escrow hold',
    note: 'Funds held in escrow pending delivery of JOB-29816.',
    type: 'Escrow Hold', relatedTo: 'JOB-29816', party: 'CargoLink Logistics', amount: -2950000, balanceAfter: 57967500,
    payer: { name: 'CargoLink Logistics', id: 'CUST-00211', email: 'ops@cargolink.ng', phone: '+234 807 663 9012' },
    payee: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    jobId: 'JOB-29816', route: 'Onne Port → Aba Depot', truck: 'TRK-1077', tripId: 'TRIP-98207',
    breakdown: null,
    initiatedTime: '10:12 AM', receivedTime: '10:14 AM', clearedTime: '10:15 AM', completedTime: '10:15 AM',
  }),
  mk({
    id: 'TRX-82921', date: 'May 28, 2026', time: '04:40 PM', description: 'Driver payout for Trip TRIP-98205',
    type: 'Payout', relatedTo: 'TRIP-98205', party: 'Victoria Udo', amount: -1980000, balanceAfter: 57250000, status: 'Pending',
    payer: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    payee: { name: 'Victoria Udo', id: 'DRV-0078', email: 'v.udo@trukkas.com', phone: '+234 803 990 4471' },
    jobId: 'JOB-29812', route: 'Port Harcourt → Aba Depot', truck: 'TRK-1063', tripId: 'TRIP-98205',
    initiatedTime: '04:38 PM', receivedTime: '—', clearedTime: '—', completedTime: undefined,
  }),
  mk({
    id: 'TRX-82920', date: 'May 28, 2026', time: '02:15 PM', description: 'Payment received for JOB-29811',
    type: 'Payment In', relatedTo: 'JOB-29811', party: 'Zenith Transport Co.', amount: 1450000, balanceAfter: 55270000,
    payer: { name: 'Zenith Transport Co.', id: 'CUST-00233', email: 'accounts@zenithtransport.ng', phone: '+234 805 112 8834' },
    payee: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    jobId: 'JOB-29811', route: 'Ibadan → Lagos', truck: 'TRK-1019', tripId: 'TRIP-98201',
    initiatedTime: '02:13 PM', receivedTime: '02:14 PM', clearedTime: '02:15 PM', completedTime: '02:15 PM',
  }),
  mk({
    id: 'TRX-82919', date: 'May 28, 2026', time: '11:05 AM', description: 'Transporter payment failed',
    type: 'Payment Out', relatedTo: 'JOB-29809', party: 'Emeka Nwosu', amount: -1120000, balanceAfter: 53820000, status: 'Failed',
    payer: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    payee: { name: 'Emeka Nwosu', id: 'DRV-0091', email: 'e.nwosu@trukkas.com', phone: '+234 802 556 3390' },
    jobId: 'JOB-29809', route: 'Apapa Port → Ikeja', truck: 'TRK-1050', tripId: 'TRIP-98198',
    initiatedTime: '11:02 AM', receivedTime: '11:04 AM', clearedTime: '11:05 AM', completedTime: undefined,
  }),
  mk({
    id: 'TRX-82918', date: 'May 27, 2026', time: '04:10 PM', description: 'Driver payout for Trip TRIP-98194',
    type: 'Payout', relatedTo: 'TRIP-98194', party: 'Ibrahim Bello', amount: -1340000, balanceAfter: 52700000,
    payer: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    payee: { name: 'Ibrahim Bello', id: 'DRV-0102', email: 'i.bello@trukkas.com', phone: '+234 806 221 7743' },
    jobId: 'JOB-29808', route: 'Onne Port → Port Harcourt', truck: 'TRK-1088', tripId: 'TRIP-98194',
    initiatedTime: '04:07 PM', receivedTime: '04:09 PM', clearedTime: '04:10 PM', completedTime: '04:10 PM',
  }),
  mk({
    id: 'TRX-82917', date: 'May 27, 2026', time: '01:35 PM', description: 'Escrow release to transporter JOB-29807',
    type: 'Escrow Release', relatedTo: 'JOB-29807', party: 'CargoLink Logistics', amount: -3980000, balanceAfter: 51360000,
    payer: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    payee: { name: 'CargoLink Logistics', id: 'CUST-00211', email: 'ops@cargolink.ng', phone: '+234 807 663 9012' },
    jobId: 'JOB-29807', route: 'Lagos → Enugu', truck: 'TRK-1027', tripId: 'TRIP-98189',
    initiatedTime: '01:32 PM', receivedTime: '01:34 PM', clearedTime: '01:35 PM', completedTime: '01:35 PM',
  }),
  mk({
    id: 'TRX-82916', date: 'May 27, 2026', time: '09:20 AM', description: 'Customer refund (dispute resolution)',
    type: 'Refund', relatedTo: 'JOB-29806', party: 'Nigerian Bulk Consortia', amount: -630000, balanceAfter: 47380000, status: 'Pending',
    payer: { name: 'Trukkas Escrow Account', id: 'WALLET', email: '—', phone: '—' },
    payee: { name: 'Nigerian Bulk Consortia', id: 'CUST-00176', email: 'finance@nbc.ng', phone: '+234 810 774 2201' },
    jobId: 'JOB-29806', route: 'Apapa Port → Ibadan',
    initiatedTime: '09:18 AM', receivedTime: '—', clearedTime: '—', completedTime: undefined,
  }),
];

export const transactionVolumeBreakdown = [
  { label: 'Payments In', amount: 142560000, pct: 52.3, color: 'var(--tk-viz-1)' },
  { label: 'Payments Out', amount: 98430000, pct: 36.1, color: 'var(--tk-viz-2)' },
  { label: 'Fees & Charges', amount: 6210000, pct: 2.3, color: 'var(--tk-viz-3)' },
  { label: 'Refunds', amount: 4320000, pct: 1.6, color: 'var(--tk-viz-4)' },
  { label: 'Reversals', amount: 3140000, pct: 1.2, color: 'var(--tk-viz-5)' },
  { label: 'Others', amount: 17800000, pct: 6.5, color: 'var(--tk-ink-300)' },
];

export const transactionStatusBreakdown = [
  { label: 'Completed', count: 3701, pct: '96.3%', tone: 'success', icon: 'circle-check' },
  { label: 'Pending', count: 78, pct: '2.0%', tone: 'warning', icon: 'hourglass' },
  { label: 'Failed', count: 53, pct: '1.4%', tone: 'danger', icon: 'circle-x' },
  { label: 'Reversed', count: 10, pct: '0.3%', tone: 'info', icon: 'rotate-ccw' },
];

export const transactionAlerts = [
  { icon: 'triangle-alert', tone: 'red', title: '53 transactions failed', description: 'Review and retry', time: '1h ago' },
  { icon: 'circle-alert', tone: 'blue', title: 'Large transaction detected', description: '₦5,000,000.00 (TRX-82928)', time: '3h ago' },
  { icon: 'circle-check', tone: 'green', title: 'Reversal completed', description: 'TRX-82910', time: '5h ago' },
];
