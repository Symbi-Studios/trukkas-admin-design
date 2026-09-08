import * as React from 'react';
export interface EmptyStateProps {
  icon?: string;
  title: React.ReactNode;
  /** describe the record that would appear here, not the emptiness */
  description?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
