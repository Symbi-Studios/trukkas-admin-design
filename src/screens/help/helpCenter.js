// The apps group help articles into these seven topics (GET /help/categories maps each article's
// free-text category onto one of them). Using the exact names keeps admin and app in step.
export const HELP_TOPICS = [
  { slug: 'account-login', value: 'Account & Login', icon: 'user-round' },
  { slug: 'jobs-bookings', value: 'Jobs & Bookings', icon: 'briefcase' },
  { slug: 'payments-wallet', value: 'Payments & Wallet', icon: 'wallet' },
  { slug: 'truck-fleet', value: 'Truck & Fleet', icon: 'truck' },
  { slug: 'driver-management', value: 'Driver Management', icon: 'users' },
  { slug: 'documents-compliance', value: 'Documents & Compliance', icon: 'file-text' },
  { slug: 'technical', value: 'Technical', icon: 'settings' },
];
export const AUDIENCES = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'FORWARDERS', label: 'Forwarders' },
  { value: 'TRUCKERS', label: 'Truckers' },
  { value: 'DRIVERS', label: 'Drivers' },
  { value: 'INTERNAL', label: 'Admins only' },
];
export const audienceLabel = (code) => AUDIENCES.find((a) => a.value === code)?.label || '—';
export const STATUS_TONE = { Published: 'success', Draft: 'neutral', Archived: 'neutral' };
export const isKnownTopic = (category) => HELP_TOPICS.some((t) => t.value === category);
export const articleEditUrl = (id) => `/knowledge-base/edit?articleId=${encodeURIComponent(id)}`;
