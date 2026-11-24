// Explicit status lanes and compact card slots for each main admin board.
// Slot keys reuse the table's existing cell renderers; no extra data is inferred.
const route = (value) => {
  const [from, to] = typeof value === 'string' ? value.split(/\s*(?:→|->)\s*/, 2) : [];
  return { from, to };
};
const naira = (value) => value == null || Number.isNaN(Number(value)) ? null
  : `₦${Number(value).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const groups = (entries) => entries.map(([value, tone]) => ({ value, label: value, tone }));
const layout = (statuses, card, emptyLabel) => ({ groups: groups(statuses), card, emptyLabel });

export const BOARD_LAYOUTS = {
  trips: layout([
    ['Assigned', 'info'], ['In Transit', 'success'], ['At Pickup', 'purple'], ['At Delivery', 'orange'],
    ['Returning Container', 'teal'], ['Delayed', 'danger'], ['Delivered', 'success'],
  ], { title: 'job', value: 'eta', body: ['route'], footer: ['type', 'driver'] }, 'No trips'),
  bids: layout([
    ['Pending Evaluation', 'warning'], ['Bid Accepted', 'success'], ['In Transit', 'info'], ['At Delivery', 'orange'],
    ['Returning Container', 'teal'], ['Bidding', 'purple'], ['Completed', 'success'], ['Expired', 'danger'], ['Cancelled', 'neutral'],
  ], { title: 'id', value: 'low', subtitle: 'customer', route: (row) => route(row.route), footer: ['bids', 'date'] }, 'No bids'),
  offers: {
    ...layout([['PENDING', 'warning'], ['ACCEPTED', 'success'], ['REJECTED', 'danger'], ['EXPIRED', 'danger'], ['WITHDRAWN', 'neutral']],
      { title: 'id', value: 'amount', subtitle: 'company', footer: ['delta'] }, 'No counter offers'),
    groups: [
      { value: 'PENDING', label: 'Pending', tone: 'warning' }, { value: 'ACCEPTED', label: 'Accepted', tone: 'success' },
      { value: 'REJECTED', label: 'Rejected', tone: 'danger' }, { value: 'EXPIRED', label: 'Expired', tone: 'danger' },
      { value: 'WITHDRAWN', label: 'Withdrawn', tone: 'neutral' },
    ],
  },
  documents: layout([
    ['Pending review', 'warning'], ['Missing documents', 'orange'], ['Changes requested', 'danger'], ['Approved', 'success'],
  ], { title: (row) => row.displayId, subtitle: (row) => row.company || '—', route: (row) => route(row.job.route), footer: ['jobType', (row) => row.updatedAt ? `Updated ${new Date(row.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : null] }, 'No jobs'),
  drivers: layout([
    ['Active', 'success'], ['On Trip', 'info'], ['Inactive', 'neutral'], ['Pending Profile', 'warning'], ['Pending Review', 'warning'], ['Rejected', 'danger'],
  ], { title: (row) => row.name, value: (row) => row.rating == null ? '' : `★ ${row.rating.toFixed(1)}`, subtitle: 'company', body: ['truckPlate'], footer: [(row) => `License: ${row.licenseState?.label ?? '—'}`] }, 'No drivers'),
  companies: layout([
    ['Active', 'success'], ['Inactive', 'neutral'], ['Pending Review', 'warning'], ['Suspended', 'danger'], ['Rejected', 'danger'],
  ], { title: (row) => row.name, value: (row) => row.trucks == null ? '—' : `${row.trucks} trucks`, subtitle: 'location', body: ['contact'], footer: ['verification', 'joined'] }, 'No companies'),
  forwarders: layout([
    ['Active', 'success'], ['Pending', 'warning'], ['Suspended', 'danger'], ['Inactive', 'neutral'], ['Banned', 'danger'],
  ], { title: (row) => row.name, subtitle: 'location', body: ['email'], footer: ['verification', 'joined'] }, 'No forwarders'),
  payouts: layout([
    ['Pending Review', 'warning'], ['Approved', 'success'], ['Rejected', 'danger'], ['Processing', 'info'], ['Completed', 'success'],
  ], {
    title: (row) => row.party, value: (row) => naira(row.netAmount), subtitle: (row) => row.id,
    body: [
      { icon: 'briefcase', value: (row) => row.jobId || null },
      { icon: 'route', value: (row) => row.route || null },
      { icon: 'truck', value: (row) => row.truckTripCount == null ? null : `${row.truckTripCount} trip${row.truckTripCount === 1 ? '' : 's'}` },
    ],
    footer: ['type', (row) => [row.dateRequested, row.dateRequestedTime].filter(Boolean).join(' · ') || null],
  }, 'No payouts'),
  settlements: layout([
    ['Pending', 'warning'], ['On Hold', 'info'], ['Completed', 'success'], ['Failed', 'danger'],
  ], { title: 'id', value: 'amount', subtitle: 'payee', body: ['relatedTo'], footer: ['type', 'settledOn'] }, 'No settlements'),
  escrow: layout([
    ['Locked', 'warning'], ['Mobilization Released', 'info'], ['Held', 'warning'], ['Disputed', 'danger'], ['Completed', 'success'], ['Refunded', 'orange'], ['Cancelled', 'neutral'],
  ], { title: 'jobId', value: (row) => { const amount = row.kind === 'Hold' ? row.total : row.amount; return amount == null ? '—' : '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 2 }); },
    subtitle: (row) => row.kind === 'Hold' ? row.customer : row.releasedTo, body: [(row) => row.kind === 'Hold' ? 'Hold' : row.releaseType], footer: [(row) => row.kind === 'Hold' ? row.heldOn : row.releasedOn] }, 'No escrow records'),
  transactions: layout([
    ['Pending', 'warning'], ['Completed', 'success'], ['Failed', 'danger'], ['Reversed', 'orange'],
  ], { title: 'id', value: 'amount', subtitle: 'party', body: ['description'], footer: ['type', 'date'] }, 'No transactions'),
  demurrage: layout([
    ['Active', 'danger'], ['Upcoming', 'warning'], ['Resolved', 'success'], ['Dispute', 'purple'], ['Waived', 'neutral'], ['Assessed', 'warning'], ['Applied', 'success'],
  ], { title: 'jobId', value: (row) => row.amount == null ? '—' : '₦' + row.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 }),
    subtitle: (row) => row.customer || row.trucker, body: ['kind'], footer: ['date', (row) => row.daysOver == null ? '' : row.daysOver + ' days over'] }, 'No demurrage'),
  verification: layout([
    ['Pending', 'warning'], ['In Review', 'info'], ['Verified', 'success'], ['Rejected', 'danger'],
  ], { title: 'id', subtitle: 'entity', body: ['type'], footer: ['entityType', 'riskLevel'] }, 'No verifications'),
  users: layout([
    ['Active', 'success'], ['Inactive', 'neutral'], ['Locked', 'danger'], ['Revoked', 'warning'],
  ], { title: (row) => row.name, subtitle: (row) => row.email, body: ['lastActive'], footer: ['role', 'joinedOn'] }, 'No users'),
  tickets: layout([
    ['Open', 'info'], ['In Progress', 'purple'], ['Pending', 'warning'], ['Escalated', 'danger'], ['Resolved', 'success'], ['Closed', 'neutral'],
  ], { title: (row) => row.subject, subtitle: (row) => `${row.id} · ${row.customer}`,  body: ['updated'], footer: ['category', 'priority'] }, 'No tickets'),
  knowledge: layout([
    ['Published', 'success'], ['Draft', 'warning'], ['Archived', 'neutral'],
  ], { title: (row) => row.title, subtitle: 'author', body: ['updated'], footer: ['category', 'helpful'] }, 'No articles'),
  announcements: layout([
    ['Published', 'info'], ['Scheduled', 'info'], ['Draft', 'neutral'], ['Expired', 'danger'],
  ], { title: (row) => row.t, subtitle: 'aud', body: ['d'], footer: ['type', 'v'] }, 'No announcements'),
  feedback: layout([
    ['Open', 'info'], ['In Progress', 'purple'], ['Resolved', 'success'], ['Spam', 'neutral'],
  ], { title: (row) => row.title, subtitle: 'user', body: [(row) => row.excerpt, 'date'], footer: ['type', 'channel'] }, 'No feedback'),
  maintenance: layout([
    ['Requested', 'info'], ['Scheduled', 'info'], ['In Progress', 'warning'], ['Awaiting Verification', 'orange'], ['Overdue', 'danger'], ['Completed', 'success'], ['Verified', 'success'], ['Rejected', 'danger'], ['Cancelled', 'neutral'],
  ], { title: 'id', subtitle: 'company', body: ['description', 'plate'], footer: ['type', 'priority'] }, 'No maintenance'),
  audit: layout([
    ['Success', 'success'], ['Failed', 'danger'],
  ], { title: 'reference', subtitle: 'user', body: ['description'], footer: ['action', 'date'] }, 'No audit logs'),
};
