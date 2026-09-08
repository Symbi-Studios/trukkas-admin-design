export const platformInfo = {
  platformName: 'Trukkas', companyEmail: 'support@trukkas.com', website: 'https://trukkas.com',
  phoneNumber: '+234 1 700 8800', timezone: '(GMT+01:00) Lagos, Nigeria', defaultLanguage: 'English (EN)',
};

export const operationalGeneral = {
  defaultJobExpiryHours: 72, defaultCurrency: 'Nigerian Naira (NGN)', distanceUnit: 'Kilometers (km)',
  autoAssignJobs: false, allowPartialBids: true, autoCompleteTrips: true,
  requireDocumentVerification: true, enableDriverRatings: true, enableGeofencing: true,
};

export const notificationGeneral = {
  emailNotifications: true, smsNotifications: true, inAppNotifications: true,
  jobAlerts: true, payoutNotifications: true, incidentAlerts: true,
};

export const appearance = {
  primaryColor: '#4F46E5', secondaryColor: '#111827',
  logoRecommendation: 'Recommended size: 300 x 100px (PNG, SVG)',
};

export const systemStatus = {
  headline: 'All Systems Operational', lastChecked: 'Last checked: May 30, 2026, 09:46 AM',
  items: [
    { label: 'Web Application', status: 'Operational' },
    { label: 'Database', status: 'Operational' },
    { label: 'Payment Services', status: 'Operational' },
    { label: 'SMS Gateway', status: 'Operational' },
    { label: 'Email Service', status: 'Operational' },
    { label: 'Map & Location Services', status: 'Operational' },
  ],
};

export const platformVersion = {
  currentVersion: 'v1.0.0', lastUpdated: 'May 15, 2026',
  environment: 'Production', buildNumber: '2026.05.15.1',
};

export const generalQuickActions = [
  { icon: 'database-zap', label: 'Clear System Cache', hint: 'Refresh cached data across the platform.' },
  { icon: 'hard-drive-download', label: 'Backup Database', hint: 'Create a manual backup of the system.' },
  { icon: 'file-text', label: 'View System Logs', hint: 'Check error logs and system events.' },
  { icon: 'rotate-cw', label: 'Restart Services', hint: 'Restart system services (requires confirmation).' },
];

export const settingsMeta = { lastUpdated: 'May 30, 2026, 09:46 AM', updatedBy: 'Trukkas Admin' };

// ---- Operations Settings --------------------------------------------------
export const jobTripSettings = {
  defaultJobExpiryHours: 72, defaultLoadType: 'General Cargo', autoCancelExpiredJobs: true,
  requireDocumentVerification: true, defaultTripStatus: 'Draft', allowMultiStopTrips: true,
};

export const biddingAssignment = {
  defaultBiddingDurationHours: 24, preferredBidSelection: 'Lowest Valid Bid',
  allowManualAssignment: true, requireDriverAcceptance: true,
  autoCancelUnacceptedJobs: false, notifyOnNewBids: true,
};

export const dispatchTracking = {
  enableDispatchApproval: true, liveLocationTracking: true, trackingUpdateInterval: '5 minutes',
  allowTripReRouting: true, requirePod: true, autoCompleteTrip: false,
};

export const documentCompliance = {
  requiredDocsForJobCreation: 'Booking Confirmation, Cargo Details',
  requiredDocsForTripStart: 'Driver License, Vehicle Papers',
  requiredDocsForTripCompletion: 'POD, Delivery Photos',
  verifyDocumentsAutomatically: true,
};

export const timingSlas = {
  defaultLoadingTimeHours: 2, defaultUnloadingTimeHours: 2, delayThresholdHours: 6,
  autoFlagPotentialDelays: true, enableSlaTracking: true,
};

export const operationsCommunication = {
  sendJobAssignmentNotifications: true, sendTripStatusUpdates: true, sendDelayAlerts: true,
  sendCompletionNotifications: true, enableInAppChat: true,
};

export const operationsStatus = {
  headline: 'Operational', caption: 'All operational settings are active.',
  items: [
    { label: 'Job Processing', status: 'Active' },
    { label: 'Bidding System', status: 'Active' },
    { label: 'Dispatch', status: 'Active' },
    { label: 'Trip Tracking', status: 'Active' },
    { label: 'Document Verification', status: 'Active' },
    { label: 'Auto Notifications', status: 'Active' },
  ],
};

export const operationsQuickActions = [
  { icon: 'tag', label: 'Set Default Pricing Rules', hint: 'Configure base rates and margins.' },
  { icon: 'workflow', label: 'Manage Status Workflows', hint: 'Customize job and trip statuses.' },
  { icon: 'bell', label: 'Configure Notifications', hint: 'Set operational alert preferences.' },
  { icon: 'refresh-cw', label: 'Sync with Fleet Settings', hint: 'Apply fleet preferences to operations.' },
];

// ---- Finance Settings ------------------------------------------------------
export const financialPolicies = {
  defaultCurrency: 'Nigerian Naira (NGN)', currencyFormat: '₦1,234,567.00', decimalPlaces: '2 (e.g. 1,234.56)',
  allowPartialPayments: true, autoCalculateFees: true,
  requireFullEscrowBeforeDispatch: true, enableRefunds: true,
};

export const platformFees = {
  platformCommissionType: 'Percentage (%)', commissionRate: '5', transactionFeePerPayment: '₦100.00', vatRate: '7.5',
  applyVatOnCommission: true, includeTransactionFeeInCustomerBill: false,
  allowCustomFeesPerJob: true, enablePromotionalDiscounts: false,
};

export const escrowSettingsForm = {
  escrowHoldPeriodDays: 30, autoReleaseOnPod: 'Enabled',
  requireManualReviewForHighValueJobs: true, notifyStakeholdersOnEscrowRelease: true,
};

export const payoutSettingsForm = {
  defaultPayoutMethod: 'Bank Transfer', payoutProcessingTime: 'Instant (≤ 1 hour)',
  minimumPayoutAmount: '₦5,000.00', maximumPayoutAmount: '₦5,000,000.00',
  requireBankAccountVerification: true, allowInstantPayouts: true,
};

export const invoicingReceipts = {
  invoiceNumberFormat: 'INV-{YYYY}-{0001}', receiptNumberFormat: 'RCP-{YYYY}-{0001}',
  defaultInvoiceTermsDays: 14, invoiceLogo: 'Company Logo',
  automaticallyGenerateInvoices: true, sendInvoiceViaEmail: true,
};

export const accountingTax = {
  taxCalculation: 'Include VAT in price', taxIdentificationNumber: '12345678-0001',
  accountingIntegration: 'None', enableTaxReports: true, syncFinancialData: false,
};

export const financeStatus = {
  headline: 'Finance Settings Active', caption: 'All financial configurations are running smoothly.',
  items: [
    { label: 'Currency Configuration', status: 'Active' },
    { label: 'Platform Fees', status: 'Active' },
    { label: 'Escrow Rules', status: 'Active' },
    { label: 'Payout Settings', status: 'Active' },
    { label: 'Invoicing & Receipts', status: 'Active' },
    { label: 'Tax Compliance', status: 'Active' },
    { label: 'Accounting Integration', status: 'Active' },
  ],
};

export const financeQuickActions = [
  { icon: 'layers', label: 'Configure Fee Tiers', hint: 'Set different commission rates by customer type.' },
  { icon: 'banknote', label: 'Manage Payout Methods', hint: 'Enable or disable payout channels.' },
  { icon: 'receipt', label: 'View Tax Settings', hint: 'Configure VAT and tax compliance.' },
  { icon: 'file-text', label: 'Set Invoice Preferences', hint: 'Customize invoice format and numbering.' },
  { icon: 'plug-zap', label: 'Sync with Accounting', hint: 'Connect to Xero, QuickBooks, or other systems.' },
];

// ---- Notification Settings (Notifications tab) ----------------------------
export const notificationChannelDefaults = { inApp: true, email: true, sms: true };

export const quietHours = {
  enabled: false, from: '10:00 PM', to: '6:00 AM', timeZone: '(GMT+01:00) Lagos, Nigeria',
};

export const eventNotificationGroups = [
  {
    group: 'Jobs & Trips', icon: 'truck',
    events: [
      { key: 'newJobAssigned', label: 'New job assigned', hint: 'Notify when a new job is assigned to you or your team.', inApp: true, email: true, sms: true, frequency: 'Instant' },
      { key: 'jobStatusUpdated', label: 'Job status updated', hint: 'Notify when job status changes (e.g. en route, delivered).', inApp: true, email: true, sms: false, frequency: 'Instant' },
      { key: 'tripDelayAlerts', label: 'Trip delay alerts', hint: 'Notify when a trip is delayed.', inApp: true, email: true, sms: true, frequency: 'Instant' },
      { key: 'tripCompletion', label: 'Trip completion', hint: 'Notify when a trip is completed.', inApp: true, email: true, sms: false, frequency: 'Instant' },
      { key: 'jobCancellation', label: 'Job cancellation', hint: 'Notify when a job is cancelled.', inApp: true, email: true, sms: true, frequency: 'Instant' },
    ],
  },
  {
    group: 'Fleet & Maintenance', icon: 'wrench',
    events: [
      { key: 'maintenanceDue', label: 'Maintenance due', hint: 'Notify when a vehicle is due for maintenance.', inApp: true, email: true, sms: true, frequency: 'Instant' },
      { key: 'maintenanceOverdue', label: 'Maintenance overdue', hint: 'Notify when a vehicle is overdue for maintenance.', inApp: true, email: true, sms: true, frequency: 'Instant' },
      { key: 'vehicleIssueReported', label: 'Vehicle issue reported', hint: 'Notify when a new issue is logged for a vehicle.', inApp: true, email: true, sms: false, frequency: 'Instant' },
    ],
  },
];

export const NOTIFICATION_FREQUENCIES = ['Instant', 'Hourly Digest', 'Daily Digest', 'Off'];

export const notificationPreview = {
  icon: 'truck', title: 'New Job Assigned', time: '2m ago',
  body: 'A new trip has been assigned to you: Lagos → Abuja. Pickup on May 31, 2026.',
};

export const notificationChannelsStatus = [
  { icon: 'mail', label: 'Email Notifications', detail: 'admin@trukkas.com', status: 'Connected' },
  { icon: 'smartphone', label: 'SMS Notifications', detail: '+234 800 123 4567', status: 'Connected' },
  { icon: 'bell', label: 'In-App Notifications', detail: 'Enabled for all users', status: 'Active' },
];

export const notificationQuickActions = [
  { icon: 'mail', label: 'Manage Email Templates', hint: 'Customize notification emails.' },
  { icon: 'message-square', label: 'Manage SMS Templates', hint: 'Customize SMS message templates.' },
  { icon: 'users-round', label: 'Notification Groups', hint: 'Set team notification preferences.' },
  { icon: 'bell', label: 'Test Notification', hint: 'Send a test notification to your channels.' },
];

export const NOTIFICATION_TABS = ['Notification Preferences', 'Email Templates', 'SMS Templates', 'In-App Notifications', 'Notification Groups'];

// ---- Company Settings ------------------------------------------------------
export const COMPANY_TABS = ['Company Profile', 'Business Information', 'Banking & Payouts', 'Contacts', 'Documents', 'Preferences', 'Subscription & Billing'];

export const companyProfile = {
  logoText: 'Goodwill Forwarding Ltd.', logoColor: '#0F3D2E',
  companyName: 'Goodwill Forwarding Ltd.', registrationNumber: 'RC-1234567',
  businessType: 'Trucking Company', companySize: '51 – 200 employees',
  tagline: 'Reliable Cargo Movement Across Nigeria and Beyond.',
};

export const companyContact = {
  officialEmail: 'info@goodwillforwarding.com', phoneNumber: '+234 1 700 8800', alternatePhone: '+234 803 555 0192',
  website: 'https://www.goodwillforwarding.com', headOfficeAddress: '12 Industrial Avenue, Apapa\nLagos, Nigeria',
};

export const companyBusinessInfo = {
  tin: '12345678-0001', vatNumber: 'NG1234567', industry: 'Logistics & Transportation',
  incorporationDate: 'Jan 15, 2018', country: 'Nigeria', state: 'Lagos',
  aboutCompany: 'Goodwill Forwarding Ltd. is a leading logistics and haulage company providing reliable, safe and efficient cargo transportation across Nigeria and West Africa. We are committed to excellence, safety and on-time delivery.',
};

export const companyAccountStatus = {
  verified: true, headline: 'Verified Company', caption: 'Your company account is fully verified.',
  verifiedOn: 'Mar 15, 2024, 10:24 AM', verifiedBy: 'Trukkas Compliance Team',
};

export const companyQuickActions = [
  { icon: 'users-round', label: 'Manage Users', hint: 'Add or remove team members.' },
  { icon: 'file-text', label: 'View Documents', hint: 'See all company documents.' },
  { icon: 'landmark', label: 'Update Bank Details', hint: 'Manage payout accounts.' },
  { icon: 'settings', label: 'Company Preferences', hint: 'Set operational preferences.' },
];

export const companyActivity = [
  { title: 'Company profile updated', time: 'May 30, 2026, 09:40 AM', description: 'Updated company address', tone: 'var(--tk-success)' },
  { title: 'Logo changed', time: 'May 12, 2026, 02:15 PM', description: 'New company logo uploaded', tone: 'var(--tk-success)' },
  { title: 'Bank details updated', time: 'Apr 28, 2026, 11:20 AM', description: 'Payout account information updated', tone: 'var(--tk-success)' },
  { title: 'Company verified', time: 'Mar 15, 2026, 10:24 AM', description: 'Account verified by compliance team', tone: 'var(--tk-success)' },
];

export const BUSINESS_TYPES = ['Trucking Company', 'Freight Forwarder', 'Logistics Provider', 'Customs Broker'];
export const COMPANY_SIZES = ['1 – 10 employees', '11 – 50 employees', '51 – 200 employees', '201 – 500 employees', '500+ employees'];
export const INDUSTRIES = ['Logistics & Transportation', 'Freight Forwarding', 'Warehousing', 'Manufacturing'];
export const COMPANY_COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa'];
export const COMPANY_STATES = ['Lagos', 'Abuja', 'Rivers', 'Kano'];

// ---- Fleet Settings ---------------------------------------------------------
export const FLEET_TABS = ['General', 'Maintenance', 'Tracking & Telematics', 'Fuel & Costs', 'Documents', 'Compliance', 'Drivers', 'Integrations'];

export const fleetPreferences = {
  defaultTruckStatus: 'Active', defaultOwnershipType: 'Company Owned',
  defaultHomeLocation: 'Lagos Hub', distanceUnit: 'Kilometers (km)',
  fuelUnit: 'Liters (L)', weightUnit: 'Kilograms (kg)',
  enableFleetModules: true, allowAssetAssignment: true, requireVerification: false,
};

export const assetNumbering = {
  truckIdFormat: 'TRK-{#####}', trailerIdFormat: 'TRL-{#####}', equipmentIdFormat: 'EQP-{#####}',
  autoGenerateAssetNumbers: true,
};

export const defaultReminders = {
  maintenanceReminderDays: 7, inspectionReminderDays: 14, insuranceReminderDays: 30, permitRenewalReminderDays: 30,
  sendEmailNotifications: true, sendInAppNotifications: true,
};

export const fleetVisibility = {
  defaultAccessLevel: 'Fleet Managers', allowDriverAccess: true, allowCustomerVisibility: false, restrictSensitiveInformation: true,
};

export const deletionArchiving = { allowArchivingInactiveAssets: true, requireAdminApprovalForDeletion: true };

export const fleetDataRetention = {
  tripHistoryRetention: '5 years', maintenanceRecordsRetention: '5 years',
  fuelRecordsRetention: '3 years', inspectionRecordsRetention: '5 years',
};

export const fleetStatus = {
  headline: 'Fleet Settings Active', caption: 'All fleet configurations are running smoothly.',
  items: [
    { label: 'Fleet Management', status: 'Active' },
    { label: 'Maintenance Rules', status: 'Active' },
    { label: 'Tracking & Telematics', status: 'Active' },
    { label: 'Fuel & Cost Settings', status: 'Active' },
    { label: 'Document Management', status: 'Active' },
    { label: 'Compliance & Inspections', status: 'Active' },
    { label: 'Driver Assignment', status: 'Active' },
    { label: 'Integrations', status: 'Active' },
  ],
};

export const fleetQuickActions = [
  { icon: 'layers', label: 'Manage Asset Categories', hint: 'Configure truck, trailer, and equipment types.' },
  { icon: 'clipboard-list', label: 'Set Maintenance Templates', hint: 'Create reusable maintenance schedules.' },
  { icon: 'list-checks', label: 'Configure Inspection Checklists', hint: 'Set default compliance checklists.' },
  { icon: 'plug-zap', label: 'Manage Integrations', hint: 'Connect GPS and telematics providers.' },
];

export const TRUCK_STATUSES = ['Active', 'Inactive', 'In Maintenance'];
export const OWNERSHIP_TYPES = ['Company Owned', 'Leased', 'Owner-Operator'];
export const HOME_LOCATIONS = ['Lagos Hub', 'Abuja Hub', 'Port Harcourt Hub', 'Kano Hub'];
export const FUEL_UNITS = ['Liters (L)', 'Gallons (gal)'];
export const WEIGHT_UNITS = ['Kilograms (kg)', 'Pounds (lb)'];
export const ACCESS_LEVELS = ['Fleet Managers', 'Dispatchers', 'All Staff', 'Admins Only'];
export const RETENTION_YEARS = ['1 year', '3 years', '5 years', '7 years', 'Indefinite'];

// ---- Data Protection ---------------------------------------------------------
export const dataPrivacyConsent = {
  collectOnlyNecessaryData: true, enableUserConsentTracking: true, showPrivacyNoticeToUsers: true,
};

export const dataEncryption = { encryptDataInTransit: true, encryptDataAtRest: true };

export const dataRetentionSecurity = {
  userAccountData: '5 years', jobTripData: '7 years', financialRecords: '7 years', supportTickets: '3 years',
};

export const dataExportAccess = { allowUsersDownloadData: true, notifyUsersWhenDataReady: true };

export const dataDeletionSettings = { allowAccountDeletion: true, anonymizeDataAfterDeletion: true };

export const dataProtectionStatus = {
  headline: 'Your data is protected', caption: 'All data protection settings are active and compliant.',
};

export const complianceStandards = [
  { label: 'GDPR Compliant', detail: 'Meets EU data protection requirements.' },
  { label: 'NDPR Compliant', detail: 'Meets Nigeria Data Protection Regulation requirements.' },
  { label: 'Data Processing Agreement (DPA)', detail: 'In place for third-party data processors.' },
];

export const thirdPartyProcessors = [
  { icon: 'cloud', label: 'Amazon Web Services (AWS)', detail: 'Cloud hosting and infrastructure' },
  { icon: 'mail', label: 'SendGrid', detail: 'Transactional email services' },
  { icon: 'message-square', label: 'Twilio', detail: 'SMS notifications' },
  { icon: 'chart-column', label: 'Google Analytics', detail: 'Usage analytics' },
  { icon: 'credit-card', label: 'Stripe', detail: 'Payment processing' },
];

// ---- Security (overview) -----------------------------------------------------
export const authSettings = {
  requireTwoFactorAuth: true, allowSingleSignOn: true, enableBiometricLogin: false,
  requireEmailVerification: true, allowRememberDevice: true,
};

export const passwordPolicyOverview = {
  minPasswordLength: 12, passwordExpiryDays: 90, preventReuseOfPreviousPasswords: true,
};

export const sessionManagementOverview = {
  sessionTimeoutMinutes: 60, maxConcurrentSessions: 3,
  showActiveSessionsToUsers: true, terminateAllSessionsOnPasswordChange: true,
};

export const ipDeviceRestrictionsOverview = {
  accessControl: 'Allow all IP addresses', trustedIpAddresses: '',
  requireTrustedDevicesForAdmins: false, blockSuspiciousIpAddresses: true,
};

export const dataProtectionOverview = {
  encryptSensitiveData: true, enableDataMasking: true, allowDataExport: false,
};

export const securityAlertsOverview = {
  emailAlertsFailedLogin: true, emailAlertsNewUserRegistrations: true,
  emailAlertsRoleChanges: true, emailAlertsSuspiciousActivity: true,
};

export const securityStatus = {
  headline: 'Your system is secure', caption: 'All critical security settings are properly configured.',
};

export const recentSecurityEvents = [
  { icon: 'log-in', label: 'Successful login', detail: 'trukkasadmin@trukkas.com', time: 'Today, 10:24 AM', location: 'Lagos, Nigeria', tone: 'var(--tk-success)' },
  { icon: 'shield-alert', label: 'Failed login attempt', detail: 'unknown@domain.com', time: 'Today, 08:17 AM', location: 'Lagos, Nigeria', tone: 'var(--tk-danger)' },
  { icon: 'key-round', label: 'Password changed', detail: 'driver.john@trukkas.com', time: 'May 29, 2026, 04:12 PM', location: 'Abuja, Nigeria', tone: 'var(--tk-blue)' },
  { icon: 'user-plus', label: 'New user added', detail: 'fleet.manager@trukkas.com', time: 'May 28, 2026, 11:03 AM', location: 'Lagos, Nigeria', tone: 'var(--tk-blue)' },
  { icon: 'settings', label: 'SSO configuration updated', detail: 'by Trukkas Admin', time: 'May 27, 2026, 02:45 PM', location: 'Lagos, Nigeria', tone: 'var(--tk-blue)' },
];

export const securityQuickActions = [
  { icon: 'file-text', label: 'View Audit Logs', hint: 'See detailed security and access logs.' },
  { icon: 'users-round', label: 'Manage User Roles', hint: 'Configure permissions and access levels.' },
  { icon: 'user-plus', label: 'Configure SSO', hint: 'Set up SAML/SSO for your organization.' },
  { icon: 'monitor-smartphone', label: 'Review Active Sessions', hint: 'See and terminate active user sessions.' },
  { icon: 'file-check', label: 'Download Security Report', hint: 'Get a summary of your security settings.' },
];

export const ACCESS_CONTROL_OPTIONS = ['Allow all IP addresses', 'Restrict to trusted IPs only', 'Restrict to office network'];

// ---- Password & Sessions ------------------------------------------------------
export const passwordRequirements = {
  minPasswordLength: 12,
  requireUppercase: true, requireLowercase: true, requireNumber: true, requireSpecialChar: true,
  preventCommonPasswords: true, preventPreviousPasswords: true,
  passwordHistory: 5, passwordExpiryDays: 90, notifyBeforePasswordExpiry: true,
};

export const sessionSettings = {
  sessionTimeoutMinutes: 60, maxConcurrentSessions: 3,
  showActiveSessionsToUsers: true, allowUsersTerminateOtherSessions: true,
  rememberMePersistentLogin: true, persistentLoginDurationDays: 30,
};

export const loginNotificationsSettings = {
  emailNotificationNewDeviceLogin: true, emailNotificationMultipleFailedAttempts: true,
  notifyAccountOwnerOnSessionTermination: false,
};

export const activeSessions = [
  { id: 1, name: 'Emeka Okafor', role: 'Admin', device: 'MacBook Pro', client: 'Chrome • macOS', location: 'Lagos, NG', ip: '102.89.34.21', lastActive: 'May 30, 2026, 09:12 AM' },
  { id: 2, name: 'Aisha Bello', role: 'Dispatcher', device: 'iPhone 14', client: 'Safari • iOS', location: 'Abuja, NG', ip: '197.210.14.56', lastActive: 'May 30, 2026, 08:45 AM' },
  { id: 3, name: 'John Adewale', role: 'Driver', device: 'Android Phone', client: 'Chrome • Android', location: 'Ibadan, NG', ip: '105.44.12.78', lastActive: 'May 30, 2026, 07:18 AM' },
  { id: 4, name: 'Kemi Tunde', role: 'Fleet Manager', device: 'Windows PC', client: 'Edge • Windows', location: 'Lagos, NG', ip: '41.203.17.90', lastActive: 'May 30, 2026, 06:50 AM' },
  { id: 5, name: 'Samuel Okon', role: 'Accountant', device: 'MacBook Air', client: 'Chrome • macOS', location: 'Port Harcourt, NG', ip: '197.88.101.33', lastActive: 'May 29, 2026, 11:22 PM' },
];

export const activeSessionsTotal = 12;

// ---- Security Alerts -----------------------------------------------------------
export const securityAlertEvents = [
  { key: 'successfulLogin', icon: 'log-in', label: 'Successful login', description: 'Notify when a new login occurs.', inApp: true, email: true, sms: false },
  { key: 'failedLoginAttempts', icon: 'shield-alert', label: 'Failed login attempts', description: 'Notify when there are failed login attempts.', inApp: true, email: true, sms: true },
  { key: 'newDeviceLogin', icon: 'monitor-smartphone', label: 'New device login', description: 'Notify when a new device is used to log in.', inApp: true, email: true, sms: true },
  { key: 'newIpAddress', icon: 'map-pin', label: 'New IP address', description: 'Notify when a new IP address is detected.', inApp: true, email: true, sms: false },
  { key: 'passwordChanged', icon: 'key-round', label: 'Password changed', description: 'Notify when a password is changed.', inApp: true, email: true, sms: true },
  { key: 'accountRecoveryRequests', icon: 'refresh-cw', label: 'Account recovery requests', description: 'Notify when a recovery request is initiated.', inApp: true, email: true, sms: true },
  { key: 'adminRoleChanges', icon: 'users-round', label: 'Admin role changes', description: 'Notify when user roles or permissions change.', inApp: true, email: true, sms: false },
  { key: 'sensitiveDataAccess', icon: 'database', label: 'Sensitive data access', description: 'Notify when sensitive data is accessed.', inApp: true, email: true, sms: false },
  { key: 'multipleFailedAttempts', icon: 'triangle-alert', label: 'Multiple failed attempts', description: 'Notify when there are too many failed attempts.', inApp: true, email: true, sms: true },
  { key: 'suspiciousActivity', icon: 'eye', label: 'Suspicious activity', description: 'Notify about unusual or high-risk behavior.', inApp: true, email: true, sms: true },
];

export const alertDeliverySettings = {
  emailForSecurityAlerts: 'admin@trukkas.com', phoneForSmsAlerts: '+234 800 123 4567',
  digestFrequency: 'Real-time (Instant)',
};

export const securityAlertsQuietHours = { enabled: false, from: '10:00 PM', to: '6:00 AM' };

export const securityAlertsStatus = {
  headline: 'Active', caption: 'You will receive security alerts based on your preferences.',
};

export const recentSecurityAlerts = [
  { icon: 'log-in', label: 'Successful login', detail: 'New login from Chrome on Windows', time: 'Today, 09:14 AM', location: 'Lagos, Nigeria', tone: 'var(--tk-success)' },
  { icon: 'shield-alert', label: 'Failed login attempt', detail: 'Invalid password (3 attempts)', time: 'Today, 08:47 AM', location: 'Abuja, Nigeria', tone: 'var(--tk-danger)' },
  { icon: 'monitor-smartphone', label: 'New device login', detail: 'MacBook Pro (Chrome)', time: 'May 29, 2026, 10:22 PM', location: 'Lagos, Nigeria', tone: 'var(--tk-blue)' },
  { icon: 'map-pin', label: 'New IP address', detail: 'Login from new IP 197.210.14.56', time: 'May 28, 2026, 04:11 PM', location: 'Ibadan, Nigeria', tone: 'var(--tk-blue)' },
  { icon: 'key-round', label: 'Password changed', detail: 'Your password was updated', time: 'May 27, 2026, 11:03 PM', location: 'Lagos, Nigeria', tone: 'var(--tk-blue)' },
];

export const securityAlertsQuickActions = [
  { icon: 'history', label: 'View Login History', hint: 'See all recent account activity.' },
  { icon: 'monitor-smartphone', label: 'Manage Trusted Devices', hint: 'Review and remove trusted devices.' },
  { icon: 'key-round', label: 'Update Password', hint: 'Change your account password.' },
  { icon: 'shield-alert', label: 'Configure 2FA', hint: 'Strengthen your account security.' },
];

export const securityTip = 'Enable multi-factor authentication (2FA) and keep your contact information up to date to receive important security alerts.';

export const DIGEST_FREQUENCIES = ['Real-time (Instant)', 'Hourly Digest', 'Daily Digest'];
