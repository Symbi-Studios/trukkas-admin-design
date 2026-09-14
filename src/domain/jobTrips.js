const ACTIVE_TRIP_STATUSES = new Set([
  "At Pickup",
  "Departed",
  "In Transit",
  "At Delivery",
  "Returning Container",
]);
const EXCEPTION_TRIP_STATUSES = new Set(["Delayed", "Overdue", "Failed"]);
const COMPLETE_TRIP_STATUSES = new Set(["Delivered", "Completed"]);

export function legacyTripFromJob(job) {
  const truckPlate = job.assignedTruckPlate || job.truckPlate;
  const driverName = job.assignedDriverName || job.driver;
  const tripId = job.trip;
  if (!truckPlate && !driverName && !tripId) return null;
  return {
    id: tripId || `TRIP-${String(job.id || "JOB").replace(/\D/g, "")}-01`,
    jobId: job.id,
    truckingCompany: job.truckingCompany || job.truckCompany || null,
    truckPlate: truckPlate || null,
    driverId: job.assignedDriverId || null,
    driverName: driverName || null,
    driverPhone: job.assignedDriverPhone || null,
    origin: job.origin || null,
    destination: job.destination || null,
    route: job.route || `${job.origin || "—"} → ${job.destination || "—"}`,
    pickupDate: job.pickupDate || null,
    deliveryDate: job.deliveryDate || null,
    eta: job.deliveryDate || job.etaCountdown || null,
    status: job.status === "Delivered" ? "Delivered" : job.status === "Cancelled" ? "Cancelled" : job.status || "Assigned",
    progress: job.status === "Delivered" ? 100 : job.status === "In Transit" ? 60 : 0,
    distanceKm: job.distanceKm || 0,
    currentLocation: job.status === "In Transit" ? "En route" : job.origin || "—",
  };
}

export function getJobTrips(job) {
  if (!job) return [];
  const source = Array.isArray(job.trips)
    ? job.trips
    : [legacyTripFromJob(job)].filter(Boolean);
  return source.map((trip, index) => ({
    jobId: job.id,
    truckingCompany: job.truckingCompany || job.truckCompany || null,
    origin: job.origin || null,
    destination: job.destination || null,
    route: job.route || `${job.origin || "—"} → ${job.destination || "—"}`,
    pickupDate: job.pickupDate || null,
    deliveryDate: job.deliveryDate || null,
    distanceKm: job.distanceKm || 0,
    progress: 0,
    ...trip,
    id: trip.id || `TRIP-${String(job.id || "JOB").replace(/\D/g, "")}-${String(index + 1).padStart(2, "0")}`,
  }));
}

export function getJobTripCounts(job) {
  const trips = getJobTrips(job);
  return {
    required: Math.max(1, Number(job?.requiredTrucks) || 1),
    assigned: trips.filter((trip) => trip.truckPlate && trip.driverName && trip.status !== "Cancelled").length,
    active: trips.filter((trip) => ACTIVE_TRIP_STATUSES.has(trip.status)).length,
    completed: trips.filter((trip) => COMPLETE_TRIP_STATUSES.has(trip.status)).length,
    exceptions: trips.filter((trip) => EXCEPTION_TRIP_STATUSES.has(trip.status)).length,
    total: trips.length,
  };
}

export function deriveJobStatus(job, trips = getJobTrips(job)) {
  if (["Cancelled", "Rejected", "Pending Approval", "Bidding"].includes(job?.status)) return job.status;
  const required = Math.max(1, Number(job?.requiredTrucks) || 1);
  const paired = trips.filter((trip) => trip.truckPlate && trip.driverName);
  if (!paired.length) return job?.truckingCompany ? "Awaiting Assignment" : job?.status || "Open";
  if (paired.every((trip) => trip.status === "Cancelled")) return "Cancelled";
  if (paired.some((trip) => trip.status === "Cancelled")) return "Attention Required";
  const assigned = paired.filter((trip) => trip.status !== "Cancelled");
  if (assigned.some((trip) => EXCEPTION_TRIP_STATUSES.has(trip.status))) return "Attention Required";
  const complete = assigned.filter((trip) => COMPLETE_TRIP_STATUSES.has(trip.status)).length;
  if (assigned.length >= required && complete === assigned.length) return "Delivered";
  if (complete > 0) return "Partially Delivered";
  if (assigned.some((trip) => ACTIVE_TRIP_STATUSES.has(trip.status))) return "In Transit";
  if (assigned.length < required) return "Partially Assigned";
  return "Assigned";
}

export function withJobTrips(job, trips) {
  const normalized = getJobTrips({ ...job, trips });
  const first = normalized[0] || {};
  return {
    ...job,
    trips: normalized,
    status: deriveJobStatus(job, normalized),
    trip: first.id || null,
    truckPlate: first.truckPlate || null,
    driver: first.driverName || null,
    truckCompany: job.truckingCompany || first.truckingCompany || job.truckCompany || null,
    assignedTruckPlate: first.truckPlate || null,
    assignedDriverId: first.driverId || null,
    assignedDriverName: first.driverName || null,
    assignedDriverPhone: first.driverPhone || null,
  };
}

export function normalizeJobTrips(job) {
  return withJobTrips(job, getJobTrips(job));
}

export function validateTripAssignments({ job, assignments, trucks, drivers }) {
  const errors = [];
  const required = Math.max(1, Number(job.requiredTrucks) || 1);
  const existingPlates = new Set(getJobTrips(job).map((trip) => trip.truckPlate).filter(Boolean));
  if (!assignments.length) errors.push("Assign at least one truck and driver.");
  if (assignments.length > required) errors.push(`This job requires ${required} truck${required === 1 ? "" : "s"}.`);
  const plates = assignments.map((item) => item.truckPlate);
  const driverIds = assignments.map((item) => item.driverId);
  if (new Set(plates).size !== plates.length) errors.push("A truck can only be assigned once per job.");
  if (new Set(driverIds).size !== driverIds.length) errors.push("A driver can only be assigned once per job.");
  const selectedTrucks = assignments.map((item) => trucks.find((truck) => truck.plate === item.truckPlate)).filter(Boolean);
  const companies = new Set(selectedTrucks.map((truck) => truck.company));
  if (companies.size > 1) errors.push("All trucks must belong to the same trucking company.");
  const company = job.truckingCompany || selectedTrucks[0]?.company;
  if (job.truckingCompany && selectedTrucks.some((truck) => truck.company !== job.truckingCompany)) errors.push(`All trucks must belong to ${job.truckingCompany}.`);
  assignments.forEach((item, index) => {
    const truck = trucks.find((candidate) => candidate.plate === item.truckPlate);
    const driver = drivers.find((candidate) => candidate.id === item.driverId);
    if (!truck) errors.push(`Assignment ${index + 1} needs a valid truck.`);
    if (!driver) errors.push(`Assignment ${index + 1} needs a valid driver.`);
    if (truck && truck.status !== "Available" && !existingPlates.has(truck.plate)) errors.push(`${truck.plate} is not currently available.`);
    if (truck && driver && driver.company !== company && driver.truckPlate !== truck.plate && truck.dr !== driver.id) errors.push(`${driver.name} is not registered with ${company}.`);
  });
  return { valid: errors.length === 0, errors, company };
}
