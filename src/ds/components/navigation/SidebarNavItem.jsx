import React from "react";
import NextLink from "next/link";
import { Icon } from "../../assets/icons/Icon.jsx";

/**
 * One sidebar row. Active is a soft grey fill with full-strength ink; idle rows are muted and
 * wash grey on hover. Pass `href` to render a real link (cmd-click, open in new tab);
 * without it the row is a button that calls `onClick`.
 */
export function SidebarNavItem({
  icon,
  label,
  active,
  collapsed,
  expandable,
  expanded,
  badge,
  depth = 0,
  href,
  onClick,
  style,
}) {
  const content = (
    <>
      {icon && <Icon name={icon} size={16} aria-hidden="true" />}
      {!collapsed && <span className="tk-nav-label">{label}</span>}
      {!collapsed && badge}
      {!collapsed && expandable && (
        <Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} aria-hidden="true" />
      )}
    </>
  );
  const props = {
    className: "tk-nav-item",
    "data-active": active || undefined,
    "aria-current": active ? "page" : undefined,
    "aria-label": collapsed ? label : undefined,
    title: collapsed ? label : undefined,
    style: { paddingLeft: 10 + depth * 16, ...style },
  };
  if (href) {
    return <NextLink href={href} onClick={onClick} {...props}>{content}</NextLink>;
  }
  return <button type="button" onClick={onClick} {...props}>{content}</button>;
}
