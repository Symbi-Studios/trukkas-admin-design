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

/** Short money for stat cards: ₦850, ₦750k, ₦750.6k, ₦1.53m, ₦1.2b. Pair with the full amount in a tooltip. */
export function formatNairaShort(value) {
  const n = Number(value);
  if (value == null || value === '' || typeof value === 'boolean' || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const units = [[1e3, 'k'], [1e6, 'm'], [1e9, 'b'], [1e12, 't']];
  for (let i = units.length - 1; i >= 0; i -= 1) {
    const [size, suffix] = units[i];
    if (abs < size) continue;
    // Thousands keep one decimal (₦530.7k); millions and up keep two (₦1.53m).
    const places = size === 1e3 ? 10 : 100;
    const rounded = Math.round((abs / size) * places) / places;
    // 999,960 rounds to "1000k"; show it as the next unit up instead.
    if (rounded >= 1000 && units[i + 1]) return `${sign}₦1${units[i + 1][1]}`;
    return `${sign}₦${String(rounded)}${suffix}`;
  }
  return `${sign}₦${abs.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

/**
 * Parses a formatted naira string back to a number; null when it isn't one.
 * Accepts the sign before or after the symbol and any spacing: "₦750,600.00", "-₦1,200", "₦-1,200",
 * "−₦ 1,200", "+₦50", "NGN 1,200.50".
 */
export function parseNairaText(text) {
  if (typeof text !== 'string') return null;
  const clean = text.replace(/[\s\u00a0\u202f]/g, '').replace(/\u2212/g, '-');
  const match = clean.match(/^([+-])?(?:₦|NGN)([+-])?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/i);
  if (!match || (match[1] && match[2])) return null;
  const n = Number(match[3].replace(/,/g, '') + (match[4] || ''));
  return Number.isFinite(n) ? ((match[1] || match[2]) === '-' ? -n : n) : null;
}
