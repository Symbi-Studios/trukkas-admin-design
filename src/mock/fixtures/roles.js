export const rolesSummary = {
  totalRoles: 8, totalCaption: 'Across all modules',
  systemRoles: 5, systemCaption: 'Predefined roles',
  customRoles: 3, customCaption: 'Organization specific',
  permissions: 142, permissionsCaption: 'Across 16 modules',
};

/** Module groups shown in a role's expandable Permissions tab. */
const JOBS_TRIPS_ACTIONS = [
  { name: 'View Jobs', description: 'Allows viewing all jobs', granted: true },
  { name: 'Create Jobs', description: 'Allows creating new jobs', granted: true },
  { name: 'Edit Jobs', description: 'Allows editing jobs', granted: true },
  { name: 'Delete Jobs', description: 'Allows deleting jobs', granted: true },
  { name: 'View Trips', description: 'Allows viewing trips', granted: true },
  { name: 'Manage Trips', description: 'Allows managing trips', granted: true },
];

function moduleGroup(icon, name, granted, total, actions) {
  return { icon, name, granted, total, actions: actions || null };
}

export const roles = [
  {
    id: 'ROL-2024-0001', name: 'Super Admin', description: 'Full system access', type: 'System',
    users: 2, status: 'Active', lastUpdated: 'May 20, 2024, 10:30 AM', createdOn: 'Jan 10, 2024',
    createdBy: 'System', color: '#0241E8', icon: 'shield',
    permissionsCount: 142, permissionSummary: 'Has unrestricted access to every module and action on the platform.',
    modules: [
      moduleGroup('layout-dashboard', 'Dashboard', 4, 4),
      moduleGroup('package', 'Jobs & Trips', 6, 6, JOBS_TRIPS_ACTIONS),
      moduleGroup('radio-tower', 'Dispatch Center', 4, 4),
      moduleGroup('map-pin', 'Live Tracking', 3, 3),
      moduleGroup('truck', 'Fleet Management', 5, 5),
      moduleGroup('users-round', 'User Management', 4, 4),
      moduleGroup('key-round', 'Roles & Permissions', 4, 4),
      moduleGroup('settings', 'System Settings', 6, 6),
    ],
  },
  {
    id: 'ROL-2024-0002', name: 'Admin', description: 'Manage system and users', type: 'System',
    users: 8, status: 'Active', lastUpdated: 'May 18, 2024, 02:15 PM', createdOn: 'Jan 10, 2024',
    createdBy: 'Trukkas Admin', color: '#7C3AED', icon: 'shield-check',
    permissionsCount: 98, permissionSummary: 'Can manage users, roles and most operational modules.',
    modules: [
      moduleGroup('layout-dashboard', 'Dashboard', 4, 4),
      moduleGroup('package', 'Jobs & Trips', 6, 6, JOBS_TRIPS_ACTIONS),
      moduleGroup('radio-tower', 'Dispatch Center', 4, 4),
      moduleGroup('users-round', 'User Management', 4, 4),
    ],
  },
  {
    id: 'ROL-2024-0003', name: 'Operations Manager', description: 'Manage operations and jobs', type: 'Custom',
    users: 14, status: 'Active', lastUpdated: 'May 19, 2024, 11:45 AM', createdOn: 'Apr 25, 2024',
    createdBy: 'Trukkas Admin', color: '#0241E8', icon: 'shield',
    permissionsCount: 32, permissionSummary: 'Can manage operations, jobs, trips and view related reports.',
    modules: [
      moduleGroup('package', 'Jobs & Trips', 6, 6, JOBS_TRIPS_ACTIONS),
      moduleGroup('radio-tower', 'Dispatch Center', 4, 4),
      moduleGroup('map-pin', 'Live Tracking', 3, 3),
      moduleGroup('truck', 'Fleet Management', 5, 5),
    ],
  },
  {
    id: 'ROL-2024-0004', name: 'Dispatcher', description: 'Create and manage trips', type: 'System',
    users: 28, status: 'Active', lastUpdated: 'May 20, 2024, 09:20 AM', createdOn: 'Jan 10, 2024',
    createdBy: 'System', color: '#0E7C86', icon: 'radio-tower',
    permissionsCount: 24, permissionSummary: 'Can dispatch jobs, assign trucks and track active trips.',
    modules: [
      moduleGroup('package', 'Jobs & Trips', 4, 6),
      moduleGroup('radio-tower', 'Dispatch Center', 4, 4),
      moduleGroup('map-pin', 'Live Tracking', 3, 3),
    ],
  },
  {
    id: 'ROL-2024-0005', name: 'Verifier', description: 'Verify documents and entities', type: 'System',
    users: 36, status: 'Active', lastUpdated: 'May 17, 2024, 04:10 PM', createdOn: 'Jan 10, 2024',
    createdBy: 'System', color: '#4C16AC', icon: 'shield-check',
    permissionsCount: 14, permissionSummary: 'Can review, approve and reject entity verification requests.',
    modules: [
      moduleGroup('badge-check', 'Verification', 6, 6),
      moduleGroup('file-text', 'Documents & Compliance', 5, 5),
      moduleGroup('scroll-text', 'Audit Logs', 3, 3),
    ],
  },
  {
    id: 'ROL-2024-0006', name: 'Finance Manager', description: 'Manage pricing, wallets and payouts', type: 'Custom',
    users: 6, status: 'Active', lastUpdated: 'May 16, 2024, 03:30 PM', createdOn: 'Feb 12, 2024',
    createdBy: 'Trukkas Admin', color: '#F5A524', icon: 'wallet',
    permissionsCount: 18, permissionSummary: 'Can manage pricing rules, escrow wallets and payout approvals.',
    modules: [
      moduleGroup('tag', 'Pricing Management', 5, 5),
      moduleGroup('wallet', 'Escrows & Wallets', 6, 6),
      moduleGroup('banknote', 'Payouts', 4, 4),
      moduleGroup('percent', 'Fees & Commission', 3, 3),
    ],
  },
  {
    id: 'ROL-2024-0007', name: 'Viewer', description: 'Read-only access', type: 'System',
    users: 22, status: 'Active', lastUpdated: 'May 15, 2024, 10:00 AM', createdOn: 'Jan 10, 2024',
    createdBy: 'System', color: '#8A90A8', icon: 'eye',
    permissionsCount: 12, permissionSummary: 'Can view records and reports across the platform with no edit access.',
    modules: [
      moduleGroup('layout-dashboard', 'Dashboard', 4, 4),
      moduleGroup('chart-column', 'Reports & Analytics', 4, 4),
      moduleGroup('package', 'Jobs & Trips', 4, 6),
    ],
  },
  {
    id: 'ROL-2024-0008', name: 'Driver', description: 'Access for drivers', type: 'Custom',
    users: 147, status: 'Active', lastUpdated: 'May 14, 2024, 08:25 AM', createdOn: 'Jan 10, 2024',
    createdBy: 'System', color: '#12A150', icon: 'user',
    permissionsCount: 6, permissionSummary: 'Mobile-only access to assigned jobs, trips and documents.',
    modules: [
      moduleGroup('package', 'Jobs & Trips', 2, 6),
      moduleGroup('map-pin', 'Live Tracking', 2, 3),
      moduleGroup('file-text', 'Documents & Compliance', 2, 5),
    ],
  },
];

/** Module matrix used by the Create New Role permissions grid — mirrors screens/CreateRole. */
export const ROLE_MODULE_MATRIX = [
  { key: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard', level: 'full' },
  { key: 'jobs', icon: 'package', label: 'Jobs & Trips', level: 'full' },
  { key: 'dispatch', icon: 'radio-tower', label: 'Dispatch Center', level: 'custom' },
  { key: 'tracking', icon: 'map-pin', label: 'Live Tracking', level: 'custom' },
  { key: 'triangulation', icon: 'boxes', label: 'Container Triangulation', level: 'custom' },
  { key: 'fleet', icon: 'truck', label: 'Fleet Management', level: 'full' },
  { key: 'cargo', icon: 'container', label: 'Cargo Management', level: 'custom' },
  { key: 'finance', icon: 'wallet', label: 'Finance', actions: 6, level: 'custom' },
  { key: 'reports', icon: 'chart-column', label: 'Reports & Analytics', level: 'custom' },
  { key: 'documents', icon: 'file-text', label: 'Documents & Compliance', level: 'custom' },
  { key: 'verification', icon: 'badge-check', label: 'Verification', level: 'none' },
  { key: 'users', icon: 'users-round', label: 'User Management', actions: 4, level: 'none' },
  { key: 'settings', icon: 'settings', label: 'System Settings', level: 'none' },
];

export const ROLE_SCOPES = [
  { key: 'org', icon: 'globe', title: 'Organization Wide', description: 'Can access all data across the entire platform.' },
  { key: 'branch', icon: 'building-2', title: 'Restricted to Branches', description: 'Can access only selected branches.' },
  { key: 'custom', icon: 'user-cog', title: 'Custom Scope', description: 'Define specific data access rules.' },
];
