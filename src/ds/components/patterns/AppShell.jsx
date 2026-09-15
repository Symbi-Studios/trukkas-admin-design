import React from 'react';

/** Sidebar + top bar + scrolling content column. Content sits on --tk-surface-page. */
export function AppShell({ sidebar, topbar, children, rail, mobileNavOpen = false, onMobileNavClose, style }) {
  return (
    <div className="tk-app tk-app-shell" data-mobile-nav-open={mobileNavOpen || undefined} style={{ display: 'flex', height: '100%', minHeight: 640,
                                     background: 'var(--tk-surface-page)', ...style }}>
      <div className="tk-sidebar-slot">{sidebar}</div>
      {mobileNavOpen && <button className="tk-sidebar-scrim" type="button" aria-label="Close navigation" onClick={onMobileNavClose} />}
      <div className="tk-app-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {topbar}
        <div className="tk-scroll tk-app-scroll" style={{ flex: 1, overflow: 'auto' }}>
          <div className="tk-page-frame" style={{ display: 'flex', gap: 'var(--tk-grid-gap)', alignItems: 'flex-start',
                        padding: 'var(--tk-page-gutter)' }}>
            <main className="tk-page-main" style={{ flex: 1, minWidth: 0, display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--tk-section-gap)' }}>
              {children}
            </main>
            {rail && (
              <aside className="tk-page-rail" style={{ width: 'var(--tk-w-rail)', flex: '0 0 auto', minWidth: 0,
                              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)',
                              gap: 'var(--tk-grid-gap)' }}>{rail}</aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
