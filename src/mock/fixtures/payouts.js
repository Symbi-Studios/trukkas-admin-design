// Payouts — transcribed from uploads/trukkas-admin/091.jpeg (Requested Payouts list),
// 092.jpeg (PAY-77421 pending review) and 093.jpeg (PAY-77421 completed payout detail).
// 092 and 093 are the same payout at two points in its life — PayoutDetail renders one
// screen or the other from live `status`, so approving PAY-77421 in the UI walks it from
// the pending-review layout straight into the completed one, timestamps included.
// The screenshot's "Showing 1 to 10 of 32 payout requests" implies a larger platform-wide
// queue; this fixture mocks that paginated subset. Every row carries full detail-page data
// so any row in the list can be opened, not just PAY-77421.

export const payoutRequestSummary = {
  totalRequests: 32, totalRequestsDelta: '12%',
  pendingReview: 12, pendingReviewCaption: '0% vs last week',
  approved: 15, approvedDelta: '25%',
  rejected: 3, rejectedDelta: '40%', rejectedDirection: 'down',
  totalRequestedAmount: 18750000, totalRequestedAmountDelta: '18%',
};

const DOC = (name, file, kind = 'pdf') => ({ name, file, kind });

export function makePayout(o) {
  const {
    id, dateRequested, dateRequestedTime, party, partyId, partyType = 'driver',
    type, jobId, route, amount, status = 'Pending Review',
    requestedBy, requestedByRole,
    relatedSettlement, escrowId,
    requester, job, breakdown, payment, notes, documents,
  } = o;

  return {
    id, dateRequested, dateRequestedTime, party, partyId, partyType,
    type, jobId, route, amount, status,
    requestedBy: requestedBy || party, requestedByRole: requestedByRole || (partyType === 'driver' ? 'Driver' : 'Company'),

    relatedSettlement: relatedSettlement || null,
    relatedTransaction: null,
    escrowId: escrowId || null,

    requester: {
      name: party, idBadge: partyId, role: partyType === 'driver' ? 'Professional Driver' : 'Transport Company',
      phone: '—', email: '—', status: 'Active', rating: '—', totalTrips: '—', company: '—',
      ...requester,
    },
    job: {
      jobId, tripId: '—', route, truck: '—', customer: '—', cargoType: '—', tripDates: '—', status: 'Completed',
      ...job,
    },
    breakdown: breakdown || [{ label: 'Net Payout Amount', value: amount }],
    payment: { method: 'Bank Transfer', bank: '—', accountNumber: '—', accountName: party, ...payment },
    notes: notes || '—',
    documents: documents || [DOC(`${type} Reference`, `${id}.pdf`)],

    adminRemark: null,
    approvedOn: null, approvedTime: null,
    processedOn: null, processedTime: null,
    issueNotes: [],
  };
}
const mk = makePayout;

export const payoutRequests = [
  mk({
    id: 'PAY-77421', dateRequested: 'May 30, 2026', dateRequestedTime: '09:46 AM',
    party: 'John Adewale', partyId: 'DRV-0045', partyType: 'driver',
    type: 'Driver Payout', jobId: 'JOB-29821', route: 'Apapa → Ikeja', amount: 1540000,
    status: 'Pending Review', requestedBy: 'John Adewale', requestedByRole: 'Driver',
    relatedSettlement: 'SETT-98231', escrowId: 'ESC-67211',
    requester: {
      phone: '+234 806 987 6543', email: 'john.adewale@trukkas.com',
      status: 'Active', rating: 4.8, totalTrips: 312, company: '—',
    },
    job: {
      tripId: 'TRIP-98214', route: 'Apapa Port → Ikeja Warehouse', truck: 'TRK-1045',
      customer: 'Goodwill Forwarding Ltd.', cargoType: 'General Cargo (Container)',
      tripDates: 'May 28 – May 30, 2026', status: 'Completed',
    },
    breakdown: [
      { label: 'Gross Settlement Amount', value: 1650000 },
      { label: 'Platform Fee (5%)', value: -82500 },
      { label: 'Delay Penalty', value: -27500 },
    ],
    payment: { method: 'Bank Transfer', bank: 'Access Bank', accountNumber: '0123456789', accountName: 'John Adewale' },
    notes: 'Final payout after delivery confirmation and container return.',
    documents: [
      DOC('Proof of Delivery (POD)', 'POD_JOB-29821.pdf', 'pdf'),
      DOC('Delivery Photos', 'delivery_photos.zip', 'image'),
      DOC('Driver Invoice', 'INV-77421.pdf', 'pdf'),
    ],
  }),
  mk({
    id: 'PAY-77420', dateRequested: 'May 30, 2026', dateRequestedTime: '08:15 AM',
    party: 'ABC Forwarders Ltd.', partyId: 'TC-0021', partyType: 'company',
    type: 'Company Payout', jobId: 'JOB-29820', route: 'Lagos → Onitsha', amount: 3250000,
    status: 'Pending Review', requestedBy: 'Ibrahim Sani', requestedByRole: 'Transport Manager',
    relatedSettlement: 'SETT-98230', escrowId: 'ESC-67210',
    requester: { phone: '+234 802 445 1189', email: 'accounts@abcforwarders.ng', status: 'Active', company: 'ABC Forwarders Ltd.' },
    job: { tripId: 'TRIP-98213', route: 'Lagos → Onitsha', truck: 'TRK-1032', customer: 'CargoLink Logistics', cargoType: 'General Cargo (Container)', tripDates: 'May 28 – May 30, 2026', status: 'Completed' },
    breakdown: [
      { label: 'Gross Settlement Amount', value: 3450000 },
      { label: 'Platform Fee (5%)', value: -172500 },
      { label: 'Delay Penalty', value: -27500 },
    ],
    payment: { method: 'Bank Transfer', bank: 'GTBank', accountNumber: '0198765432', accountName: 'ABC Forwarders Ltd.' },
    notes: 'Company payout for completed transport contract on JOB-29820.',
    documents: [DOC('Proof of Delivery (POD)', 'POD_JOB-29820.pdf', 'pdf'), DOC('Company Invoice', 'INV-77420.pdf', 'pdf')],
  }),
  mk({
    id: 'PAY-77419', dateRequested: 'May 29, 2026', dateRequestedTime: '06:42 PM',
    party: 'Chinedu Okafor', partyId: 'DRV-0187', partyType: 'driver',
    type: 'Driver Payout', jobId: 'JOB-29818', route: 'Tin Can → Abuja', amount: 820000,
    status: 'Approved', requestedBy: 'Chinedu Okafor', requestedByRole: 'Driver',
    relatedSettlement: 'SETT-98229', escrowId: 'ESC-67209',
    requester: { phone: '+234 807 220 3345', email: 'c.okafor@trukkas.com', status: 'Active', rating: 4.6, totalTrips: 154, company: '—' },
    job: { tripId: 'TRIP-98212', route: 'Tin Can Port → Abuja', truck: 'TRK-1091', customer: 'DCL Shipping Services', cargoType: 'General Cargo (Container)', tripDates: 'May 27 – May 29, 2026', status: 'Completed' },
    breakdown: [
      { label: 'Gross Settlement Amount', value: 880000 },
      { label: 'Platform Fee (5%)', value: -44000 },
      { label: 'Delay Penalty', value: -16000 },
    ],
    payment: { method: 'Bank Transfer', bank: 'Zenith Bank', accountNumber: '0145566778', accountName: 'Chinedu Okafor' },
    notes: 'Approved, awaiting scheduled processing.',
    documents: [DOC('Proof of Delivery (POD)', 'POD_JOB-29818.pdf', 'pdf'), DOC('Driver Invoice', 'INV-77419.pdf', 'pdf')],
  }),
  mk({
    id: 'PAY-77418', dateRequested: 'May 29, 2026', dateRequestedTime: '02:30 PM',
    party: 'Goodwill Forwarding Ltd.', partyId: 'TC-0012', partyType: 'company',
    type: 'Company Payout', jobId: 'JOB-29817', route: 'Lagos → Kano', amount: 2900000,
    status: 'Processing', requestedBy: 'Amaka Udo', requestedByRole: 'Finance Officer',
    relatedSettlement: 'SETT-98227', escrowId: 'ESC-67207',
    requester: { phone: '+234 803 991 2214', email: 'finance@goodwillng.com', status: 'Active', company: 'Goodwill Forwarding Ltd.' },
    job: { tripId: 'TRIP-98209', route: 'Apapa Port → Ibadan Dry Port', truck: 'TRK-1077', customer: 'Nigerian Bulk Consortia', cargoType: 'General Cargo (Container)', tripDates: 'May 26 – May 29, 2026', status: 'Completed' },
    breakdown: [
      { label: 'Gross Settlement Amount', value: 3150000 },
      { label: 'Platform Fee (5%)', value: -157500 },
      { label: 'Delay Penalty', value: -92500 },
    ],
    payment: { method: 'Bank Transfer', bank: 'Access Bank', accountNumber: '0177889900', accountName: 'Goodwill Forwarding Ltd.' },
    notes: 'Currently being processed by the finance team.',
    documents: [DOC('Proof of Delivery (POD)', 'POD_JOB-29817.pdf', 'pdf'), DOC('Company Invoice', 'INV-77418.pdf', 'pdf')],
  }),
  mk({
    id: 'PAY-77417', dateRequested: 'May 28, 2026', dateRequestedTime: '11:20 AM',
    party: 'Suleiman Musa', partyId: 'DRV-0062', partyType: 'driver',
    type: 'Driver Payout', jobId: 'JOB-29816', route: 'Onne → Port Harcourt', amount: 675000,
    status: 'Rejected', requestedBy: 'Suleiman Musa', requestedByRole: 'Driver',
    relatedSettlement: 'SETT-98226', escrowId: 'ESC-67206',
    requester: { phone: '+234 805 667 2201', email: 's.musa@trukkas.com', status: 'Active', rating: 4.1, totalTrips: 87, company: '—' },
    job: { tripId: 'TRIP-98207', route: 'Onne Port → Port Harcourt', truck: 'TRK-1063', customer: 'Finance Team', cargoType: 'General Cargo (Container)', tripDates: 'May 27 – May 28, 2026', status: 'Completed' },
    breakdown: [
      { label: 'Gross Settlement Amount', value: 720000 },
      { label: 'Platform Fee (5%)', value: -36000 },
      { label: 'Delay Penalty', value: -9000 },
    ],
    payment: { method: 'Wallet', bank: 'Trukkas Wallet', accountNumber: 'WALLET-0062', accountName: 'Suleiman Musa' },
    notes: 'Rejected — proof of delivery did not match trip manifest.',
    documents: [DOC('Proof of Delivery (POD)', 'POD_JOB-29816.pdf', 'pdf')],
  }),
  mk({
    id: 'PAY-77416', dateRequested: 'May 28, 2026', dateRequestedTime: '09:10 AM',
    party: 'DCL Shipping Services', partyId: 'TC-0034', partyType: 'company',
    type: 'Company Payout', jobId: 'JOB-29815', route: 'Lagos → Warri', amount: 4200000,
    status: 'Approved', requestedBy: 'Daniel Etim', requestedByRole: 'Accountant',
    relatedSettlement: 'SETT-98225', escrowId: 'ESC-67205',
    requester: { phone: '+234 809 213 7765', email: 'ops@dclshipping.ng', status: 'Active', company: 'DCL Shipping Services' },
    job: { tripId: 'TRIP-98204', route: 'Ikeja Warehouse → Apapa Port', truck: 'TRK-1050', customer: 'Trukkas Logistics', cargoType: 'General Cargo (Container)', tripDates: 'May 26 – May 28, 2026', status: 'Completed' },
    breakdown: [
      { label: 'Gross Settlement Amount', value: 4450000 },
      { label: 'Platform Fee (5%)', value: -222500 },
      { label: 'Delay Penalty', value: -27500 },
    ],
    payment: { method: 'Bank Transfer', bank: 'UBA', accountNumber: '0166778899', accountName: 'DCL Shipping Services' },
    notes: 'Approved, awaiting scheduled processing.',
    documents: [DOC('Proof of Delivery (POD)', 'POD_JOB-29815.pdf', 'pdf'), DOC('Company Invoice', 'INV-77416.pdf', 'pdf')],
  }),
  mk({
    id: 'PAY-77415', dateRequested: 'May 27, 2026', dateRequestedTime: '04:55 PM',
    party: 'Esther Adeniyi', partyId: 'DRV-0119', partyType: 'driver',
    type: 'Driver Payout', jobId: 'JOB-29814', route: 'Apapa → Ibadan', amount: 1100000,
    status: 'Pending Review', requestedBy: 'Esther Adeniyi', requestedByRole: 'Driver',
    relatedSettlement: 'SETT-98224', escrowId: 'ESC-67204',
    requester: { phone: '+234 810 774 2201', email: 'e.adeniyi@trukkas.com', status: 'Active', rating: 4.9, totalTrips: 203, company: '—' },
    job: { tripId: 'TRIP-98202', route: 'Apapa Port → Ibadan Dry Port', truck: 'TRK-1019', customer: 'Goodwill Forwarding Ltd.', cargoType: 'General Cargo (Container)', tripDates: 'May 25 – May 27, 2026', status: 'Completed' },
    breakdown: [
      { label: 'Gross Settlement Amount', value: 1180000 },
      { label: 'Platform Fee (5%)', value: -59000 },
      { label: 'Delay Penalty', value: -21000 },
    ],
    payment: { method: 'Bank Transfer', bank: 'Access Bank', accountNumber: '0122334455', accountName: 'Esther Adeniyi' },
    notes: 'Final payout after delivery confirmation.',
    documents: [DOC('Proof of Delivery (POD)', 'POD_JOB-29814.pdf', 'pdf'), DOC('Driver Invoice', 'INV-77415.pdf', 'pdf')],
  }),
  mk({
    id: 'PAY-77414', dateRequested: 'May 27, 2026', dateRequestedTime: '01:18 PM',
    party: 'Nigerian Bulk Consortia', partyId: 'TC-0048', partyType: 'company',
    type: 'Company Payout', jobId: 'JOB-29812', route: 'Lagos → Kaduna', amount: 3750000,
    status: 'Approved', requestedBy: 'Tunde Salami', requestedByRole: 'Operations Manager',
    relatedSettlement: 'SETT-98222', escrowId: 'ESC-67202',
    requester: { phone: '+234 807 663 9012', email: 'ops@nbc.ng', status: 'Active', company: 'Nigerian Bulk Consortia' },
    job: { tripId: 'TRIP-98198', route: 'Apapa Port → Multiple Sites (5)', truck: 'TRK-1088', customer: 'Haulage Plus Ltd.', cargoType: 'General Cargo (Container)', tripDates: 'May 25 – May 27, 2026', status: 'Completed' },
    breakdown: [
      { label: 'Gross Settlement Amount', value: 3950000 },
      { label: 'Platform Fee (5%)', value: -197500 },
      { label: 'Delay Penalty', value: -2500 },
    ],
    payment: { method: 'Bank Transfer', bank: 'First Bank', accountNumber: '0133445566', accountName: 'Nigerian Bulk Consortia' },
    notes: 'Approved, awaiting scheduled processing.',
    documents: [DOC('Proof of Delivery (POD)', 'POD_JOB-29812.pdf', 'pdf'), DOC('Company Invoice', 'INV-77414.pdf', 'pdf')],
  }),
  mk({
    id: 'PAY-77413', dateRequested: 'May 26, 2026', dateRequestedTime: '10:05 AM',
    party: 'Emeka Okorie', partyId: 'DRV-0033', partyType: 'driver',
    type: 'Driver Payout', jobId: 'JOB-29811', route: 'Calabar → Enugu', amount: 980000,
    status: 'Pending Review', requestedBy: 'Emeka Okorie', requestedByRole: 'Driver',
    relatedSettlement: 'SETT-98221', escrowId: 'ESC-67201',
    requester: { phone: '+234 806 221 7743', email: 'e.okorie@trukkas.com', status: 'Active', rating: 4.7, totalTrips: 128, company: '—' },
    job: { tripId: 'TRIP-98194', route: 'Calabar Port → Enugu Depot', truck: 'TRK-1027', customer: 'ABC Forwarders Ltd.', cargoType: 'General Cargo (Container)', tripDates: 'May 24 – May 26, 2026', status: 'Completed' },
    breakdown: [
      { label: 'Gross Settlement Amount', value: 1030000 },
      { label: 'Platform Fee (5%)', value: -51500 },
      { label: 'Delay Penalty', value: 1500 },
    ],
    payment: { method: 'Bank Transfer', bank: 'Access Bank', accountNumber: '0144556677', accountName: 'Emeka Okorie' },
    notes: 'Final payout after delivery confirmation and container return.',
    documents: [DOC('Proof of Delivery (POD)', 'POD_JOB-29811.pdf', 'pdf'), DOC('Driver Invoice', 'INV-77413.pdf', 'pdf')],
  }),
  mk({
    id: 'PAY-77412', dateRequested: 'May 26, 2026', dateRequestedTime: '08:40 AM',
    party: 'TotalEnergies', partyId: 'TC-0061', partyType: 'company',
    type: 'Company Payout', jobId: 'JOB-29810', route: 'Lagos → Benin', amount: 2600000,
    status: 'Processing', requestedBy: 'Grace Nwosu', requestedByRole: 'Finance Officer',
    relatedSettlement: 'SETT-98220', escrowId: 'ESC-67200',
    requester: { phone: '+234 700 100 2000', email: 'billing@totalenergies.ng', status: 'Active', company: 'TotalEnergies' },
    job: { tripId: 'TRIP-98190', route: 'Kano → Lagos', truck: 'TRK-1015', customer: 'Zenith Transport Co.', cargoType: 'Fuel & Petroleum Products', tripDates: 'May 24 – May 26, 2026', status: 'Completed' },
    breakdown: [
      { label: 'Gross Settlement Amount', value: 2870000 },
      { label: 'Platform Fee (5%)', value: -143500 },
      { label: 'Delay Penalty', value: -126500 },
    ],
    payment: { method: 'Bank Transfer', bank: 'GTBank', accountNumber: '0155667788', accountName: 'TotalEnergies' },
    notes: 'Currently being processed by the finance team.',
    documents: [DOC('Proof of Delivery (POD)', 'POD_JOB-29810.pdf', 'pdf'), DOC('Company Invoice', 'INV-77412.pdf', 'pdf')],
  }),
];
