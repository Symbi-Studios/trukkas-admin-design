import * as React from 'react';
export interface SparklineProps {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}
export declare function Sparkline(props: SparklineProps): JSX.Element;
