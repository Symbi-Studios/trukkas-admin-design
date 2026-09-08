import * as React from 'react';
export interface LabelValueProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** small caption under the value in stack layout, e.g. "7 days overdue" */
  hint?: React.ReactNode;
  layout?: 'row' | 'stack';
  /** override the value colour, e.g. var(--tk-danger) for an overdue figure */
  valueTone?: string;
  style?: React.CSSProperties;
}
export declare function LabelValue(props: LabelValueProps): JSX.Element;
