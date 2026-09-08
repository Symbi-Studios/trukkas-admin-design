// Pricing Management — transcribed from uploads/trukkas-admin/086.jpeg. The screenshot's
// KPI row implies 56 services / 18 exceptions platform-wide; this fixture mocks a real,
// paginated subset (26 service pricing rows) rather than fabricating all 56, same
// deliberate deviation Truck Companies made for its "of 128 companies" stat — see
// HANDOFF.md. KPI values themselves stay as static decorative platform-wide figures.

export const pricingSummary = {
  activePriceLists: 12, activePriceListsDelta: '9.1%',
  totalServices: 56, totalServicesDelta: '6.7%',
  avgPriceChange: '+3.8%', avgPriceChangeDelta: '1.2%',
  priceExceptions: 18, priceExceptionsDelta: '12.5%',
  surchargesActive: 7, surchargesActiveDelta: '16.7%',
  currency: 'NGN',
};

const svc = (over) => ({ status: 'Active', ...over });

export const servicePricing = [
  svc({ id: 'SVC-2026-0001', service: 'Import (Container)', route: 'Apapa Port → Ikeja', coverage: 'Lagos', truckType: '40FT HC', unit: 'Per Trip', basePrice: 350000, surcharge: 20000, surchargePct: '5.7%', updated: 'May 30, 2026', updatedTime: '09:42 AM' }),
  svc({ id: 'SVC-2026-0002', service: 'Export (Container)', route: 'Ikeja → Apapa Port', coverage: 'Warehouse to Port', truckType: '40FT HC', unit: 'Per Trip', basePrice: 320000, surcharge: 15000, surchargePct: '4.7%', updated: 'May 30, 2026', updatedTime: '09:37 AM' }),
  svc({ id: 'SVC-2026-0003', service: 'Domestic (General Cargo)', route: 'Lagos → Ibadan', coverage: 'Door to Door / Oyo', truckType: '20FT / 40FT', unit: 'Per Trip', basePrice: 180000, surcharge: 10000, surchargePct: '5.6%', updated: 'May 29, 2026', updatedTime: '05:20 PM' }),
  svc({ id: 'SVC-2026-0004', service: 'Break Bulk', route: 'Apapa Port → Ikeja', coverage: 'Port to Warehouse / Lagos', truckType: 'Flatbed 30 Tons', unit: 'Per Trip', basePrice: 400000, surcharge: 25000, surchargePct: '6.3%', updated: 'May 29, 2026', updatedTime: '04:10 PM' }),
  svc({ id: 'SVC-2026-0005', service: 'Transfer / Value Chain', route: 'Ikeja → Ajah Depot', coverage: 'Warehouse to Depot / Lagos', truckType: '20FT', unit: 'Per Trip', basePrice: 120000, surcharge: 8000, surchargePct: '6.7%', updated: 'May 29, 2026', updatedTime: '03:48 PM' }),
  svc({ id: 'SVC-2026-0006', service: 'Return Trip', route: 'Apapa Port → Ikeja', coverage: 'Empty Return / Lagos', truckType: '40FT HC', unit: 'Per Trip', basePrice: 160000, surcharge: 0, surchargePct: '0%', status: 'Inactive', updated: 'May 28, 2026', updatedTime: '11:15 AM' }),
  svc({ id: 'SVC-2026-0007', service: 'Special Equipment', route: 'Lagos → Port Harcourt', coverage: 'Lowbed / Heavy Haul / Rivers', truckType: 'Lowbed', unit: 'Per Trip', basePrice: 850000, surcharge: 50000, surchargePct: '5.9%', updated: 'May 28, 2026', updatedTime: '10:05 AM' }),
  svc({ id: 'SVC-2026-0008', service: 'Warehousing', route: 'Ikeja Warehouse', coverage: 'Storage (Per Day) / Lagos', truckType: 'Per Pallet', unit: 'Per Day', basePrice: 4500, surcharge: 500, surchargePct: '11.1%', updated: 'May 27, 2026', updatedTime: '02:30 PM' }),
  svc({ id: 'SVC-2026-0009', service: 'Import (Container)', route: 'Tin Can Port → Ikeja', coverage: 'Lagos', truckType: '20FT', unit: 'Per Trip', basePrice: 280000, surcharge: 14000, surchargePct: '5.0%', updated: 'May 27, 2026', updatedTime: '10:12 AM' }),
  svc({ id: 'SVC-2026-0010', service: 'Domestic (General Cargo)', route: 'Lagos → Kano', coverage: 'Door to Door', truckType: '40FT HC', unit: 'Per Trip', basePrice: 620000, surcharge: 45000, surchargePct: '7.3%', updated: 'May 26, 2026', updatedTime: '04:55 PM' }),
  svc({ id: 'SVC-2026-0011', service: 'Break Bulk', route: 'Onne Port → Owerri', coverage: 'Port to Warehouse / Imo', truckType: 'Flatbed 20 Tons', unit: 'Per Trip', basePrice: 260000, surcharge: 16000, surchargePct: '6.2%', updated: 'May 26, 2026', updatedTime: '02:05 PM' }),
  svc({ id: 'SVC-2026-0012', service: 'Export (Container)', route: 'Ikeja → Tin Can Port', coverage: 'Warehouse to Port', truckType: '20FT', unit: 'Per Trip', basePrice: 260000, surcharge: 12500, surchargePct: '4.8%', updated: 'May 25, 2026', updatedTime: '01:40 PM' }),
  svc({ id: 'SVC-2026-0013', service: 'Transfer / Value Chain', route: 'Apapa Port → Lekki Depot', coverage: 'Port to Depot / Lagos', truckType: '40FT', unit: 'Per Trip', basePrice: 190000, surcharge: 11000, surchargePct: '5.8%', updated: 'May 25, 2026', updatedTime: '09:18 AM' }),
  svc({ id: 'SVC-2026-0014', service: 'Special Equipment', route: 'Lagos → Aba', coverage: 'Lowbed / Heavy Haul / Abia', truckType: 'Lowbed', unit: 'Per Trip', basePrice: 780000, surcharge: 42000, surchargePct: '5.4%', updated: 'May 24, 2026', updatedTime: '03:22 PM' }),
  svc({ id: 'SVC-2026-0015', service: 'Warehousing', route: 'Apapa Warehouse', coverage: 'Storage (Per Day) / Lagos', truckType: 'Per Pallet', unit: 'Per Day', basePrice: 5200, surcharge: 600, surchargePct: '11.5%', updated: 'May 24, 2026', updatedTime: '10:50 AM' }),
  svc({ id: 'SVC-2026-0016', service: 'Import (Container)', route: 'Apapa Port → Ibadan', coverage: 'Oyo', truckType: '40FT HC', unit: 'Per Trip', basePrice: 410000, surcharge: 22000, surchargePct: '5.4%', updated: 'May 23, 2026', updatedTime: '05:05 PM' }),
  svc({ id: 'SVC-2026-0017', service: 'Domestic (General Cargo)', route: 'Lagos → Enugu', coverage: 'Door to Door', truckType: '40FT', unit: 'Per Trip', basePrice: 540000, surcharge: 38000, surchargePct: '7.0%', updated: 'May 23, 2026', updatedTime: '11:32 AM' }),
  svc({ id: 'SVC-2026-0018', service: 'Return Trip', route: 'Ikeja → Apapa Port', coverage: 'Empty Return / Lagos', truckType: '20FT', unit: 'Per Trip', basePrice: 130000, surcharge: 0, surchargePct: '0%', updated: 'May 22, 2026', updatedTime: '02:44 PM' }),
  svc({ id: 'SVC-2026-0019', service: 'Break Bulk', route: 'Apapa Port → Ikeja', coverage: 'Port to Warehouse / Lagos', truckType: 'Flatbed 30 Tons', unit: 'Per Trip', basePrice: 395000, surcharge: 24000, surchargePct: '6.1%', status: 'Draft', updated: 'May 22, 2026', updatedTime: '09:02 AM' }),
  svc({ id: 'SVC-2026-0020', service: 'Export (Container)', route: 'Onne Port → Port Harcourt', coverage: 'Warehouse to Port', truckType: '20FT', unit: 'Per Trip', basePrice: 210000, surcharge: 10500, surchargePct: '5.0%', updated: 'May 21, 2026', updatedTime: '04:15 PM' }),
  svc({ id: 'SVC-2026-0021', service: 'Transfer / Value Chain', route: 'Tin Can Port → Ajah Depot', coverage: 'Port to Depot / Lagos', truckType: '20FT', unit: 'Per Trip', basePrice: 150000, surcharge: 9000, surchargePct: '6.0%', updated: 'May 20, 2026', updatedTime: '08:50 AM' }),
  svc({ id: 'SVC-2026-0022', service: 'Special Equipment', route: 'Lagos → Kaduna', coverage: 'Lowbed / Heavy Haul', truckType: 'Lowbed', unit: 'Per Trip', basePrice: 920000, surcharge: 58000, surchargePct: '6.3%', updated: 'May 19, 2026', updatedTime: '01:10 PM' }),
  svc({ id: 'SVC-2026-0023', service: 'Warehousing', route: 'Tin Can Warehouse', coverage: 'Storage (Per Day) / Lagos', truckType: 'Per Pallet', unit: 'Per Day', basePrice: 4200, surcharge: 420, surchargePct: '10.0%', status: 'Inactive', updated: 'May 18, 2026', updatedTime: '10:00 AM' }),
  svc({ id: 'SVC-2026-0024', service: 'Import (Container)', route: 'Onne Port → Owerri', coverage: 'Imo', truckType: '40FT HC', unit: 'Per Trip', basePrice: 300000, surcharge: 16000, surchargePct: '5.3%', updated: 'May 17, 2026', updatedTime: '03:38 PM' }),
  svc({ id: 'SVC-2026-0025', service: 'Domestic (General Cargo)', route: 'Lagos → Sokoto', coverage: 'Door to Door', truckType: '40FT', unit: 'Per Trip', basePrice: 680000, surcharge: 52000, surchargePct: '7.6%', updated: 'May 17, 2026', updatedTime: '09:05 AM' }),
  svc({ id: 'SVC-2026-0026', service: 'Break Bulk', route: 'Apapa Port → Abeokuta', coverage: 'Port to Warehouse / Ogun', truckType: 'Flatbed 20 Tons', unit: 'Per Trip', basePrice: 230000, surcharge: 13500, surchargePct: '5.9%', updated: 'May 16, 2026', updatedTime: '02:28 PM' }),
].map((r) => ({ ...r, totalPrice: r.basePrice + r.surcharge }));

export const pricingRules = [
  { id: 'PR-001', icon: 'fuel', iconTint: 'amber', name: 'Fuel Surcharge', description: 'Applies when fuel price increases', rate: '5%' },
  { id: 'PR-002', icon: 'calendar', iconTint: 'blue', name: 'Weekend Surcharge', description: 'Applies for trips on Saturdays & Sundays', rate: '10%' },
  { id: 'PR-003', icon: 'landmark', iconTint: 'purple', name: 'Toll & Levy', description: 'Applies based on route and location', rate: 'Variable' },
  { id: 'PR-004', icon: 'triangle-alert', iconTint: 'amber', name: 'Peak Season Surcharge', description: 'Applies from Nov 1 - Jan 31', rate: '7.5%' },
  { id: 'PR-005', icon: 'clock-alert', iconTint: 'red', name: 'Demurrage Charge', description: 'Applies after free time expires', rate: 'Per Day' },
  { id: 'PR-006', icon: 'moon', iconTint: 'blue', name: 'Night Delivery Surcharge', description: 'Applies for deliveries after 8pm', rate: '8%' },
  { id: 'PR-007', icon: 'route', iconTint: 'teal', name: 'Off-Route Surcharge', description: 'Applies for stops outside the agreed route', rate: '₦15,000' },
  { id: 'PR-008', icon: 'hourglass', iconTint: 'amber', name: 'Waiting Time Fee', description: 'Applies after 2 hours of loading wait', rate: '₦5,000/hr' },
];

export const surcharges = pricingRules.map((r, i) => ({
  ...r, status: i === 6 ? 'Inactive' : 'Active', appliesTo: 'All Services', effectiveFrom: 'Jan 1, 2026',
}));

export const priceLists = [
  { id: 'PL-2026-001', name: 'Lagos Zone Price List', region: 'Lagos', services: 18, status: 'Active', currency: 'NGN', lastUpdated: 'May 30, 2026' },
  { id: 'PL-2026-002', name: 'Port Harcourt Zone Price List', region: 'Rivers', services: 9, status: 'Active', currency: 'NGN', lastUpdated: 'May 28, 2026' },
  { id: 'PL-2026-003', name: 'Kano Zone Price List', region: 'Kano', services: 7, status: 'Active', currency: 'NGN', lastUpdated: 'May 26, 2026' },
  { id: 'PL-2026-004', name: 'Container Import Rates', region: 'National', services: 12, status: 'Active', currency: 'NGN', lastUpdated: 'May 30, 2026' },
  { id: 'PL-2026-005', name: 'Container Export Rates', region: 'National', services: 10, status: 'Active', currency: 'NGN', lastUpdated: 'May 30, 2026' },
  { id: 'PL-2026-006', name: 'Domestic General Cargo Rates', region: 'National', services: 14, status: 'Active', currency: 'NGN', lastUpdated: 'May 29, 2026' },
  { id: 'PL-2026-007', name: 'Break Bulk Rates', region: 'National', services: 8, status: 'Active', currency: 'NGN', lastUpdated: 'May 29, 2026' },
  { id: 'PL-2026-008', name: 'Special Equipment Rates', region: 'National', services: 6, status: 'Active', currency: 'NGN', lastUpdated: 'May 28, 2026' },
  { id: 'PL-2026-009', name: 'Warehousing Rates', region: 'Lagos', services: 5, status: 'Active', currency: 'NGN', lastUpdated: 'May 27, 2026' },
  { id: 'PL-2026-010', name: 'Cross-Border Rates', region: 'Border Crossings', services: 4, status: 'Draft', currency: 'NGN', lastUpdated: 'May 20, 2026' },
  { id: 'PL-2026-011', name: 'Express / Priority Rates', region: 'National', services: 6, status: 'Active', currency: 'NGN', lastUpdated: 'May 24, 2026' },
  { id: 'PL-2026-012', name: 'Off-Peak Discount Rates', region: 'National', services: 5, status: 'Inactive', currency: 'NGN', lastUpdated: 'May 10, 2026' },
];

export const recentPriceChanges = [
  { id: 'CHG-2026-0421', service: 'Import (Container)', route: 'Apapa → Ikeja', from: 340000, to: 350000, pct: '+2.9%', updated: 'May 30, 2026', time: '09:42 AM', by: 'Admin' },
  { id: 'CHG-2026-0420', service: 'Break Bulk', route: 'Apapa → Ikeja', from: 380000, to: 400000, pct: '+5.3%', updated: 'May 29, 2026', time: '04:10 PM', by: 'Admin' },
  { id: 'CHG-2026-0419', service: 'Domestic (General Cargo)', route: 'Lagos → Ibadan', from: 170000, to: 180000, pct: '+5.9%', updated: 'May 29, 2026', time: '05:20 PM', by: 'Admin' },
  { id: 'CHG-2026-0418', service: 'Transfer / Value Chain', route: 'Ikeja → Ajah Depot', from: 115000, to: 120000, pct: '+4.3%', updated: 'May 29, 2026', time: '03:48 PM', by: 'Admin' },
  { id: 'CHG-2026-0417', service: 'Warehousing (Per Day)', route: 'Ikeja Warehouse', from: 4000, to: 4500, pct: '+12.5%', updated: 'May 27, 2026', time: '02:30 PM', by: 'Admin' },
  { id: 'CHG-2026-0416', service: 'Export (Container)', route: 'Ikeja → Apapa Port', from: 305000, to: 320000, pct: '+4.9%', updated: 'May 26, 2026', time: '11:20 AM', by: 'Admin' },
  { id: 'CHG-2026-0415', service: 'Domestic (General Cargo)', route: 'Lagos → Kano', from: 590000, to: 620000, pct: '+5.1%', updated: 'May 26, 2026', time: '04:55 PM', by: 'Admin' },
  { id: 'CHG-2026-0414', service: 'Special Equipment', route: 'Lagos → Aba', from: 745000, to: 780000, pct: '+4.7%', updated: 'May 24, 2026', time: '03:22 PM', by: 'Admin' },
];

export const priceApprovalSummary = { pending: 18, approved: 32, rejected: 6 };

export const priceExceptions = [
  { id: 'EXC-2026-0091', service: 'Import (Container)', route: 'Apapa Port → Ikeja', reason: 'Customer negotiated rate', requestedBy: 'Goodwill Forwarding Ltd', standardPrice: 350000, exceptionPrice: 315000, status: 'Pending Approval', submitted: 'May 30, 2026' },
  { id: 'EXC-2026-0090', service: 'Break Bulk', route: 'Onne Port → Owerri', reason: 'High-volume repeat customer', requestedBy: 'CargoLink Logistics', standardPrice: 260000, exceptionPrice: 235000, status: 'Pending Approval', submitted: 'May 29, 2026' },
  { id: 'EXC-2026-0089', service: 'Special Equipment', route: 'Lagos → Kaduna', reason: 'Oversized cargo surcharge waiver', requestedBy: 'DCL Shipping Services', standardPrice: 920000, exceptionPrice: 860000, status: 'Approved', submitted: 'May 27, 2026' },
  { id: 'EXC-2026-0088', service: 'Domestic (General Cargo)', route: 'Lagos → Sokoto', reason: 'Return-trip loyalty discount', requestedBy: 'ABC Forwarders Ltd', standardPrice: 680000, exceptionPrice: 640000, status: 'Approved', submitted: 'May 25, 2026' },
  { id: 'EXC-2026-0087', service: 'Warehousing', route: 'Ikeja Warehouse', reason: 'Extended storage waiver request', requestedBy: 'Transglobal Logistics', standardPrice: 5000, exceptionPrice: 4200, status: 'Rejected', submitted: 'May 22, 2026' },
  { id: 'EXC-2026-0086', service: 'Import (Container)', route: 'Tin Can Port → Ikeja', reason: 'Damaged-goods goodwill adjustment', requestedBy: 'Nig. Bulk Consortia', standardPrice: 280000, exceptionPrice: 252000, status: 'Pending Approval', submitted: 'May 21, 2026' },
];

export const priceHistory = [
  ...recentPriceChanges,
  { id: 'CHG-2026-0413', service: 'Transfer / Value Chain', route: 'Tin Can Port → Ajah Depot', from: 140000, to: 150000, pct: '+7.1%', updated: 'May 20, 2026', time: '08:50 AM', by: 'Admin' },
  { id: 'CHG-2026-0412', service: 'Return Trip', route: 'Ikeja → Apapa Port', from: 125000, to: 130000, pct: '+4.0%', updated: 'May 22, 2026', time: '02:44 PM', by: 'Admin' },
  { id: 'CHG-2026-0411', service: 'Import (Container)', route: 'Apapa Port → Ibadan', from: 395000, to: 410000, pct: '+3.8%', updated: 'May 23, 2026', time: '05:05 PM', by: 'Admin' },
];
