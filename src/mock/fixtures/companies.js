// Transcribed from uploads/trukkas-admin/005-efbfa5ee.png (Truck Companies).
// This screen's sample data is its own source screenshot's dataset — it doesn't
// share company names with fixtures/trucks.js, which was transcribed from a
// different source screenshot (Fleet Management). See HANDOFF.md.
export const companies = [
  { id: 'TC-1234567', name: 'Global Haulage Ltd', regNo: 'RC 1234567', contactName: 'Emeka Okafor', contactPhone: '0803 123 4567', contactEmail: 'emeka@globalhaulage.com', location: 'Lagos, Lagos State', trucks: 45, drivers: 78, status: 'Active', verification: 'Verified', performance: 92, joined: 'Jan 15, 2026' },
  { id: 'TC-2345678', name: 'Atlantic Logistics', regNo: 'RC 2345678', contactName: 'Chioma Nwosu', contactPhone: '0812 345 6789', contactEmail: 'chioma@atlanticlog.com', location: 'Port Harcourt, Rivers State', trucks: 32, drivers: 56, status: 'Active', verification: 'Verified', performance: 88, joined: 'Feb 3, 2026' },
  { id: 'TC-3456789', name: 'Zenith Transport', regNo: 'RC 3456789', contactName: 'Aminu Bello', contactPhone: '0805 456 7890', contactEmail: 'aminu@zenithtransport.com', location: 'Kano, Kano State', trucks: 28, drivers: 42, status: 'Active', verification: 'Verified', performance: 85, joined: 'Feb 20, 2026' },
  { id: 'TC-4567890', name: 'NextGen Logistics', regNo: 'RC 4567890', contactName: 'Tunde Adeyemi', contactPhone: '0815 567 8901', contactEmail: 'tunde@nextgenlog.com', location: 'Ibadan, Oyo State', trucks: 18, drivers: 31, status: 'Active', verification: 'Pending', performance: 72, joined: 'Mar 10, 2026' },
  { id: 'TC-5678901', name: 'Greenline Ltd', regNo: 'RC 5678901', contactName: 'Ibrahim Musa', contactPhone: '0807 678 9012', contactEmail: 'ibrahim@greenlineltd.ng', location: 'Enugu, Enugu State', trucks: 22, drivers: 38, status: 'Suspended', verification: 'Verified', performance: 45, joined: 'Apr 5, 2026' },
  { id: 'TC-6789012', name: 'SpeedHaul Transport', regNo: 'RC 6789012', contactName: 'John Danladi', contactPhone: '0809 789 0123', contactEmail: 'john@speedhaul.com', location: 'Kaduna, Kaduna State', trucks: 15, drivers: 26, status: 'Inactive', verification: 'Rejected', performance: null, joined: 'May 12, 2026' },
  { id: 'TC-7890123', name: 'SwiftMove Logistics', regNo: 'RC 7890123', contactName: 'Obinna Eze', contactPhone: '0811 890 1234', contactEmail: 'obinna@swiftmove.ng', location: 'Benin City, Edo State', trucks: 12, drivers: 19, status: 'Active', verification: 'Verified', performance: 81, joined: 'May 28, 2026' },
  { id: 'TC-8901234', name: 'PrimeWay Transport', regNo: 'RC 8901234', contactName: 'Yakubu Salisu', contactPhone: '0813 901 2345', contactEmail: 'yakubu@primeway.com', location: 'Aba, Abia State', trucks: 8, drivers: 14, status: 'Active', verification: 'Pending', performance: 67, joined: 'Jun 3, 2026' },
];

// Platform-wide KPIs shown in the stat row — decorative scene-setting to match
// the source screenshot exactly, same treatment as Dashboard's KPI row. The 8
// companies above are the real, interactive dataset; these totals describe the
// other ~120 companies the screenshot implies but this prototype doesn't mock.
export const companyStats = {
  totalCompanies: 128, totalCompaniesDelta: '18%',
  activeCompanies: 96, activeCompaniesDelta: '16%',
  verifiedCompanies: 84, verifiedCompaniesDelta: '21%',
  totalTrucks: 1245, totalTrucksDelta: '14%',
  activeTrucks: 1012, activeTrucksDelta: '19%',
  totalDrivers: 2362, totalDriversDelta: '17%',
};
