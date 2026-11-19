'use client';

import { useEffect, useRef, useState } from 'react';
import { DropdownMenu, FilterSelect } from '../ds.js';

// The Jobs & Trips table filter: a rounded chip ("Status: Pending ×") that opens a menu.
// `options` are strings or { value, label }. The chip is active when value !== allValue,
// and its × resets it to allValue.
export function FilterChip({ name, icon, value, allValue, options, onChange, menuWidth = 216 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const items = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
  const current = items.find((item) => item.value === value);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', minWidth: 0 }}>
      <FilterSelect
        icon={icon}
        prefix={name}
        label={current?.label ?? value}
        active={value !== allValue}
        onClick={() => setOpen((next) => !next)}
        onClear={() => { onChange(allValue); setOpen(false); }}
      />
      {open && (
        <span style={{ position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 50 }}>
          <DropdownMenu
            width={menuWidth}
            style={{ maxHeight: 320, overflowY: 'auto' }}
            items={items.map((item) => ({
              label: item.label,
              icon: item.value === value ? 'check' : undefined,
              onClick: () => { onChange(item.value); setOpen(false); },
            }))}
          />
        </span>
      )}
    </span>
  );
}

// Date chip presets shared by the finance tables. Days are Lagos calendar days (YYYY-MM-DD).
export const DATE_PRESETS = ['All Dates', 'Today', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month'];

const lagosDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export function datePresetRange(preset, now = new Date()) {
  const today = new Date(lagosDay(now) + 'T00:00:00Z');
  const day = (offset, base = today) => { const date = new Date(base); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); };
  const monthStart = (monthOffset) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, 1));
  switch (preset) {
    case 'Today': return { from: day(0), to: day(0) };
    case 'Last 7 Days': return { from: day(-6), to: day(0) };
    case 'Last 30 Days': return { from: day(-29), to: day(0) };
    case 'This Month': return { from: monthStart(0).toISOString().slice(0, 10), to: day(-1, monthStart(1)) };
    case 'Last Month': return { from: monthStart(-1).toISOString().slice(0, 10), to: day(-1, monthStart(0)) };
    default: return { from: '', to: '' };
  }
}
