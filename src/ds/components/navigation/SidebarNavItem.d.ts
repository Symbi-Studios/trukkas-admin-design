import * as React from 'react';
export interface SidebarNavItemProps {
  /** Lucide glyph id */
  icon?: string;
  label: React.ReactNode;
  active?: boolean;
  /** icon-only rail */
  collapsed?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  /** e.g. a <CountBadge/> */
  badge?: React.ReactNode;
  /** 1 for a child item under an expanded group */
  depth?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function SidebarNavItem(props: SidebarNavItemProps): JSX.Element;
