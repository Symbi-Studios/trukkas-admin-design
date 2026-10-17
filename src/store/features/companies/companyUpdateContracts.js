const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const amount = value => number(value) != null && value >= 0 ? value : null;
const close = (left, right) => Math.abs(left - right) <= 0.01;

export function companyCardComparison(raw, current, validDate) {
  const previous = amount(raw?.previous), change = number(raw?.changePercent);
  const direction = change === 0 ? 'FLAT' : change > 0 ? 'UP' : 'DOWN';
  const known = amount(current) != null && raw?.current === current && previous != null && previous > 0 && change != null
    && raw.direction === direction && text(raw.basis) && raw.basis !== 'NO_SNAPSHOT_YET' && validDate(raw.previousAsOf);
  return { delta: known ? (change > 0 ? '+' : '') + change.toLocaleString('en-NG', { maximumFractionDigits: 2 }) + '%' : '—',
    direction: known && change !== 0 ? direction.toLowerCase() : null };
}

export function companyPerformancePage(dto, page, limit) {
  const pagination = dto?.pagination;
  if (!Array.isArray(dto?.rankings) || count(pagination?.page) !== page || pagination?.limit !== limit
    || count(pagination.total) == null || count(pagination.totalPages) == null
    || pagination.totalPages !== Math.ceil(pagination.total / limit) && !(pagination.total === 0 && pagination.totalPages === 1)
    || dto.rankings.length !== Math.min(limit, Math.max(0, pagination.total - (page - 1) * limit))) throw new Error('The company performance response is missing the requested rankings or pagination.');
  const rows = dto.rankings.map(row => {
    const id = text(row?.companyId), rank = count(row?.rank), score = number(row?.performanceScore);
    if (!id || !rank) throw new Error('The performance ranking contains missing company IDs or ranks.');
    return { id, rank, name: text(row.name) || '—', performance: score != null && score >= 0 && score <= 100 ? score : null };
  });
  if (new Set(rows.map(row => row.id)).size !== rows.length || rows.some((row, index) => index > 0 && row.rank < rows[index - 1].rank)) throw new Error('The company performance rankings contain duplicate companies or invalid ordering.');
  return { rows, total: pagination.total, totalPages: Math.max(1, pagination.totalPages) };
}

export function companyPayoutAllocation(dto) {
  const empty = { jobId: '—', jobDatabaseId: null, tripIds: null, tripCount: null, reconciliation: { ok: null } };
  if (dto?.currency !== 'NGN' || dto.allocationMethod !== 'FIFO' || !Array.isArray(dto.allocations)) return empty;
  const allocations = dto.allocations;
  if (allocations.some(row => !text(row?.jobId) || amount(row?.amount) == null)) return empty;
  const allocated = amount(dto.allocatedAmount), unallocated = amount(dto.unallocatedAmount), gross = amount(dto.grossAmount);
  if (allocated == null || unallocated == null || gross == null
    || !close(allocations.reduce((sum, row) => sum + row.amount, 0), allocated) || !close(allocated + unallocated, gross)) return empty;
  const jobs = new Map(allocations.map(row => [row.jobId, text(row.jobNumber) || row.jobId]));
  const tookNoMoney = ['REJECTED', 'FAILED', 'REVERSED'].includes(dto.payoutStatus) || dto.reviewStatus === 'REJECTED';
  const balanced = !tookNoMoney && typeof dto.balanced === 'boolean' && dto.balanced === (unallocated === 0) ? dto.balanced : null;
  const truckTrips = count(dto.truckTripsIncluded);
  return { jobId: jobs.size ? [...jobs.values()].join(', ') : '—', jobDatabaseId: jobs.size === 1 ? [...jobs.keys()][0] : null,
    // Backend defines one truck trip per allocated job; tripIds are container IDs.
    tripIds: null, tripCount: truckTrips != null && truckTrips === jobs.size ? truckTrips : null, reconciliation: { ok: balanced } };
}
