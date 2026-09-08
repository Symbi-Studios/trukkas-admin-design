import * as React from 'react';
export interface CountBadgeProps {
  count: React.ReactNode;
  tone?: 'danger' | 'blue' | 'soft' | 'warning';
  style?: React.CSSProperties;
}
export declare function CountBadge(props: CountBadgeProps): JSX.Element;
