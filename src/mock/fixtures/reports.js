// Reports & Analytics — transcribed from uploads/trukkas-admin/028.jpeg (dashboard),
// 030.jpeg (Export Report wizard) and 031.jpeg (Preview & Export). Where the source
// screenshots carried numbers that don't sum internally (e.g. Jobs by Status), the
// figures below were rebalanced to foot exactly against the 245-job KPI so every
// chart on the dashboard reconciles — same treatment other fixtures give inflated
// "showing X of Y" stats.

export const dashboardSummary = {
  totalJobs: 245, totalJobsDelta: '12.4%', totalJobsTrend: [180, 195, 188, 205, 212, 228, 220, 235, 230, 245],
  completedJobs: 178, completedJobsDelta: '15.6%', completedJobsTrend: [120, 128, 132, 140, 145, 152, 158, 165, 170, 178],
  totalRevenue: 128400000, totalRevenueDelta: '18.7%', totalRevenueTrend: [78, 85, 90, 96, 102, 108, 112, 118, 122, 128],
  totalPayouts: 82700000, totalPayoutsDelta: '11.3%', totalPayoutsTrend: [58, 62, 65, 68, 71, 74, 76, 79, 81, 83],
  activeUsers: 1842, activeUsersDelta: '9.2%', activeUsersTrend: [1420, 1480, 1510, 1560, 1600, 1650, 1690, 1740, 1790, 1842],
  complianceRate: 92.4, complianceRateDelta: '4.3%', complianceRateTrend: [85, 86, 87, 88, 89, 90, 90.5, 91, 92, 92.4],
};

export const operationsOverview = {
  labels: ['May 14', 'May 15', 'May 16', 'May 17', 'May 18', 'May 19', 'May 20'],
  series: [
    { name: 'Created', color: 'var(--tk-viz-1)', points: [62, 71, 65, 74, 69, 78, 72] },
    { name: 'In Progress', color: 'var(--tk-viz-3)', points: [45, 52, 48, 55, 50, 58, 53] },
    { name: 'Completed', color: 'var(--tk-viz-2)', points: [25, 30, 28, 33, 31, 36, 34] },
    { name: 'Cancelled', color: 'var(--tk-viz-4)', points: [8, 10, 7, 11, 9, 12, 10] },
  ],
};

export const revenuePayoutsTrend = {
  daily: {
    labels: ['May 14', 'May 15', 'May 16', 'May 17', 'May 18', 'May 19', 'May 20'],
    revenue: [42, 55, 48, 58, 45, 60, 52],
    payouts: [28, 32, 30, 35, 29, 38, 31],
  },
  weekly: {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    revenue: [265, 298, 312, 340],
    payouts: [178, 195, 205, 222],
  },
  monthly: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    revenue: [980, 1040, 1120, 1080, 1250, 1310],
    payouts: [640, 680, 720, 705, 810, 845],
  },
};

export const jobsByStatus = [
  { label: 'Completed', count: 178, pct: '72.7%', tone: 'success', color: 'var(--tk-viz-2)' },
  { label: 'In Progress', count: 45, pct: '18.4%', tone: 'info', color: 'var(--tk-viz-3)' },
  { label: 'Pending', count: 14, pct: '5.7%', tone: 'warning', color: 'var(--tk-viz-1)' },
  { label: 'Cancelled', count: 8, pct: '3.3%', tone: 'danger', color: 'var(--tk-viz-4)' },
];

export const jobsByType = [
  { label: 'Import', count: 98, pct: '40.0%', color: 'var(--tk-viz-1)' },
  { label: 'Export', count: 76, pct: '31.0%', color: 'var(--tk-viz-2)' },
  { label: 'Local Delivery', count: 41, pct: '16.7%', color: 'var(--tk-viz-3)' },
  { label: 'Haulage', count: 20, pct: '8.2%', color: 'var(--tk-viz-5)' },
  { label: 'Others', count: 10, pct: '4.1%', color: 'var(--tk-ink-300)' },
];

export const geographicalDistribution = [
  { label: 'Lagos', count: 96, pct: '39.2%' },
  { label: 'Apapa', count: 45, pct: '18.4%' },
  { label: 'Port Harcourt', count: 28, pct: '11.4%' },
  { label: 'Onne', count: 26, pct: '10.6%' },
  { label: 'Tin Can', count: 22, pct: '9.0%' },
  { label: 'Others', count: 28, pct: '11.4%' },
];

export const topPerformingEntities = [
  { rank: 1, entity: 'Atlantic Logistics Ltd', entityType: 'Forwarder', jobs: 32, revenue: 24600000, growth: '22.4%' },
  { rank: 2, entity: 'Blue Ocean Exporters', entityType: 'Exporter', jobs: 28, revenue: 18300000, growth: '18.7%' },
  { rank: 3, entity: 'Prime Cargo Services', entityType: 'Forwarder', jobs: 24, revenue: 15800000, growth: '14.2%' },
  { rank: 4, entity: 'Swift Haulage Ltd', entityType: 'Truck Company', jobs: 21, revenue: 12900000, growth: '11.3%' },
  { rank: 5, entity: 'Greenline Logistics', entityType: 'Truck Company', jobs: 18, revenue: 10700000, growth: '9.8%' },
];

export const financialSummary = {
  totalRevenue: 128400000, totalRevenueDelta: '18.7%',
  totalPayouts: 82700000, totalPayoutsDelta: '11.3%',
  outstandingPayments: 22100000, outstandingPaymentsDelta: '3.2%', outstandingPaymentsDirection: 'down',
  escrowBalance: 35600000, escrowBalanceDelta: '6.8%',
};

export const userEngagement = {
  activeUsers: 1842, activeUsersDelta: '9.2%',
  newUsers: 312, newUsersDelta: '14.6%',
  userSessions: 4826, userSessionsDelta: '11.8%',
};

export const complianceOverview = {
  totalVerifications: 128,
  verified: 72, verifiedPct: '56.3%',
  pending: 32, pendingPct: '25.0%',
  rejected: 6, rejectedPct: '4.7%',
};

export const alertsExceptions = [
  { label: 'Jobs Delayed', count: 18 },
  { label: 'Payments Overdue', count: 12 },
  { label: 'Verification Pending', count: 32 },
  { label: 'Compliance Issues', count: 6 },
];

// ---- Export Report wizard ---------------------------------------------------

export const REPORT_TYPES = [
  { id: 'verification', title: 'Verification Performance', description: 'Comprehensive verification metrics and performance analysis.', icon: 'shield-check', tint: 'green' },
  { id: 'operations', title: 'Operations Summary', description: 'Overview of jobs, trips, trucks and operational activities.', icon: 'calendar-days', tint: 'blue' },
  { id: 'financial', title: 'Financial Summary', description: 'Revenue, payouts, escrows and financial performance summary.', icon: 'wallet', tint: 'purple' },
  { id: 'compliance', title: 'Compliance Report', description: 'Compliance status, document submissions and audit summary.', icon: 'file-check-2', tint: 'blue' },
  { id: 'fleet', title: 'Fleet Performance', description: 'Fleet utilization, trips, distance, fuel and maintenance.', icon: 'truck', tint: 'orange' },
  { id: 'entity', title: 'Entity Performance', description: 'Performance metrics by forwarders, exporters and other entities.', icon: 'building-2', tint: 'orange' },
  { id: 'audit', title: 'Audit & Activity Log', description: 'System activities, user actions and audit trail report.', icon: 'scroll-text', tint: 'red' },
  { id: 'custom', title: 'Custom Report', description: 'Build a custom report with your selected metrics and dimensions.', icon: 'sliders-horizontal', tint: 'purple' },
];

export const COLUMN_GROUPS = [
  { group: 'General Information', columns: [
    { key: 'entityName', label: 'Entity Name', checked: true },
    { key: 'entityType', label: 'Entity Type', checked: true },
    { key: 'entityCode', label: 'Entity Code', checked: true },
    { key: 'registrationDate', label: 'Registration Date', checked: false },
    { key: 'contactPerson', label: 'Contact Person', checked: false },
    { key: 'emailAddress', label: 'Email Address', checked: false },
    { key: 'phoneNumber', label: 'Phone Number', checked: false },
  ] },
  { group: 'Verification Details', columns: [
    { key: 'verificationStatus', label: 'Verification Status', checked: true },
    { key: 'riskLevel', label: 'Risk Level', checked: true },
    { key: 'verificationDate', label: 'Verification Date', checked: true },
    { key: 'documentType', label: 'Document Type', checked: false },
    { key: 'verifiedBy', label: 'Verified By', checked: false },
    { key: 'expiryDate', label: 'Expiry Date', checked: false },
  ] },
  { group: 'Performance Metrics', columns: [
    { key: 'processingTime', label: 'Processing Time', checked: true },
    { key: 'successRate', label: 'Success Rate', checked: true },
    { key: 'totalVerifications', label: 'Total Verifications', checked: true },
    { key: 'rejectionRate', label: 'Rejection Rate', checked: false },
    { key: 'escalationCount', label: 'Escalation Count', checked: false },
    { key: 'responseTime', label: 'Response Time', checked: false },
  ] },
  { group: 'Financial Information', columns: [
    { key: 'totalRevenue', label: 'Total Revenue', checked: false },
    { key: 'totalPayouts', label: 'Total Payouts', checked: false },
    { key: 'outstandingAmount', label: 'Outstanding Amount', checked: false },
    { key: 'avgTransactionValue', label: 'Avg Transaction Value', checked: false },
    { key: 'paymentMethod', label: 'Payment Method', checked: false },
    { key: 'currency', label: 'Currency', checked: false },
  ] },
  { group: 'Compliance Information', columns: [
    { key: 'complianceScore', label: 'Compliance Score', checked: true },
    { key: 'auditStatus', label: 'Audit Status', checked: true },
    { key: 'lastAuditDate', label: 'Last Audit Date', checked: true },
    { key: 'policyViolations', label: 'Policy Violations', checked: true },
    { key: 'correctiveActions', label: 'Corrective Actions', checked: false },
  ] },
  { group: 'Metadata', columns: [
    { key: 'createdBy', label: 'Created By', checked: true },
    { key: 'lastModified', label: 'Last Modified', checked: true },
    { key: 'recordId', label: 'Record ID', checked: true },
    { key: 'sourceSystem', label: 'Source System', checked: true },
    { key: 'tags', label: 'Tags', checked: true },
  ] },
];

export const ENTITY_TYPE_OPTIONS = ['All Types', 'Forwarder', 'Exporter', 'Truck Company'];
export const STATUS_OPTIONS = ['All Statuses', 'Verified', 'Pending', 'Rejected'];
export const LOCATION_OPTIONS = ['All Locations', 'Lagos', 'Apapa', 'Port Harcourt', 'Onne', 'Tin Can'];

const e = (rank, entity, entityType, total, verified, pending, rejected, successRate, avgTime, complianceRate) => ({
  rank, entity, entityType, totalVerifications: total, verified, pending, rejected, successRate, avgTime, complianceRate,
});

export const verificationPerformanceRows = [
  e(1, 'Atlantic Logistics Ltd', 'Forwarder', 24, 16, 6, 2, '95.8%', '2h 15m', '93.2%'),
  e(2, 'Blue Ocean Exporters', 'Exporter', 18, 12, 4, 2, '93.3%', '2h 45m', '92.1%'),
  e(3, 'Prime Cargo Services', 'Forwarder', 16, 9, 5, 2, '90.0%', '2h 10m', '90.5%'),
  e(4, 'Swift Haulage Ltd', 'Truck Company', 14, 8, 4, 2, '88.9%', '1h 55m', '88.7%'),
  e(5, 'Greenline Logistics', 'Truck Company', 12, 7, 4, 1, '91.7%', '2h 05m', '91.0%'),
  e(6, 'Oceanic Transport', 'Forwarder', 10, 6, 3, 1, '90.0%', '2h 20m', '89.8%'),
  e(7, 'Global Freight Ltd', 'Forwarder', 9, 6, 2, 1, '88.9%', '1h 50m', '87.3%'),
  e(8, 'Westport Exporters', 'Exporter', 8, 5, 2, 1, '87.5%', '2h 30m', '86.2%'),
  e(9, 'Haulage Masters', 'Truck Company', 7, 4, 2, 1, '85.7%', '2h 05m', '84.5%'),
  e(10, 'Transglobal Logistics', 'Forwarder', 6, 4, 1, 1, '83.3%', '1h 45m', '82.0%'),
  e(11, 'Coastal Exporters Ltd', 'Exporter', 6, 4, 1, 1, '83.3%', '2h 00m', '81.6%'),
  e(12, 'Ironbridge Haulage', 'Truck Company', 6, 3, 2, 1, '80.0%', '2h 40m', '80.9%'),
  e(13, 'Nimbus Forwarding', 'Forwarder', 5, 3, 1, 1, '80.0%', '1h 40m', '79.8%'),
  e(14, 'Delta Cargo Movers', 'Truck Company', 5, 3, 1, 1, '80.0%', '2h 15m', '79.1%'),
  e(15, 'Harborline Exporters', 'Exporter', 5, 3, 1, 1, '80.0%', '2h 05m', '78.6%'),
  e(16, 'Continental Forwarders', 'Forwarder', 4, 2, 1, 1, '75.0%', '1h 55m', '77.4%'),
  e(17, 'Westbay Logistics', 'Truck Company', 4, 2, 1, 1, '75.0%', '2h 25m', '76.9%'),
  e(18, 'Northgate Exporters', 'Exporter', 4, 2, 1, 1, '75.0%', '2h 10m', '76.2%'),
  e(19, 'Cargo Bridge Ltd', 'Forwarder', 3, 2, 1, 0, '100.0%', '1h 35m', '75.8%'),
  e(20, 'Steelroute Haulage', 'Truck Company', 3, 2, 1, 0, '100.0%', '2h 00m', '75.1%'),
  e(21, 'Palmgrove Exporters', 'Exporter', 3, 1, 1, 1, '66.7%', '2h 20m', '74.5%'),
  e(22, 'Everline Forwarders', 'Forwarder', 3, 1, 1, 1, '66.7%', '1h 50m', '73.9%'),
  e(23, 'Riverside Cargo Co.', 'Truck Company', 2, 1, 1, 0, '100.0%', '2h 10m', '73.2%'),
  e(24, 'Sunrise Exporters', 'Exporter', 2, 1, 0, 1, '50.0%', '2h 35m', '72.6%'),
  e(25, 'Pinnacle Logistics', 'Forwarder', 2, 1, 1, 0, '100.0%', '1h 45m', '72.0%'),
];

export const verificationSummaryCards = [
  { key: 'total', icon: 'shield-check', color: 'var(--tk-viz-1)', label: 'Total Verifications', value: complianceOverview.totalVerifications, delta: '18.2%', direction: 'up' },
  { key: 'verified', icon: 'circle-check', color: 'var(--tk-viz-2)', label: 'Verified', value: complianceOverview.verified, delta: '56.3%', direction: 'up' },
  { key: 'pending', icon: 'hourglass', color: 'var(--tk-viz-3)', label: 'Pending', value: complianceOverview.pending, delta: '11.11%', direction: 'down' },
  { key: 'rejected', icon: 'circle-x', color: 'var(--tk-viz-4)', label: 'Rejected', value: complianceOverview.rejected, delta: '25.0%', direction: 'down' },
  { key: 'compliance', icon: 'shield', color: 'var(--tk-viz-2)', label: 'Compliance Rate', value: '92.4%', delta: '4.3%', direction: 'up' },
  { key: 'avgTime', icon: 'timer', color: 'var(--tk-viz-5)', label: 'Avg. Verification Time', value: '2h 45m', delta: '10.5%', direction: 'down' },
];

export const EXPORT_FORMATS = [
  { id: 'xlsx', label: 'Excel (.xlsx)', description: 'Best for spreadsheets & pivot tables', icon: 'file-spreadsheet', recommended: true },
  { id: 'csv', label: 'CSV (.csv)', description: 'Comma separated values', icon: 'file-text' },
  { id: 'pdf', label: 'PDF (.pdf)', description: 'Portable document format', icon: 'file-type' },
  { id: 'json', label: 'JSON (.json)', description: 'JavaScript Object Notation', icon: 'braces' },
];
