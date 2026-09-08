// Settlements — transcribed from uploads/trukkas-admin/088.jpeg. The screenshot's
// "Showing 1 to 10 of 1,248 settlements" implies a much larger platform-wide dataset;
// this fixture mocks a real, paginated subset. KPI values stay static/decorative,
// same treatment Truck Companies gave its "of 128 companies" stat — see HANDOFF.md.

export const settlementSummary = {
  totalSettlements: 98450000, totalSettlementsDelta: '18.6%',
  completedSettlements: 72650000, completedSettlementsDelta: '21.3%',
  pendingSettlements: 18740000, pendingSettlementsDelta: '7.2%', pendingSettlementsDirection: 'down',
  onHold: 4230000, onHoldDelta: '3.4%', onHoldDirection: 'down',
  failedSettlements: 830000, failedSettlementsDelta: '12.6%', failedSettlementsDirection: 'down',
  avgSettlementTime: '1h 24m', avgSettlementTimeDelta: '15.8%',
};

const s = (over) => ({ status: 'Completed', method: 'Bank Transfer', ...over });

export const settlements = [
  s({ id: 'SETT-98231', relatedTo: 'JOB-29821', route: 'Apapa Port → Ikeja Warehouse', payer: 'Goodwill Forwarding Ltd.', payerType: 'Importer', payee: 'John Adewale', payeeType: 'Driver', amount: 2450000, type: 'Driver Payout', settledOn: 'May 30, 2026', settledTime: '09:42 AM' }),
  s({ id: 'SETT-98230', relatedTo: 'JOB-29820', route: 'Tin Can Port → Onne Port', payer: 'CargoLink Logistics', payerType: 'Customer', payee: 'ABC Forwarders Ltd.', payeeType: 'Transporter', amount: 4800000, type: 'Transporter Payment', settledOn: 'May 30, 2026', settledTime: '09:37 AM' }),
  s({ id: 'SETT-98229', relatedTo: 'JOB-29819', route: 'Apapa Port → Lekki', payer: 'DCL Shipping Services', payerType: 'Customer', payee: 'A. Ibrahim', payeeType: 'Driver', amount: 1750000, type: 'Driver Payout', method: 'Wallet', settledOn: 'May 30, 2026', settledTime: '08:58 AM' }),
  s({ id: 'SETT-98228', relatedTo: 'JOB-29818', route: 'Port Harcourt → Aba Depot', payer: 'Importer', payerType: 'Importer', payee: 'Victoria Udo', payeeType: 'Driver', amount: 1980000, type: 'Driver Payout', status: 'Pending', settledOn: null, settledTime: null }),
  s({ id: 'SETT-98227', relatedTo: 'JOB-29817', route: 'Apapa Port → Ibadan Dry Port', payer: 'Nig. Bulk Consortia', payerType: 'Customer', payee: 'Transglobal Logistics', payeeType: 'Transporter', amount: 3250000, type: 'Transporter Payment', status: 'Pending', settledOn: null, settledTime: null }),
  s({ id: 'SETT-98226', relatedTo: 'JOB-29816', route: 'Tin Can → Lagos Island', payer: 'Finance Team', payerType: 'Internal', payee: 'O. Chinedu', payeeType: 'Driver', amount: 980000, type: 'Driver Payout', method: 'Wallet', status: 'On Hold', settledOn: null, settledTime: null }),
  s({ id: 'SETT-98225', relatedTo: 'JOB-29815', route: 'Ikeja Warehouse → Apapa Port', payer: 'Trukkas Logistics', payerType: 'Customer', payee: 'Innocent Logistics', payeeType: 'Vendor', amount: 2300000, type: 'Vendor Payment', settledOn: 'May 29, 2026', settledTime: '06:21 PM' }),
  s({ id: 'SETT-98224', relatedTo: 'JOB-29814', route: 'Lagos → Warri', payer: 'Goodwill Forwarding Ltd.', payerType: 'Customer', payee: 'S. Musa', payeeType: 'Driver', amount: 1620000, type: 'Driver Payout', status: 'Failed', settledOn: 'May 29, 2026', settledTime: '05:12 PM' }),
  s({ id: 'SETT-98223', relatedTo: 'JOB-29813', route: 'Onne Port → Aba Depot', payer: 'CargoLink Logistics', payerType: 'Customer', payee: 'DCL Shipping Services', payeeType: 'Transporter', amount: 5400000, type: 'Transporter Payment', settledOn: 'May 29, 2026', settledTime: '04:48 PM' }),
  s({ id: 'SETT-98222', relatedTo: 'JOB-29812', route: 'Apapa Port → Multiple Sites (5)', payer: 'Haulage Plus Ltd.', payerType: 'Customer', payee: 'Multiple Drivers', payeeType: 'Driver', amount: 3120000, type: 'Driver Payout', method: 'Wallet', settledOn: 'May 29, 2026', settledTime: '03:33 PM' }),
  s({ id: 'SETT-98221', relatedTo: 'JOB-29811', route: 'Ibadan → Lagos', payer: 'ABC Forwarders Ltd.', payerType: 'Customer', payee: 'Chinedu Okafor', payeeType: 'Driver', amount: 1450000, type: 'Driver Payout', settledOn: 'May 28, 2026', settledTime: '02:20 PM' }),
  s({ id: 'SETT-98220', relatedTo: 'JOB-29810', route: 'Kano → Lagos', payer: 'Zenith Transport Co.', payerType: 'Customer', payee: 'Oceanic Transport', payeeType: 'Vendor', amount: 2870000, type: 'Vendor Payment', status: 'Pending', settledOn: null, settledTime: null }),
  s({ id: 'SETT-98219', relatedTo: 'JOB-29809', route: 'Apapa Port → Ikeja', payer: 'Trukkas Logistics', payerType: 'Customer', payee: 'Emeka Nwosu', payeeType: 'Driver', amount: 1120000, type: 'Driver Payout', status: 'Failed', settledOn: 'May 28, 2026', settledTime: '11:05 AM' }),
  s({ id: 'SETT-98218', relatedTo: 'JOB-29808', route: 'Onne Port → Port Harcourt', payer: 'DCL Shipping Services', payerType: 'Customer', payee: 'Ibrahim Bello', payeeType: 'Driver', amount: 1340000, type: 'Driver Payout', method: 'Wallet', settledOn: 'May 27, 2026', settledTime: '04:10 PM' }),
  s({ id: 'SETT-98217', relatedTo: 'JOB-29807', route: 'Lagos → Enugu', payer: 'Goodwill Forwarding Ltd.', payerType: 'Customer', payee: 'CargoLink Logistics', payeeType: 'Transporter', amount: 3980000, type: 'Transporter Payment', settledOn: 'May 27, 2026', settledTime: '01:35 PM' }),
  s({ id: 'SETT-98216', relatedTo: 'JOB-29806', route: 'Apapa Port → Ibadan', payer: 'Customer Refund', payerType: 'Internal', payee: 'Nig. Bulk Consortia', payeeType: 'Customer', amount: 630000, type: 'Customer Refund', status: 'On Hold', settledOn: null, settledTime: null }),
];

export const payoutSummary = [
  { label: 'Drivers', pct: 34.8, amount: 34250000, color: 'var(--tk-viz-1)' },
  { label: 'Transporters', pct: 42.3, amount: 41600000, color: 'var(--tk-viz-2)' },
  { label: 'Vendors', pct: 12.5, amount: 12300000, color: 'var(--tk-viz-3)' },
  { label: 'Customers (Refunds)', pct: 6.4, amount: 6300000, color: 'var(--tk-viz-5)' },
  { label: 'Others', pct: 4.0, amount: 4000000, color: 'var(--tk-ink-300)' },
];

export const settlementStatusBreakdown = [
  { label: 'Completed', count: 872, pct: '69.9%', tone: 'success', icon: 'circle-check' },
  { label: 'Pending', count: 214, pct: '17.1%', tone: 'warning', icon: 'hourglass' },
  { label: 'On Hold', count: 96, pct: '7.7%', tone: 'info', icon: 'circle-pause' },
  { label: 'Failed', count: 66, pct: '5.3%', tone: 'danger', icon: 'circle-x' },
];

export const settlementAlerts = [
  { icon: 'triangle-alert', tone: 'amber', title: '3 settlements require approval', description: 'Total amount: ₦8,970,000.00', time: '15m ago' },
  { icon: 'circle-x', tone: 'red', title: '2 settlements failed', description: 'Please check and retry', time: '1h ago' },
  { icon: 'file-text', tone: 'blue', title: '4 driver payouts pending documents', description: 'Upload documents to proceed', time: '2h ago' },
];
