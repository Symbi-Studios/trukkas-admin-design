// Existing report labels and selectable fields; no backend records.
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

export const EXPORT_FORMATS = [
  { id: 'xlsx', label: 'Excel (.xlsx)', description: 'Best for spreadsheets & pivot tables', icon: 'file-spreadsheet', recommended: true },
  { id: 'csv', label: 'CSV (.csv)', description: 'Comma separated values', icon: 'file-text' },
  { id: 'pdf', label: 'PDF (.pdf)', description: 'Portable document format', icon: 'file-type' },
  { id: 'json', label: 'JSON (.json)', description: 'JavaScript Object Notation', icon: 'braces' },
];
