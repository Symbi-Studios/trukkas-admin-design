import * as React from 'react';
export interface AlertRowProps {
  icon?: string;
  tone?: 'red' | 'amber' | 'blue' | 'green';
  title: React.ReactNode;
  description?: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function AlertRow(props: AlertRowProps): JSX.Element;
