'use client';

import { Dashboard } from './screens/Dashboard.jsx';
import { FleetManagement } from './screens/FleetManagement.jsx';
import { Verification } from './screens/Verification.jsx';
import { Wallets } from './screens/Wallets.jsx';
import { Announcements } from './screens/Announcements.jsx';
import { JobsTrips } from './screens/JobsTrips.jsx';
import { TripsSegments } from './screens/TripsSegments.jsx';
import { BidsOffers } from './screens/BidsOffers.jsx';
import { DispatchCenter } from './screens/DispatchCenter.jsx';
import { LiveTracking } from './screens/LiveTracking.jsx';
import { Documents } from './screens/Documents.jsx';
import { ContainerTriangulation } from './screens/ContainerTriangulation.jsx';
import { Drivers } from './screens/Drivers.jsx';
import { TruckCompanies } from './screens/TruckCompanies.jsx';
import { Forwarders } from './screens/Forwarders.jsx';
import { CargoManagement } from './screens/CargoManagement.jsx';
import { CargoTypes } from './screens/CargoTypes.jsx';
import { TruckCalculator } from './screens/TruckCalculator.jsx';
import { FeesCommission } from './screens/FeesCommission.jsx';
import { PricingManagement } from './screens/PricingManagement.jsx';
import { Settlements } from './screens/Settlements.jsx';
import { Transactions } from './screens/Transactions.jsx';
import { RequestedPayouts } from './screens/RequestedPayouts.jsx';
import { ReportsAnalytics } from './screens/ReportsAnalytics.jsx';
import { UserManagement } from './screens/UserManagement.jsx';
import { RolesPermissions } from './screens/RolesPermissions.jsx';
import { SupportTickets } from './screens/SupportTickets.jsx';
import { KnowledgeBase } from './screens/KnowledgeBase.jsx';
import { Feedback } from './screens/Feedback.jsx';
import { Demurrage } from './screens/Demurrage.jsx';
import { Maintenance } from './screens/Maintenance.jsx';
import { NotificationCenter } from './screens/NotificationCenter.jsx';
import { AuditLogs } from './screens/AuditLogs.jsx';
import { SystemSettings } from './screens/SystemSettings.jsx';
import { FAQ } from './screens/FAQ.jsx';
import { ScreenPlaceholder } from './screens/ScreenPlaceholder.jsx';
import { NAV } from './nav.js';

const screens = {
  dashboard: Dashboard,
  fleet: FleetManagement,
  verification: Verification,
  wallets: Wallets,
  pricing: PricingManagement,
  settlements: Settlements,
  transactions: Transactions,
  payouts: RequestedPayouts,
  reports: ReportsAnalytics,
  fees: FeesCommission,
  announcements: Announcements,
  jobs: JobsTrips,
  trips: TripsSegments,
  bids: BidsOffers,
  dispatch: DispatchCenter,
  tracking: LiveTracking,
  documents: Documents,
  triangulation: ContainerTriangulation,
  drivers: Drivers,
  companies: TruckCompanies,
  forwarders: Forwarders,
  cargo: CargoManagement,
  'cargo-types': CargoTypes,
  calculator: TruckCalculator,
  users: UserManagement,
  roles: RolesPermissions,
  tickets: SupportTickets,
  'knowledge-base': KnowledgeBase,
  feedback: Feedback,
  demurrage: Demurrage,
  maintenance: Maintenance,
  notifications: NotificationCenter,
  audit: AuditLogs,
  settings: SystemSettings,
  faq: FAQ,
};

export function ScreenRouter({ screen }) {
  const Screen = screens[screen];
  if (Screen) return <Screen />;
  const item = NAV.flatMap((group) => group.items).find((entry) => entry.id === screen);
  return <ScreenPlaceholder label={item?.label || screen} />;
}
