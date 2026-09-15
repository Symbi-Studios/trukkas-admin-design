import { NAV } from './nav.js';
import { announcements } from './mock/fixtures/announcements.js';
import { companies } from './mock/fixtures/companies.js';
import { demurrageRecords } from './mock/fixtures/demurrage.js';
import { documents } from './mock/fixtures/documents.js';
import { drivers } from './mock/fixtures/drivers.js';
import { escrowHolds } from './mock/fixtures/escrow.js';
import { feedback } from './mock/fixtures/feedback.js';
import { feeRules } from './mock/fixtures/fees.js';
import { jobs } from './mock/fixtures/jobs.js';
import { maintenanceRecords } from './mock/fixtures/maintenance.js';
import { notifications } from './mock/fixtures/notifications.js';
import { payoutRequests } from './mock/fixtures/payouts.js';
import { servicePricing } from './mock/fixtures/pricing.js';
import { settlements } from './mock/fixtures/settlements.js';
import { knowledgeArticles, supportTickets } from './mock/fixtures/support.js';
import { transactionRows } from './mock/fixtures/transactions.js';
import { triangulationOpportunities } from './mock/fixtures/triangulationOpportunities.js';
import { trucks } from './mock/fixtures/trucks.js';
import { users } from './mock/fixtures/users.js';
import { verifications } from './mock/fixtures/verifications.js';

const routeValues = {
  screen: [...NAV.flatMap((group) => group.items.map((item) => item.id)), 'profile', 'signed-out'],
  announcementId: announcements.map((item) => item.id),
  companyId: companies.map((item) => item.id),
  forwarderId: companies.map((item) => item.id),
  demurrageId: demurrageRecords.map((item) => item.id),
  documentId: documents.map((item) => item.id),
  driverId: drivers.map((item) => item.id),
  holdId: escrowHolds.map((item) => item.holdId),
  feedbackId: feedback.map((item) => item.id),
  ruleId: feeRules.map((item) => item.id),
  plate: trucks.map((item) => item.plate),
  jobId: jobs.map((item) => item.id),
  articleId: knowledgeArticles.map((item) => item.id),
  maintenanceId: maintenanceRecords.map((item) => item.id),
  notificationId: notifications.map((item) => item.id),
  payoutId: payoutRequests.map((item) => item.id),
  priceId: servicePricing.map((item) => item.id),
  settlementId: settlements.map((item) => item.id),
  ticketId: supportTickets.map((item) => item.id),
  transactionId: transactionRows.map((item) => item.id),
  matchId: triangulationOpportunities.map((item) => item.id),
  userId: users.map((item) => item.id),
  verificationId: verifications.map((item) => item.id),
};

export function staticParamsFor(key) {
  return [...new Set(routeValues[key] || [])].map((value) => ({ [key]: String(value) }));
}
