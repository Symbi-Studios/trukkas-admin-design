'use client';

import { Suspense } from 'react';
import { Dashboard } from './screens/Dashboard.jsx';
import { FleetManagement } from './screens/FleetManagement.jsx';
import { Verification } from './screens/Verification.jsx';
import { Wallets } from './screens/Wallets.jsx';
import { Announcements } from './screens/Announcements.jsx';
import { JobsTrips } from './screens/JobsTrips.jsx';
import { TripsSegments } from './screens/TripsSegments.jsx';
import { BidsOffers } from './screens/BidsOffers.jsx';
import { DispatchCenter } from './screens/DispatchCenter.jsx';
import { Documents } from './screens/Documents.jsx';
import { ContainerTriangulation } from './screens/ContainerTriangulation.jsx';
import { Drivers } from './screens/Drivers.jsx';
import { TruckCompanies } from './screens/TruckCompanies.jsx';
import { Forwarders } from './screens/Forwarders.jsx';
import { CargoManagement } from './screens/CargoManagement.jsx';
import { CargoTypes } from './screens/CargoTypes.jsx';
import { TruckCalculator } from './screens/TruckCalculator.jsx';
import { PlatformRevenue } from './screens/PlatformRevenue.jsx';
import { FeesRedirect } from './screens/FeeRuleDetail.jsx';
import { PricingManagement } from './screens/PricingManagement.jsx';
import { SettlementsRedirect } from './screens/SettlementDetail.jsx';
import { Transactions } from './screens/Transactions.jsx';
import { RequestedPayouts } from './screens/RequestedPayouts.jsx';
import { ReportsAnalytics } from './screens/ReportsAnalytics.jsx';
import { UserManagement } from './screens/UserManagement.jsx';
import { UsersOverview } from './screens/UsersOverview.jsx';
import { RolesPermissions } from './screens/RolesPermissions.jsx';
import { SupportTickets } from './screens/SupportTickets.jsx';
import { KnowledgeBase } from './screens/KnowledgeBase.jsx';
import { Feedback } from './screens/Feedback.jsx';
import { RatingsReviews } from './screens/RatingsReviews.jsx';
import { FinanceOverview } from './screens/FinanceOverview.jsx';
import { UserWallets } from './screens/UserWallets.jsx';
import { Demurrage } from './screens/Demurrage.jsx';
import { PlatformRates } from './screens/PlatformRates.jsx';
import { Maintenance } from './screens/Maintenance.jsx';
import { NotificationCenter } from './screens/NotificationCenter.jsx';
import { AuditLogs } from './screens/AuditLogs.jsx';
import { SystemSettings } from './screens/SystemSettings.jsx';
import { FAQ } from './screens/FAQ.jsx';
import { AdminProfile } from './screens/AdminProfile.jsx';
import { SignedOut } from './screens/SignedOut.jsx';
import { ScreenPlaceholder } from './screens/ScreenPlaceholder.jsx';
import { NAV } from './nav.js';

const screens = {
  dashboard: Dashboard,
  fleet: FleetManagement,
  verification: Verification,
  wallets: Wallets,
  pricing: PricingManagement,
  settlements: SettlementsRedirect,
  transactions: Transactions,
  payouts: RequestedPayouts,
  reports: ReportsAnalytics,
  fees: FeesRedirect,
  revenue: PlatformRevenue,
  rates: PlatformRates,
  announcements: Announcements,
  jobs: JobsTrips,
  trips: TripsSegments,
  bids: BidsOffers,
  dispatch: DispatchCenter,
  tracking: TripsSegments,
  documents: Documents,
  triangulation: ContainerTriangulation,
  drivers: Drivers,
  companies: TruckCompanies,
  forwarders: Forwarders,
  cargo: CargoManagement,
  'cargo-types': CargoTypes,
  calculator: TruckCalculator,
  users: UserManagement,
  'users-overview': UsersOverview,
  roles: RolesPermissions,
  tickets: SupportTickets,
  'knowledge-base': KnowledgeBase,
  feedback: Feedback,
  reviews: RatingsReviews,
  'finance-overview': FinanceOverview,
  'user-wallets': UserWallets,
  demurrage: Demurrage,
  maintenance: Maintenance,
  notifications: NotificationCenter,
  audit: AuditLogs,
  settings: SystemSettings,
  faq: FAQ,
  profile: AdminProfile,
  'signed-out': SignedOut,
};

export function ScreenRouter({ screen }) {
  const Screen = screens[screen];
  // Every screen can read search params (deep links), which needs a Suspense boundary.
  if (Screen) return <Suspense fallback={null}><Screen /></Suspense>;
  const item = NAV.flatMap((group) => group.items).find((entry) => entry.id === screen);
  return <ScreenPlaceholder label={item?.label || screen} />;
}
