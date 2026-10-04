// Existing form choices, not saved roles or an authoritative permission catalog.
export const ROLE_MODULE_MATRIX = [
  { key: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard', level: 'full' },
  { key: 'jobs', icon: 'package', label: 'Jobs & Trips', level: 'full' },
  { key: 'dispatch', icon: 'radio-tower', label: 'Dispatch Center', level: 'custom' },
  { key: 'tracking', icon: 'map-pin', label: 'Live Tracking', level: 'custom' },
  { key: 'triangulation', icon: 'boxes', label: 'Container Triangulation', level: 'custom' },
  { key: 'fleet', icon: 'truck', label: 'Fleet Management', level: 'full' },
  { key: 'cargo', icon: 'container', label: 'Cargo Management', level: 'custom' },
  { key: 'finance', icon: 'wallet', label: 'Finance', actions: '—', level: 'custom' },
  { key: 'reports', icon: 'chart-column', label: 'Reports & Analytics', level: 'custom' },
  { key: 'documents', icon: 'file-text', label: 'Documents & Compliance', level: 'custom' },
  { key: 'verification', icon: 'badge-check', label: 'Verification', level: 'none' },
  { key: 'users', icon: 'users-round', label: 'User Management', actions: '—', level: 'none' },
  { key: 'settings', icon: 'settings', label: 'System Settings', level: 'none' },
];

export const ROLE_SCOPES = [
  { key: 'org', icon: 'globe', title: 'Organization Wide', description: 'Can access all data across the entire platform.' },
  { key: 'branch', icon: 'building-2', title: 'Restricted to Branches', description: 'Can access only selected branches.' },
  { key: 'custom', icon: 'user-cog', title: 'Custom Scope', description: 'Define specific data access rules.' },
];
