'use client';
import React from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../assets/icons/Icon.jsx';
import { AlertSlotContext, InlineAlertContext } from './AlertSlot.jsx';

const TONES = {
  info:    ['var(--tk-info-soft)', 'var(--tk-blue)', 'info'],
  success: ['var(--tk-success-soft)', 'var(--tk-success)', 'circle-check'],
  warning: ['var(--tk-warning-soft)', 'var(--tk-warning)', 'triangle-alert'],
  danger:  ['var(--tk-danger-soft)', 'var(--tk-danger)', 'circle-alert'],
};
const textKey = (value) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/**
 * Explanatory strip. Says what happened, why, and what may be done next.
 * Page-level `danger` and `warning` banners render as a full-width, dismissible
 * bar under the top bar (see AlertSlot); inside modals and drawers, and every
 * other tone, they stay inline.
 */
export function Banner({ tone = 'info', icon, title, children, action, onClose, style }) {
  const slot = React.useContext(AlertSlotContext);
  const inline = React.useContext(InlineAlertContext);
  const [dismissed, setDismissed] = React.useState(false);
  const signature = textKey(title) + '|' + textKey(children);
  React.useEffect(() => { setDismissed(false); }, [signature]);
  const [bg, fg, def] = TONES[tone] || TONES.info;

  if ((tone === 'danger' || tone === 'warning') && slot && !inline) {
    if (dismissed) return null;
    const dismiss = () => { setDismissed(true); onClose?.(); };
    return createPortal(
      <div className={'tk-alert-bar ' + tone} role={tone === 'danger' ? 'alert' : 'status'}>
        <Icon name={icon || def} size={18} color="currentColor" style={{ flex: '0 0 auto' }} />
        <div className="tk-alert-bar-text">
          {title && <strong>{title}</strong>}
          {children && <span>{children}</span>}
        </div>
        {action && <div className="tk-alert-bar-action">{action}</div>}
        <button type="button" className="tk-alert-bar-close" aria-label="Dismiss" onClick={dismiss}>
          <Icon name="x" size={16} color="currentColor" />
        </button>
      </div>,
      slot,
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                  borderRadius: 'var(--tk-r-lg)', background: bg, ...style }}>
      <Icon name={icon || def} size={18} color={fg} style={{ marginTop: 1 }} />
      <div style={{ flex: 1, display: 'grid', gap: 3 }}>
        {title && <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: fg }}>{title}</span>}
        {children && (
          <span style={{ font: '400 13px/19px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{children}</span>
        )}
      </div>
      {action}
    </div>
  );
}
