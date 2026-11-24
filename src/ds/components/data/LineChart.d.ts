import * as React from 'react';
export interface LineSeries { name?: string; color?: string; points: number[]; }
export interface LineChartProps {
  series: LineSeries[];
  labels?: string[];
  height?: number;
  /** fills under a single series — the Operational Activity chart on the dashboard */
  area?: boolean;
  yTicks?: number;
  format?: (value: number) => React.ReactNode;
  /** shown in place of the lines when every point is zero (default "No activity in this period") */
  emptyLabel?: string;
  style?: React.CSSProperties;
}
export declare function LineChart(props: LineChartProps): JSX.Element;
