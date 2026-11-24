"use client";
// App-wide confirmation toast for admin actions: an inverted chip, bottom right.
// Call showToast() from anywhere; <ToastHost /> lives in
// the admin shell. Errors and warnings stay as inline banners on each screen.
import React from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../ds.js';
import './ActionToast.css';

const listeners = new Set();
let nextId = 1;
const MAX_VISIBLE = 3;

/** Show a confirmation toast. tone: 'success' (default) or 'info'. */
export function showToast(message, { tone = 'success', duration = 4200 } = {}) {
  const text = typeof message === 'string' ? message.trim() : message;
  if (!text) return;
  const toast = { id: nextId++, message: text, tone: tone === 'info' || tone === 'neutral' ? 'info' : 'success', duration };
  listeners.forEach((listener) => listener(toast));
}

function ToastItem({ toast, onRemove }) {
  const [leaving, setLeaving] = React.useState(false);
  const leave = React.useCallback(() => setLeaving(true), []);
  return (
    <div
      className={'tk-toast' + (leaving ? ' leaving' : '')}
      data-tone={toast.tone}
      role="status"
      onAnimationEnd={(event) => { if (leaving && event.target === event.currentTarget) onRemove(toast.id); }}
    >
      <span className="tk-toast-icon" aria-hidden="true"><Icon name={toast.tone === 'info' ? 'info' : 'circle-check'} size={16} color="currentColor" /></span>
      <span className="tk-toast-message">{toast.message}</span>
      <button type="button" className="tk-toast-close" aria-label="Dismiss" onClick={leave}><Icon name="x" size={14} color="currentColor" /></button>
      <span className="tk-toast-timer" style={{ animationDuration: toast.duration + 'ms' }} onAnimationEnd={leave} aria-hidden="true" />
    </div>
  );
}

export function ToastHost() {
  const [items, setItems] = React.useState([]);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
    const listener = (toast) => setItems((current) => [toast, ...current.filter((item) => item.message !== toast.message)].slice(0, MAX_VISIBLE));
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  const remove = React.useCallback((id) => setItems((current) => current.filter((item) => item.id !== id)), []);
  if (!mounted) return null;
  return createPortal(
    <div className="tk-toast-stack" aria-live="polite" aria-atomic="false">
      {items.map((toast) => <ToastItem key={toast.id} toast={toast} onRemove={remove} />)}
    </div>,
    document.body,
  );
}

/**
 * Drop-in for a screen's own toast/notice state. Success and info messages go
 * to the global toast and the local state is cleared; danger and warning keep
 * rendering `children` (the screen's existing inline banner).
 */
export function ToastRelay({ message, tone, onShown, children }) {
  const inline = tone === 'danger' || tone === 'warning';
  React.useEffect(() => {
    if (inline || !message) return;
    showToast(message, { tone: tone === 'info' || tone === 'neutral' ? 'info' : 'success' });
    onShown?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, tone, inline]);
  return inline ? children ?? null : null;
}
