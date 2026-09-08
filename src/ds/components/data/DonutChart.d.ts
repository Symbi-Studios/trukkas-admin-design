import * as React from 'react';
export interface DonutSegment { label: string; value: number; color?: string; }
export interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  /** big number in the hole, e.g. 24 or "72%" */
  centerValue?: React.ReactNode;
  /** small caption under it, e.g. "Total Trucks" */
  centerLabel?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function DonutChart(props: DonutChartProps): JSX.Element;
