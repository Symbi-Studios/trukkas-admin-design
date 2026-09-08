import * as React from 'react';
export interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}
export declare function Skeleton(props: SkeletonProps): JSX.Element;
export declare function SkeletonRow(props: { columns?: number; style?: React.CSSProperties }): JSX.Element;
