import React from 'react';

/** Neutral badge for a value the API didn't return (instead of a bare "—"). */
export function NotAvailable({ label = 'Not available', style }) {
  return <span className="tk-na" style={style}>{label}</span>;
}

/** True for values that should show as "Not available": null, undefined, '', '—', '-'. */
export function isMissing(value) {
  return value == null || (typeof value === 'string' && ['', '—', '-', '–'].includes(value.trim()));
}

/** Render `value`, or the Not available badge when it's missing. */
export function orNA(value, label) {
  return isMissing(value) ? <NotAvailable label={label} /> : value;
}
