// Shared navigation model. `id` doubles as the route path segment.
export const NAV = [
  {
    section: "Overview",
    items: [{ id: "dashboard", icon: "layout-dashboard", label: "Dashboard" }],
  },
  {
    section: "Operations",
    items: [
      { id: "jobs", icon: "package", label: "Jobs" },
      { id: "trips", icon: "route", label: "Trips" },
      { id: "bids", icon: "radio-tower", label: "Bids & Offers" },
      { id: "documents", icon: "file-text", label: "Documents" },
      // { id: "triangulation", icon: "boxes", label: "Container Triangulation" },
    ],
  },
  {
    section: "Fleet",
    items: [
      // { id: "fleet", icon: "truck", label: "Fleet Management" },
      { id: "maintenance", icon: "settings", label: "Fleet Maintenance" },
      { id: "drivers", icon: "user", label: "Drivers" },
      { id: "companies", icon: "building-2", label: "Truck Companies" },
    ],
  },
  // { section: 'Cargo', items: [
  //   { id: 'cargo', icon: 'container', label: 'Cargo Management' },
  //   { id: 'cargo-types', icon: 'boxes', label: 'Cargo Types' },
  //   { id: 'calculator', icon: 'calculator', label: 'Truck Calculator' },
  // ] },
  {
    section: "Partners",
    items: [
      { id: "forwarders", icon: "users", label: "Forwarders" },
      // { id: 'exporters', icon: 'briefcase', label: 'Exporters' },
    ],
  },
  {
    section: "Finance",
    items: [
      // Ordered along the money flow: held → released → withdrawn → ledger,
      // then charges, then the pages that configure prices and rates.
      { id: "wallets", icon: "lock", label: "Escrow" },
      { id: "payouts", icon: "banknote", label: "Payouts" },
      { id: "transactions", icon: "receipt", label: "Transactions" },
      { id: "demurrage", icon: "hourglass", label: "Demurrage" },
      { id: "pricing", icon: "tag", label: "Pricing" },
      { id: "revenue", icon: "chart-line", label: "Platform Revenue" },
      { id: "rates", icon: "sliders-horizontal", label: "Platform Rates" },
    ],
  },
  {
    section: "Compliance",
    items: [
      { id: "verification", icon: "shield-check", label: "Verification" },
      { id: "audit", icon: "scroll-text", label: "Audit Logs" },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { id: "reports", icon: "chart-column", label: "Reports & Analytics" },
    ],
  },
  {
    section: "Administration",
    items: [
      { id: "users", icon: "users-round", label: "User Management" },
      { id: "roles", icon: "key-round", label: "Roles & Permissions" },
      { id: "settings", icon: "settings", label: "System Settings" },
    ],
  },
  {
    section: "Support System",
    items: [
      { id: "tickets", icon: "ticket", label: "Support Tickets" },
      { id: "knowledge-base", icon: "book-open", label: "Knowledge Base" },
      { id: "faq", icon: "circle-help", label: "FAQ" },
      { id: "announcements", icon: "megaphone", label: "Announcements" },
      { id: "feedback", icon: "message-square", label: "Feedback" },
      { id: "notifications", icon: "bell", label: "Notification Center" },
    ],
  },
];

export const SEARCH_PLACEHOLDER = {
  dashboard: "Search jobs, trucks, companies, exporters...",
  jobs: "Search jobs, routes, cargo, companies...",
  trips: "Search by Trip ID, Job ID, Container, Truck, Driver...",
  bids: "Search by Job ID, Trip ID, Company, Truck, Driver...",
  dispatch: "Search jobs awaiting dispatch...",
  triangulation: "Search containers, jobs, terminals...",
  fleet: "Search trucks, drivers, routes, or locations...",
  maintenance: "Search maintenance, trucks, service centers...",
  drivers: "Search drivers by name, license, phone...",
  companies: "Search jobs, trucks, companies, exporters...",
  cargo: "Search cargo records, jobs, containers...",
  "cargo-types": "Search cargo types...",
  calculator: "Search saved calculations...",
  forwarders: "Search forwarders, RC number, email...",
  exporters: "Search exporters, RC number, email...",
  pricing: "Search by service, route, truck type, location...",
  wallets: "Search by job ID, Trip ID, customer, truck, or reference...",
  payouts: "Search payouts, recipients, references...",
  demurrage: "Search by job ID, container number, customer...",
  transactions: "Search transactions, references, users...",
  revenue: "Search fees collected...",
  rates: "Search platform rates...",
  documents: "Search jobs, documents, companies, routes...",
  verification: "Search forwarders, exporters, RC number, email...",
  audit: "Search audit log by user, action, entity...",
  reports: "Search reports and saved analyses...",
  users: "Search admin users by name or email...",
  roles: "Search roles and permissions...",
  settings: "Search settings...",
  tickets: "Search tickets, customers, subjects...",
  "knowledge-base": "Search knowledge base articles...",
  faq: "Search FAQ...",
  announcements: "Search tickets, articles, announcements...",
  feedback: "Search feedback submissions...",
  notifications: "Search notifications...",
  profile: "Search settings and activity...",
};
