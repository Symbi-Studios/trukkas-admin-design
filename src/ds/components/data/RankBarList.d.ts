import * as React from 'react';
export interface RankBarItem { label: string; value: number; display?: React.ReactNode; color?: string; }
export interface RankBarListProps {
  items: RankBarItem[];
  numbered?: boolean;
  color?: string;
  style?: React.CSSProperties;
}
export declare function RankBarList(props: RankBarListProps): JSX.Element;
