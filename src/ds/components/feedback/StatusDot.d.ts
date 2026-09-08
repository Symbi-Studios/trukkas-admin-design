import * as React from 'react';
export interface StatusDotProps {
  tone?: 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'purple';
  size?: number;
  /** slow fade — used on "Live" map headers */
  pulse?: boolean;
  label?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function StatusDot(props: StatusDotProps): JSX.Element;
