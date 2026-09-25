import * as React from 'react';
export interface LegendItem { label: string; value?: number; percent?: number; display?: React.ReactNode; color?: string; }
export interface LegendListProps {
  items: LegendItem[];
  /** hide the computed percentage column */
  showShare?: boolean;
  style?: React.CSSProperties;
}
export declare function LegendList(props: LegendListProps): JSX.Element;
