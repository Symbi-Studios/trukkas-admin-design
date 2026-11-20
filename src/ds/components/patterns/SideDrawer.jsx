'use client';
import React from 'react';
import { IconButton } from '../core/IconButton.jsx';
import { InlineAlerts } from '../feedback/AlertSlot.jsx';

/**
 * Right-hand detail drawer that slides in below the top bar, over a light scrim.
 * Closes on the scrim, the ×, and Escape. Mount it only while open.
 *  - eyebrow/title/meta: header (title can be a CopyableId)
 *  - headerActions: extra icon buttons beside the × (e.g. "open full page")
 *  - footer: pinned action area
 */
export function SideDrawer({ label, eyebrow, title, meta, headerActions, footer, onClose, width = 520, children }) {
  React.useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <InlineAlerts>
      <button type="button" className="tk-drawer-scrim" aria-label={'Close ' + (label || 'details')} onClick={onClose} />
      <aside className="tk-drawer" role="dialog" aria-modal="true" aria-label={label} style={{ width: `min(${width}px, calc(100vw - 24px))` }}>
        <header className="tk-drawer-header">
          <div className="tk-drawer-heading">
            {eyebrow && <span className="tk-meta">{eyebrow}</span>}
            {typeof title === 'string' ? <h2 className="tk-title" style={{ fontSize: 20 }}>{title}</h2> : title}
            {meta && <span className="tk-drawer-meta">{meta}</span>}
          </div>
          <div className="tk-drawer-header-actions">
            {headerActions}
            <IconButton icon="x" label="Close" onClick={onClose} />
          </div>
        </header>
        <div className="tk-drawer-body tk-scroll">{children}</div>
        {footer && <footer className="tk-drawer-footer">{footer}</footer>}
      </aside>
    </InlineAlerts>
  );
}

/** A labelled group inside a drawer: small uppercase heading + content. */
export function DrawerSection({ title, children }) {
  return <section className="tk-drawer-section">{title && <h3>{title}</h3>}{children}</section>;
}

/** Two-column key/value grid for drawers. items: [{ label, value, sub?, wide? }] */
export function DrawerFacts({ items }) {
  return (
    <dl className="tk-drawer-facts">
      {items.map((item) => (
        <div key={item.label} className={item.wide ? 'wide' : undefined}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? '—'}{item.sub && <small>{item.sub}</small>}</dd>
        </div>
      ))}
    </dl>
  );
}
