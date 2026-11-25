// Presentation helpers shared by the announcement composer and detail page.

export const TYPES = ['Notice', 'Update', 'Feature', 'Reminder', 'System', 'Campaign'];
export const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

/** The four backend audience modes, named the way an admin thinks about them. */
export const AUDIENCE_MODES = [
  { name: 'All Users', label: 'Everyone', key: null },
  { name: 'User Roles', label: 'User groups', key: 'roleIds' },
  { name: 'Users with Access', label: 'Company teams', key: 'moduleIds' },
  { name: 'Custom Users', label: 'Specific people', key: 'userIds' },
];

export const CHANNEL_META = {
  'in-app': { label: 'In-app', icon: 'bell', hint: 'Shows in the notification centre, and as a banner while it’s live.' },
  push: { label: 'Push notification', icon: 'smartphone', hint: 'Phones with notifications turned on. Company team seats don’t get push.' },
  email: { label: 'Email', icon: 'mail', hint: 'Sent to each recipient’s account email.' },
};

export const ROLE_LABEL = { FORWARDER: 'Forwarder', TRUCKER: 'Trucker', DRIVER: 'Driver', EXPORTER: 'Exporter' };

const list = (items) => items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** One sentence describing who will get it, for the footer, review and detail page. */
export function audienceSentence({ audience, targeting }, options, people = {}) {
  const mode = AUDIENCE_MODES.find((item) => item.name === audience);
  if (!mode) return 'No audience chosen';
  if (!mode.key) return 'Every active forwarder, trucker and driver account';
  const ids = targeting?.[mode.key] || [];
  if (!ids.length) return mode.name === 'Custom Users' ? 'No one selected yet' : 'Nothing selected yet';
  if (mode.name === 'Custom Users') {
    const known = ids.filter((id) => people[id]?.label);
    if (!known.length) return `${ids.length.toLocaleString('en-NG')} specific ${ids.length === 1 ? 'person' : 'people'}`;
    const names = known.slice(0, 2).map((id) => people[id].label), rest = ids.length - names.length;
    return rest ? `${names.join(', ')} and ${rest} more` : list(names);
  }
  const catalogue = options?.modes?.find((item) => item.name === mode.name)?.options || [];
  const labels = ids.map((id) => catalogue.find((item) => item.id === id)?.label || id);
  return mode.name === 'User Roles' ? `All ${list(labels).toLowerCase()}` : `Company team members with ${list(labels)} access`;
}

export const channelList = (channels = []) => list(channels.map((c) => CHANNEL_META[c]?.label.replace(' notification', '') || c));

export function formatLagos(at, withTime = true) {
  if (at == null) return '—';
  return new Date(at).toLocaleString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) });
}

/** "In-app 12 · Push 10 (2 failed) · Email 12" from the backend delivery report. */
export function deliverySummary(delivery, channels = []) {
  if (!delivery) return channelList(channels);
  const parts = [['In-app', delivery.inApp], ['Push', delivery.push], ['Email', delivery.email]]
    .filter(([, c]) => c && c.delivered != null)
    .map(([name, c]) => `${name} ${c.delivered.toLocaleString('en-NG')}${c.failed ? ` (${c.failed} failed)` : ''}`);
  return parts.length ? parts.join(' · ') : channelList(channels);
}
