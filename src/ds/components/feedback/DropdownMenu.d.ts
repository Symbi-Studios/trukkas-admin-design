import * as React from 'react';
export interface MenuItem {
  label?: React.ReactNode;
  icon?: string;
  tone?: 'default' | 'danger';
  onClick?: () => void;
  trailing?: React.ReactNode;
  /** uppercase group heading instead of a row */
  section?: string;
  divider?: boolean;
}
export interface DropdownMenuProps {
  items: MenuItem[];
  width?: number;
  open?: boolean;
  style?: React.CSSProperties;
}
export declare function DropdownMenu(props: DropdownMenuProps): JSX.Element;
