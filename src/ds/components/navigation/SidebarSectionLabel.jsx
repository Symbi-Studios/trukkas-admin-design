import React from 'react';

/** Group heading in the sidebar: Operations, Users, Fleet, Finance… Small and muted, so the
 *  rows under it carry the weight. */
export function SidebarSectionLabel({ children, style }) {
  return <div className="tk-nav-section" style={style}>{children}</div>;
}
