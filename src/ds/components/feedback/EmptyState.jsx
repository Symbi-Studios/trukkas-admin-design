import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/* Humaaans illustrations (public/illustrations). Each empty state picks one
   from its icon so related screens look consistent. */
const ILLUSTRATIONS = {
  whiteboard: { src: '/illustrations/whiteboard.svg', width: 200 },
  sitting: { src: '/illustrations/sitting.svg', width: 150 },
  standing: { src: '/illustrations/standing.svg', width: 130 },
};

const BY_ICON = {
  'file-text': 'sitting', 'scroll-text': 'sitting', receipt: 'sitting', wallet: 'sitting',
  'clipboard-list': 'sitting', calendar: 'sitting', inbox: 'sitting',
  users: 'standing', truck: 'standing', route: 'standing', package: 'standing',
  'building-2': 'standing', star: 'standing', 'shield-check': 'standing', shield: 'standing',
};

/** Describes the record that would be here, then offers the permitted action.
 *  `illustration`: 'whiteboard' | 'sitting' | 'standing' | false (icon only). */
export function EmptyState({ icon = 'inbox', illustration, title, description, action, style }) {
  const key = illustration === false ? null : (illustration || BY_ICON[icon] || 'whiteboard');
  const art = key && ILLUSTRATIONS[key];
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 10, padding: '40px 24px 48px',
                  textAlign: 'center', ...style }}>
      {art ? (
        <span className="tk-empty-art">
          <img src={art.src} alt="" width={art.width} draggable={false} />
        </span>
      ) : (
        <span style={{ width: 52, height: 52, borderRadius: 'var(--tk-r-lg)', display: 'grid',
                       placeItems: 'center', background: 'var(--tk-surface-sunk)', color: 'var(--tk-ink-300)' }}>
          <Icon name={icon} size={24} />
        </span>
      )}
      <span style={{ font: '700 16px/22px var(--tk-font-sans)', letterSpacing: 'var(--tk-heading-track, -0.02em)',
                     color: 'var(--tk-ink-900)' }}>{title}</span>
      {description && (
        <span style={{ maxWidth: 380, font: '400 13px/19px var(--tk-font-sans)',
                       color: 'var(--tk-ink-400)' }}>{description}</span>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
