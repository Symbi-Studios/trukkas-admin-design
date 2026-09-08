import * as React from 'react';
/**
 * @startingPoint section="Navigation" subtitle="Console sidebar" viewport="700x460"
 */
export interface SidebarProps {
  collapsed?: boolean;
  children?: React.ReactNode;
  /** pinned block above the collapse control — the promo card or an account chip */
  footer?: React.ReactNode;
  onCollapse?: () => void;
  style?: React.CSSProperties;
}
export declare function Sidebar(props: SidebarProps): JSX.Element;
