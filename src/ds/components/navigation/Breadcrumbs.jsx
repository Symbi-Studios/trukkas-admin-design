'use client';
import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';
import { Link } from '../../../router.js';
import { NAV } from '../../../nav.js';

const PAGE_PATHS = new Map(NAV.flatMap((group) => group.items.map((item) => [item.label.toLowerCase(), '/' + item.id])));

/** Resolve a crumb to { label, to?, onClick? }. Plain strings that match a sidebar page become links. */
function resolve(item) {
  if (item && typeof item === 'object') return item;
  const to = PAGE_PATHS.get(String(item).toLowerCase());
  return to ? { label: item, to } : { label: item };
}

/**
 * Home › Section › Page › Current. Earlier crumbs link when they have `to`, `href` or `onClick`
 * (or are a sidebar page name); section names and the current page are plain text.
 */
export function Breadcrumbs({ items = [], home = true, style }) {
  const crumbs = items.map(resolve);
  return (
    <nav className="tk-breadcrumbs" aria-label="Breadcrumb" style={style}>
      <ol>
        {home && (
          <li>
            <Link to="/dashboard" className="tk-breadcrumb-home" aria-label="Dashboard"><Icon name="house" size={14} /></Link>
          </li>
        )}
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          const href = crumb.to || crumb.href;
          return (
            <li key={crumb.label + i}>
              {(home || i > 0) && <Icon name="chevron-right" size={13} className="tk-breadcrumb-sep" />}
              {last ? <span aria-current="page" className="tk-breadcrumb-current">{crumb.label}</span>
                : href ? <Link to={href} className="tk-breadcrumb-link">{crumb.label}</Link>
                  : crumb.onClick ? <button type="button" className="tk-breadcrumb-link" onClick={crumb.onClick}>{crumb.label}</button>
                    : <span className="tk-breadcrumb-text">{crumb.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
