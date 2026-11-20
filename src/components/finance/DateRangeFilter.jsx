'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FilterSelect, Icon } from '../../ds.js';
import './finance.css';

// Date filter chip with a calendar popover: click a start day, then an end day, and the
// range applies. Value is { from, to } as Lagos calendar days (YYYY-MM-DD), or empty strings.

const DAY_MS = 86400000;
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const iso = (date) => date.toISOString().slice(0, 10);
const parse = (value) => (value ? new Date(value + 'T00:00:00Z') : null);
const lagosToday = () => new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) + 'T00:00:00Z');
const monthLabel = (date) => date.toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const shortDay = (value, withYear) => parse(value).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });

export const EMPTY_RANGE = { from: '', to: '' };

export function rangeLabel({ from, to }) {
  if (!from || !to) return 'All dates';
  if (from === to) return shortDay(from, true);
  return `${shortDay(from, from.slice(0, 4) !== to.slice(0, 4))} – ${shortDay(to, true)}`;
}

/** Inclusive Lagos-day bounds as epoch ms, for filtering rows client-side. */
export function rangeBounds({ from, to }) {
  if (!from || !to) return null;
  return { start: Date.parse(`${from}T00:00:00+01:00`), end: Date.parse(`${to}T23:59:59.999+01:00`) };
}
export function inRange(timestamp, range) {
  const bounds = rangeBounds(range);
  if (!bounds) return true;
  const value = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp);
  return Number.isFinite(value) && value >= bounds.start && value <= bounds.end;
}

function shortcuts() {
  const today = lagosToday();
  const shift = (days) => iso(new Date(today.getTime() + days * DAY_MS));
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return [
    { label: 'Today', from: shift(0), to: shift(0) },
    { label: 'Last 7 days', from: shift(-6), to: shift(0) },
    { label: 'Last 30 days', from: shift(-29), to: shift(0) },
    { label: 'This month', from: iso(monthStart), to: shift(0) },
    { label: 'Last month', from: iso(lastMonthStart), to: iso(new Date(monthStart.getTime() - DAY_MS)) },
  ];
}

function Month({ month, start, end, hover, onPick, onHover }) {
  const days = useMemo(() => {
    const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => iso(new Date(first.getTime() + i * DAY_MS)))];
  }, [month]);
  const today = iso(lagosToday());
  const rangeEnd = end || (start && hover && hover >= start ? hover : null);
  return (
    <div className="fin-cal-month">
      <div className="fin-cal-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="fin-cal-grid" onMouseLeave={() => onHover(null)}>
        {days.map((day, index) => {
          if (!day) return <span key={'pad' + index} />;
          const isStart = day === start, isEnd = day === rangeEnd;
          const within = start && rangeEnd && day > start && day < rangeEnd;
          return (
            <button key={day} type="button"
              className={'fin-cal-day' + (isStart || isEnd ? ' edge' : '') + (within ? ' within' : '') + (day === today ? ' today' : '') + (isStart && rangeEnd && rangeEnd !== start ? ' start' : '') + (isEnd && start !== rangeEnd ? ' end' : '')}
              onClick={() => onPick(day)} onMouseEnter={() => onHover(day)}>
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangeFilter({ name = 'Date', value = EMPTY_RANGE, onChange, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(null);
  const [hover, setHover] = useState(null);
  const [month, setMonth] = useState(() => { const base = parse(value.to) || lagosToday(); return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1)); });
  const ref = useRef(null);
  const active = Boolean(value.from && value.to);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const apply = (range) => { onChange(range); setStart(null); setHover(null); setOpen(false); };
  const pick = (day) => {
    if (!start) { setStart(day); return; }
    apply(day < start ? { from: day, to: start } : { from: start, to: day });
  };
  const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const shownStart = start || (active ? value.from : null);
  const shownEnd = start ? null : active ? value.to : null;
  return (
    <span ref={ref} className="fin-range">
      <FilterSelect icon="calendar" prefix={name} label={rangeLabel(value)} active={active}
        onClick={() => { setOpen((current) => !current); setStart(null); }}
        onClear={() => apply(EMPTY_RANGE)} />
      {open && (
        <div className={'fin-cal' + (align === 'right' ? ' right' : '')} role="dialog" aria-label={`Choose ${name.toLowerCase()} range`}>
          <div className="fin-cal-shortcuts">
            {shortcuts().map((item) => (
              <button key={item.label} type="button" className={value.from === item.from && value.to === item.to ? 'active' : undefined} onClick={() => apply({ from: item.from, to: item.to })}>{item.label}</button>
            ))}
            <button type="button" className={!active ? 'active' : undefined} onClick={() => apply(EMPTY_RANGE)}>All dates</button>
          </div>
          <div className="fin-cal-main">
            <div className="fin-cal-head">
              <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))}><Icon name="chevron-left" size={16} /></button>
              <strong>{monthLabel(month)}</strong>
              <strong className="fin-cal-second">{monthLabel(next)}</strong>
              <button type="button" aria-label="Next month" onClick={() => setMonth(next)}><Icon name="chevron-right" size={16} /></button>
            </div>
            <div className="fin-cal-months">
              <Month month={month} start={shownStart} end={shownEnd} hover={hover} onPick={pick} onHover={setHover} />
              <div className="fin-cal-second"><Month month={next} start={shownStart} end={shownEnd} hover={hover} onPick={pick} onHover={setHover} /></div>
            </div>
            <p className="fin-cal-hint">{start ? `From ${shortDay(start, true)} — now pick the end date` : 'Pick a start date, then an end date'}</p>
          </div>
        </div>
      )}
    </span>
  );
}
