function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return year >= 1000 && month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
export function verificationDateParams(range) {
  if (!validDay(range?.from) || !validDay(range?.to) || range.from > range.to) return null;
  return {
    dateFrom: new Date(range.from + 'T00:00:00.000+01:00').toISOString(),
    dateTo: new Date(range.to + 'T23:59:59.999+01:00').toISOString(),
  };
}
