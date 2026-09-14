import { getJobTrips } from "./jobTrips.js";

const COMPLETE_TRIP_STATUSES = new Set(["Delivered", "Completed"]);
const PAID_PAYOUT_STATUSES = new Set(["Completed"]);
const OPEN_PAYOUT_STATUSES = new Set(["Pending Review", "Approved", "Processing"]);

const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);

export function getPayoutTripIds(payout) {
  if (Array.isArray(payout?.allocations) && payout.allocations.length) {
    return [...new Set(payout.allocations.map((item) => item.tripId).filter(Boolean))];
  }
  if (Array.isArray(payout?.tripIds) && payout.tripIds.length) {
    return [...new Set(payout.tripIds.filter(Boolean))];
  }
  const legacy = payout?.job?.tripId;
  return legacy && legacy !== "—" ? [legacy] : [];
}

export function normalizePayout(payout, jobs = [], allPayouts = []) {
  const jobIds = [...new Set([...(payout.jobIds || []), payout.jobId].filter(Boolean))];
  const linkedJobs = jobIds.map((id) => jobs.find((job) => job.id === id)).filter(Boolean);
  const linkedTrips = linkedJobs.flatMap((job) => getJobTrips(job));
  const knownTrips = new Map(linkedTrips.map((trip) => [trip.id, trip]));
  const requestedTripIds = getPayoutTripIds(payout);
  const legacyTripReference = requestedTripIds.length > 0 && requestedTripIds.every((id) => !knownTrips.has(id));
  const allocations = Array.isArray(payout.allocations) && payout.allocations.length
    ? payout.allocations.map((allocation) => ({
        amount: 0,
        jobId: payout.jobId,
        ...allocation,
        trip: knownTrips.get(allocation.tripId) || null,
      }))
    : requestedTripIds.map((tripId) => ({
        tripId,
        jobId: payout.jobId,
        amount: requestedTripIds.length === 1 ? Number(payout.amount || 0) : 0,
        trip: knownTrips.get(tripId) || null,
      }));

  const breakdown = payout.breakdown || [];
  const grossLine = breakdown.find((item) => /gross/i.test(item.label));
  const grossAmount = Number(payout.grossAmount ?? grossLine?.value ?? payout.amount ?? 0);
  const deductions = sum(breakdown.filter((item) => Number(item.value) < 0).map((item) => Math.abs(item.value)));
  const positiveAdjustments = sum(breakdown.filter((item) => Number(item.value) > 0 && item !== grossLine).map((item) => item.value));
  const netFromBreakdown = sum(breakdown.map((item) => item.value));
  const allocationTotal = allocations.length ? sum(allocations.map((item) => item.amount)) : grossAmount;

  const issues = [];
  if (Math.abs(netFromBreakdown - Number(payout.amount || 0)) > 1) issues.push("Breakdown does not reconcile to the net payout.");
  if (allocations.length && !legacyTripReference && Math.abs(allocationTotal - grossAmount) > 1) issues.push("Trip allocations do not reconcile to the gross amount.");
  if (requestedTripIds.length !== new Set(requestedTripIds).size) issues.push("A trip is included more than once.");

  const companyName = payout.companyName || (payout.partyType === "company" ? payout.party : null);
  if (payout.partyType === "company" && linkedJobs.some((job) => {
    const owner = job.truckingCompany || job.truckCompany;
    return owner && companyName && owner !== companyName;
  })) issues.push("Payout company does not match the trucking company assigned to the job.");

  const duplicateTripIds = requestedTripIds.filter((tripId) =>
    allPayouts.some((other) =>
      other.id !== payout.id &&
      other.partyType === "company" &&
      other.status !== "Rejected" &&
      getPayoutTripIds(other).includes(tripId),
    ),
  );
  if (duplicateTripIds.length) issues.push(`Already included in another payout: ${duplicateTripIds.join(", ")}.`);

  const eligibleTripIds = requestedTripIds.filter((id) => COMPLETE_TRIP_STATUSES.has(knownTrips.get(id)?.status));
  const unresolvedTripIds = requestedTripIds.filter((id) => !knownTrips.has(id));
  const ineligibleTripIds = requestedTripIds.filter((id) => knownTrips.has(id) && !COMPLETE_TRIP_STATUSES.has(knownTrips.get(id)?.status));
  let eligibility = "Eligible";
  if (payout.partyType === "company") {
    if (!requestedTripIds.length || legacyTripReference) eligibility = "Needs Review";
    else if (!eligibleTripIds.length) eligibility = "Ineligible";
    else if (eligibleTripIds.length !== requestedTripIds.length) eligibility = "Partially Eligible";
  }
  const reconciled = issues.length === 0;
  const approvalReady = payout.partyType !== "company" || (eligibility === "Eligible" && reconciled);

  return {
    ...payout,
    companyId: payout.companyId || (payout.partyType === "company" ? payout.partyId : null),
    companyName,
    jobIds,
    tripIds: requestedTripIds,
    allocations,
    grossAmount,
    deductions,
    adjustments: positiveAdjustments,
    netAmount: Number(payout.amount || 0),
    allocationTotal,
    eligibility,
    eligibleTripIds,
    ineligibleTripIds,
    unresolvedTripIds,
    reconciliation: { ok: reconciled, issues },
    approvalReady,
  };
}

export function normalizePayouts(payouts, jobs = []) {
  return payouts.map((payout) => normalizePayout(payout, jobs, payouts));
}

export function getCompanyPayoutSummary(payouts) {
  const rows = payouts.filter((payout) => payout.partyType === "company");
  return {
    requests: rows.length,
    totalEarned: sum(rows.filter((payout) => payout.status !== "Rejected").map((payout) => payout.netAmount ?? payout.amount)),
    available: sum(rows.filter((payout) => payout.status === "Pending Review" && payout.approvalReady).map((payout) => payout.netAmount ?? payout.amount)),
    pending: sum(rows.filter((payout) => payout.status === "Pending Review").map((payout) => payout.netAmount ?? payout.amount)),
    processing: sum(rows.filter((payout) => ["Approved", "Processing"].includes(payout.status)).map((payout) => payout.netAmount ?? payout.amount)),
    paid: sum(rows.filter((payout) => PAID_PAYOUT_STATUSES.has(payout.status)).map((payout) => payout.netAmount ?? payout.amount)),
    held: sum(rows.filter((payout) => OPEN_PAYOUT_STATUSES.has(payout.status) && !payout.approvalReady).map((payout) => payout.netAmount ?? payout.amount)),
  };
}

export function validatePayoutApproval(payout, payouts = [], jobs = []) {
  const normalized = normalizePayout(payout, jobs, payouts);
  if (normalized.partyType === "company" && !normalized.approvalReady) {
    const reasons = [
      normalized.eligibility !== "Eligible" ? `Trip eligibility is ${normalized.eligibility.toLowerCase()}.` : null,
      ...normalized.reconciliation.issues,
    ].filter(Boolean);
    return { valid: false, errors: reasons, payout: normalized };
  }
  return { valid: true, errors: [], payout: normalized };
}
