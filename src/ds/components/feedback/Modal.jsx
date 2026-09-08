import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/** Centered dialog over a scrim. Controlled — mount only what's `open`.
 *  Closes on scrim click, the × button, and Escape. */
export function Modal({ open, onClose, title, description, width = 480, footer, children, style }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div role="presentation" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'var(--tk-scrim)', zIndex: 100,
               display: 'grid', placeItems: 'center', padding: 24,
               animation: 'tk-fade-in var(--tk-dur) var(--tk-ease)' }}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        style={{ width, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column',
                 background: 'var(--tk-surface)', borderRadius: 'var(--tk-r-2xl)',
                 boxShadow: 'var(--tk-shadow-modal)', animation: 'tk-menu-in var(--tk-dur) var(--tk-ease)',
                 ...style }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 24px 16px' }}>
          <div style={{ flex: 1, display: 'grid', gap: 4, minWidth: 0 }}>
            {title && <h2 className="tk-title" style={{ fontSize: 18 }}>{title}</h2>}
            {description && <span className="tk-meta">{description}</span>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: 0,
                     background: 'transparent', cursor: 'pointer', color: 'var(--tk-ink-400)',
                     borderRadius: 'var(--tk-r-sm)', flex: '0 0 auto' }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="tk-scroll" style={{ padding: '0 24px 20px', overflow: 'auto', flex: 1, minHeight: 0 }}>
          {children}
        </div>
        {footer && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px',
                       borderTop: '1px solid var(--tk-line)', flex: '0 0 auto' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
