import * as React from 'react';
export interface BarSeries { name?: string; color?: string; points: number[]; }
export interface BarChartProps {
  series: BarSeries[];
  labels?: string[];
  height?: number;
  /** y-axis tick formatter, e.g. v => '₦' + Math.round(v/1e6) + 'M' */
  format?: (value: number) => React.ReactNode;
  style?: React.CSSProperties;
}
export declare function BarChart(props: BarChartProps): JSX.Element;
