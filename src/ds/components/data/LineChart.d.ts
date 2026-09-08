import * as React from 'react';
export interface LineSeries { name?: string; color?: string; points: number[]; }
export interface LineChartProps {
  series: LineSeries[];
  labels?: string[];
  height?: number;
  /** fills under a single series — the Operational Activity chart on the dashboard */
  area?: boolean;
  yTicks?: number;
  style?: React.CSSProperties;
}
export declare function LineChart(props: LineChartProps): JSX.Element;
