const timeZone = 'Africa/Lagos';
function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year,month,day] = value.split('-').map(Number);
  return year >= 1000 && month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year,month,0)).getUTCDate();
}
export function settlementDateParams(range) {
  if (!validDay(range?.from) || !validDay(range?.to) || range.from > range.to) return null;
  // Include both selected calendar dates in Lagos (UTC+01:00).
  return {
    dateFrom:new Date(range.from+'T00:00:00.000+01:00').toISOString(),
    dateTo:new Date(range.to+'T23:59:59.999+01:00').toISOString(),
  };
}
export function defaultSettlementDates() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part => [part.type,part.value]));
  const to = parts.year+'-'+parts.month+'-'+parts.day;
  const start = new Date(to+'T12:00:00.000Z');
  start.setUTCDate(start.getUTCDate()-29);
  return { from:start.toISOString().slice(0,10),to };
}
export function settlementDateLabel(range) {
  if (!settlementDateParams(range)) return '—';
  const format = value => new Intl.DateTimeFormat('en-GB',{timeZone,day:'numeric',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00.000+01:00'));
  return format(range.from)+' – '+format(range.to);
}
