import React from 'react';

/** Trukkas mark + wordmark: a rounded blue tile carrying a white up-right arrow. */
export function Logo({ showWordmark = true, size = 38, onDark = false, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...style }}>
      <div style={{
        width: size, height: size, borderRadius: size * 0.3, background: 'var(--tk-blue)',
        display: 'grid', placeItems: 'center', flex: '0 0 auto',
      }}>
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7.5 16.5 16.5 7.5M16.5 7.5H9.4M16.5 7.5v7.1" stroke="#fff" strokeWidth="2.6"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {showWordmark && (
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ font: '700 20px/24px var(--tk-font-sans)', letterSpacing: '-0.3px',
                        color: onDark ? '#fff' : 'var(--tk-ink-900)' }}>Trukkas</div>
          <div style={{ font: '400 12px/16px var(--tk-font-sans)',
                        color: onDark ? 'var(--tk-ink-on-navy-dim)' : 'var(--tk-ink-400)' }}>Move. Earn. Grow.</div>
        </div>
      )}
    </div>
  );
}
