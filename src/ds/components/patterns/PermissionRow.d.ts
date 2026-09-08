import * as React from 'react';
export interface PermissionRowProps {
  icon: string;
  module: React.ReactNode;
  actions?: number;
  value?: 'full' | 'custom' | 'none';
  levels?: string[];
  expandable?: boolean;
  onChange?: (level: string) => void;
  style?: React.CSSProperties;
}
export declare function PermissionRow(props: PermissionRowProps): JSX.Element;
