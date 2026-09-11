import * as React from 'react';
export interface MapLegendItem { label: React.ReactNode; color: string; }
export interface MapPanelProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  legend?: MapLegendItem[];
  height?: number;
  onExpand?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function MapPanel(props: MapPanelProps): JSX.Element;
