// The admin user lists return `location` as one free-text address (e.g. "12 Wharf Rd, Apapa, Lagos"
// or "Port Harcourt, Rivers State") and have no city field or city filter, so the Location filter
// derives a city from the address here. Returns null when no city can be read safely.
const COUNTRY = /^(nigeria|ng|nga)$/i;
const POSTCODE = /^\d{4,6}$/;
const STATE = /^(.+?)\s+state$/i;
const FCT = /^(fct|federal capital territory)$/i;

export function addressCity(address) {
  if (typeof address !== 'string') return null;
  const parts = address.split(',').map((part) => part.trim().replace(/\s+/g, ' ')).filter((part) => part && part !== '—');
  while (parts.length && (COUNTRY.test(parts.at(-1)) || POSTCODE.test(parts.at(-1)))) parts.pop();
  if (!parts.length) return null;
  const last = parts.at(-1);
  if (FCT.test(last)) return 'Abuja';
  const state = last.match(STATE)?.[1];
  if (state) {
    const previous = parts.at(-2);
    return titleCase(previous && !/\d/.test(previous) ? previous : state);
  }
  return /\d/.test(last) ? null : titleCase(last);
}

const titleCase = (value) => value === value.toLowerCase() ? value.replace(/\b\w/g, (letter) => letter.toUpperCase()) : value;

// Unique city options, compared case-insensitively and sorted alphabetically.
export function cityOptions(rows) {
  const cities = new Map();
  for (const row of rows) if (row?.city && !cities.has(row.city.toLowerCase())) cities.set(row.city.toLowerCase(), row.city);
  return [...cities.values()].sort((a, b) => a.localeCompare(b));
}

export const sameCity = (a, b) => Boolean(a && b) && a.toLowerCase() === b.toLowerCase();
