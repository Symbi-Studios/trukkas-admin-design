import * as React from 'react';
export interface TabItem { value: string; label: React.ReactNode; count?: number; }
export interface TabsProps {
  items: Array<string | TabItem>;
  value?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}
export declare function Tabs(props: TabsProps): JSX.Element;
