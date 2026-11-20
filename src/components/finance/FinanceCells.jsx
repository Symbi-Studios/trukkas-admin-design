'use client';

import { useState } from 'react';
import { Avatar, Badge, DrawerFacts, Icon, NotAvailable, isMissing } from '../../ds.js';
import './finance.css';

// Shared table cells for the Finance tables, so every table reads the same way.

/** "TRX-8f2a…2159" with the full value on hover and a copy button. `onOpen` makes the text a link. */
export function MiddleId({ value, head = 8, tail = 4, onOpen, label = 'ID' }) {
  const [copied, setCopied] = useState(false);
  if (isMissing(value)) return <NotAvailable />;
  const text = String(value);
  const short = text.length > head + tail + 1 ? `${text.slice(0, head)}…${text.slice(-tail)}` : text;
  const copy = (event) => {
    event.stopPropagation();
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <span className="fin-id">
      {onOpen
        ? <button type="button" className="fin-id-text fin-id-link" title={text} onClick={(event) => { event.stopPropagation(); onOpen(); }}>{short}</button>
        : <span className="fin-id-text" title={text}>{short}</span>}
      <button type="button" className={'fin-id-copy' + (copied ? ' done' : '')} aria-label={`Copy ${label} ${text}`} title={copied ? 'Copied' : `Copy ${label}`} onClick={copy}>
        <Icon name={copied ? 'check' : 'copy'} size={13} />
      </button>
    </span>
  );
}

const ROLES = {
  FORWARDER: ['Forwarder', 'info'], IMPORTER: ['Importer', 'info'], CUSTOMER: ['Customer', 'info'],
  TRUCKER: ['Trucking Company', 'purple'], COMPANY: ['Trucking Company', 'purple'], TRANSPORTER: ['Trucking Company', 'purple'],
  DRIVER: ['Driver', 'teal'], PLATFORM: ['Platform', 'neutral'], ESCROW: ['Escrow', 'warning'], ADMIN: ['Admin', 'neutral'],
  SYSTEM: ['System', 'neutral'], INTERNAL: ['Internal', 'neutral'],
};
/** Normalises API roles ("TRUCKER", "Trucker", "company") to a label and badge tone. */
export function partyRole(role) {
  if (isMissing(role)) return null;
  const key = String(role).trim().toUpperCase().replace(/[\s-]+/g, '_');
  const known = ROLES[key] || ROLES[key.replace(/_PAYOUT$/, '')];
  return known ? { label: known[0], tone: known[1] } : { label: String(role).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), tone: 'neutral' };
}

/** Avatar, name and a role badge underneath. */
export function PartyCell({ name, role, avatarUrl, size = 32 }) {
  if (isMissing(name)) return <NotAvailable />;
  const badge = partyRole(role);
  return (
    <span className="fin-party">
      <Avatar name={String(name)} src={avatarUrl || undefined} size={size} />
      <span className="fin-party-text">
        <strong title={String(name)}>{name}</strong>
        {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
      </span>
    </span>
  );
}

const naira = new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "₦1,250,000.00"; a sign when `signed` and direction is known; Not available otherwise. */
export function formatNaira(value, { signed = false, positive = null } = {}) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const amount = Number(value);
  const sign = signed && positive === true ? '+' : signed && positive === false ? '−' : amount < 0 ? '−' : '';
  return `${sign}₦${naira.format(Math.abs(amount))}`;
}
export function Money({ value, signed = false, positive = null, strong = true }) {
  const text = formatNaira(value, { signed, positive });
  if (text == null) return <NotAvailable />;
  const tone = signed && positive === true ? ' in' : signed && positive === false ? ' out' : '';
  return <span className={'fin-money' + tone + (strong ? ' strong' : '')}>{text}</span>;
}

/** Date with time underneath; Not available when missing. */
export function DateCell({ date, time }) {
  if (isMissing(date)) return <NotAvailable />;
  return <span className="fin-date"><span>{date}</span>{!isMissing(time) && <small>{time}</small>}</span>;
}

/** A value as a badge, or Not applicable / Not available. */
export function BadgeCell({ value, tone, missing = 'Not available' }) {
  return isMissing(value) ? <NotAvailable label={missing} /> : <Badge tone={tone}>{value}</Badge>;
}


/** DrawerFacts with "Not available" in place of missing values and no empty sub-lines. */
export function FinanceFacts({ items }) {
  return <DrawerFacts items={items.map((item) => ({
    ...item,
    value: isMissing(item.value) ? <NotAvailable /> : item.value,
    sub: isMissing(item.sub) ? undefined : item.sub,
  }))} />;
}

/** Timeline steps without "—" placeholders for things that haven't happened yet. */
export const cleanSteps = (steps) => steps.map((step) => ({ ...step, time: isMissing(step.time) ? undefined : step.time, description: isMissing(step.description) ? undefined : step.description }));
