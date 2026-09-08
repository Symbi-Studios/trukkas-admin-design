import React from 'react';

/** Sidebar + top bar + scrolling content column. Content sits on --tk-surface-page. */
export function AppShell({ sidebar, topbar, children, rail, style }) {
  return (
    <div className="tk-app" style={{ display: 'flex', height: '100%', minHeight: 640,
                                     background: 'var(--tk-surface-page)', ...style }}>
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {topbar}
        <div className="tk-scroll" style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ display: 'flex', gap: 'var(--tk-grid-gap)', alignItems: 'flex-start',
                        padding: 'var(--tk-page-gutter)' }}>
            <main style={{ flex: 1, minWidth: 0, display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--tk-section-gap)' }}>
              {children}
            </main>
            {rail && (
              <aside style={{ width: 'var(--tk-w-rail)', flex: '0 0 auto', minWidth: 0,
                              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)',
                              gap: 'var(--tk-grid-gap)' }}>{rail}</aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
