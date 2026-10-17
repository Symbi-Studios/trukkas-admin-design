const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const amount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const ids = value => Array.isArray(value) && value.every(id => text(id) && text(id) === id) && new Set(value).size === value.length ? value : null;
const close = (left, right) => Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 0.01;

// The API's tripIds identify JobContainers (the /trips resource). The separate
// truckTripsIncluded counts jobs/truck assignments; never derive it from containers.
export function payoutAllocationContext(dto = {}) {
  const allocations = Array.isArray(dto.allocations) && dto.allocations.every(row => text(row?.jobId) && amount(row.amount) != null)
    ? dto.allocations.map((row, index) => ({ key: row.jobId + ':' + index, jobId: row.jobId, jobNumber: text(row.jobNumber), amount: row.amount,
      tripIds: ids(row.tripIds), containerCount: count(row.trips) })) : null;
  const jobs = allocations ? new Map(allocations.map(row => [row.jobId, row.jobNumber || row.jobId])) : null;
  const reportedTrips = ids(dto.tripIds), truckTrips = count(dto.truckTripsIncluded);
  const truckTripCount = truckTrips != null && (!jobs || truckTrips === jobs.size) ? truckTrips : null;
  const allocated = amount(dto.allocatedAmount), unallocated = amount(dto.unallocatedAmount), gross = amount(dto.grossAmount);
  const verifiedAmounts = dto.currency === 'NGN' && dto.allocationMethod === 'FIFO' && allocations != null && allocated != null && unallocated != null && gross != null
    && close(allocations.reduce((sum, row) => sum + row.amount, 0), allocated) && close(allocated + unallocated, gross);
  const noMoneyMoved = ['REJECTED', 'FAILED', 'REVERSED'].includes(dto.payoutStatus) || dto.reviewStatus === 'REJECTED';
  const balanced = verifiedAmounts && !noMoneyMoved && typeof dto.balanced === 'boolean' && dto.balanced === (unallocated === 0) ? dto.balanced : null;
  return { allocations: dto.currency === 'NGN' && dto.allocationMethod === 'FIFO' ? allocations : null, tripIds: reportedTrips, truckTripCount,
    jobIds: jobs ? [...jobs.keys()] : null, jobLabel: jobs?.size ? [...jobs.values()].join(', ') : '—', jobId: jobs?.size === 1 ? [...jobs.keys()][0] : null,
    reconciliation: { ok: balanced } };
}
