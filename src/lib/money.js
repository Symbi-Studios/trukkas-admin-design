export function hasKoboPrecision(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const text = String(value).trim();
  return /^-?\d+(?:\.\d{1,2})?$/.test(text) && Number.isFinite(Number(text));
}

export function formatNairaAmount(value) {
  if (!(typeof value === 'number' || typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) || !Number.isFinite(Number(value))) return '—';
  const amount = Number(value);
  return (amount < 0 ? '-' : '') + '₦' + Math.abs(amount).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
