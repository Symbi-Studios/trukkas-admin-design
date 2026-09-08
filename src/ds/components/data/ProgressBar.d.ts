import * as React from 'react';
export interface ProgressBarProps {
  value?: number;
  max?: number;
  color?: string;
  height?: number;
  label?: React.ReactNode;
  /** right-aligned caption, e.g. "65% used" or "₦10,000,000" */
  caption?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function ProgressBar(props: ProgressBarProps): JSX.Element;
