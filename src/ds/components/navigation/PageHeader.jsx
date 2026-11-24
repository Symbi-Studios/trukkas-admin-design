'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import { Breadcrumbs } from './Breadcrumbs.jsx';
import { NAV } from '../../../nav.js';

const NAV_PAGES = NAV.flatMap((group) => group.items.map((item) => ({ ...item, section: group.section, path: '/' + item.id })));
const labelOf = (crumb) => (typeof crumb === 'string' ? crumb : crumb?.label) || '';
// An explicit link wins over a label match, since labels like "Overview" repeat across sections.
const pathOf = (crumb) => (crumb && typeof crumb === 'object' ? crumb.to || crumb.href : null);
const pageFor = (crumb) => (pathOf(crumb) && NAV_PAGES.find((page) => page.path === pathOf(crumb)))
  || NAV_PAGES.find((page) => page.label.toLowerCase() === labelOf(crumb).toLowerCase());

/**
 * Breadcrumbs that always start from a real sidebar section:
 *  - crumbs before the first sidebar page are replaced by that page's section
 *    (so made-up groupings like "Jobs & Trips" never show as dead crumbs)
 *  - pages without crumbs, or whose crumbs don't name a sidebar page, use the current route
 */
function normalizeCrumbs(crumbs, pathname) {
  const segments = (pathname || '').split('/').filter(Boolean);
  const routePage = NAV_PAGES.find((page) => page.id === segments[0]);
  const list = crumbs || [];
  const index = list.findIndex((crumb) => pageFor(crumb));
  if (index >= 0) {
    const page = pageFor(list[index]);
    const rest = list.slice(index);
    // Link the page crumb unless it's the current page.
    if (rest.length > 1 && typeof rest[0] === 'string') rest[0] = { label: rest[0], to: page.path };
    return [page.section, ...rest];
  }
  if (!routePage) return list;
  if (segments.length <= 1) return [routePage.section, routePage.label];
  const current = list.length ? list[list.length - 1] : null;
  return [routePage.section, { label: routePage.label, to: routePage.path }, ...(current ? [current] : [])];
}

/** Title block: breadcrumbs, title, description, right-hand actions. */
export function PageHeader({ crumbs, title, description, actions, meta, style }) {
  const pathname = usePathname();
  const items = normalizeCrumbs(crumbs, pathname);
  const onDashboard = (pathname || '/') === '/' || pathname.startsWith('/dashboard');
  return (
    <header className="tk-page-header" style={style}>
      {items.length > 0 && <Breadcrumbs items={items} home={!onDashboard} />}
      <div className="tk-page-header-row">
        <div className="tk-page-header-copy">
          <div className="tk-page-header-title">
            <h1 className="tk-display">{title}</h1>
            {meta}
          </div>
          {description && <p className="tk-page-header-description">{description}</p>}
        </div>
        {actions && <div className="tk-page-header-actions">{actions}</div>}
      </div>
    </header>
  );
}
