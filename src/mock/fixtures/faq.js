export const FAQ_CATEGORIES = ['All Categories', 'Getting Started', 'Jobs & Trips', 'Billing & Payments', 'Fleet & Drivers', 'Account & Security'];

export const faqGroups = [
  {
    key: 'Getting Started', icon: 'rocket',
    questions: [
      { q: 'How do I create a new job on Trukkas?', a: 'Go to Jobs & Trips, click "New Job", fill in pickup/drop-off details, cargo type and required truck type, then publish it for bids or assign directly.' },
      { q: 'How do I invite a team member to my company account?', a: 'Open User Management, click "Add New User", enter their email and assign a role — they will receive an invitation email to set up their account.' },
      { q: 'What roles are available for my team?', a: 'Trukkas ships with system roles like Admin, Operations Manager, Dispatcher, Verifier and Viewer, and you can create custom roles under Roles & Permissions.' },
    ],
  },
  {
    key: 'Jobs & Trips', icon: 'package',
    questions: [
      { q: 'How are bids selected for a job?', a: 'You can set a preferred bid selection strategy — lowest valid bid, highest rated driver, fastest response, or manual review — under Operations Settings.' },
      { q: 'Can I re-route a trip that is already in progress?', a: 'Yes — if "Allow trip re-routing" is enabled in Operations Settings, dispatchers can update the route on an active trip from the Dispatch Center.' },
      { q: 'What happens when a job expires without bids?', a: 'Jobs are automatically cancelled after the Default Job Expiry window unless auto-cancel is disabled in Operations Settings.' },
    ],
  },
  {
    key: 'Billing & Payments', icon: 'wallet',
    questions: [
      { q: 'When are funds released from escrow?', a: 'By default, funds are held for the configured Escrow Hold Period and auto-released on proof of delivery, unless manual review is required for high-value jobs.' },
      { q: 'How long do payouts take to process?', a: 'Payout processing time depends on your configured method — instant payouts complete within an hour, while bank transfers may take longer depending on your bank.' },
      { q: 'Where can I download invoices and receipts?', a: 'Invoices and receipts are available under Transactions, and can also be configured to send automatically via email from Finance Settings.' },
    ],
  },
  {
    key: 'Fleet & Drivers', icon: 'truck',
    questions: [
      { q: 'How do I add a new truck to my fleet?', a: 'Go to Fleet Management and click "Add Truck" — asset IDs are generated automatically if auto-numbering is enabled in Fleet Settings.' },
      { q: 'How do maintenance reminders work?', a: "Reminders are sent by email and in-app a configurable number of days before a truck's maintenance, insurance or permit is due, set under Fleet Settings." },
      { q: 'Can customers see which driver is assigned to their job?', a: 'This depends on your Fleet Visibility settings — you can allow or restrict customer visibility into assigned truck and driver details.' },
    ],
  },
  {
    key: 'Account & Security', icon: 'shield-check',
    questions: [
      { q: 'How do I enable two-factor authentication?', a: 'Go to your user profile, open Security, and turn on Two-Factor Authentication — you will be asked to verify a code on your next login.' },
      { q: 'Is my data encrypted?', a: 'Yes — all data in transit uses TLS 1.2+ and sensitive data at rest is encrypted using AES-256, configured under System Settings > Security > Data Protection.' },
      { q: 'How do I request a copy or deletion of my data?', a: 'Under Data Protection settings, admins can enable "Allow users to download their data" and "Allow account deletion" so users can self-serve these requests.' },
    ],
  },
];

export const faqQuickTopics = [
  { icon: 'life-buoy', label: 'Contact Support', hint: 'Reach the Trukkas support team.' },
  { icon: 'book-open', label: 'Visit Knowledge Base', hint: 'Browse detailed guides and articles.' },
  { icon: 'message-square', label: 'Send Feedback', hint: 'Tell us what could be better.' },
  { icon: 'ticket', label: 'View My Tickets', hint: 'Track your support requests.' },
];
