import * as React from 'react';
export interface TimelineItem {
  title: React.ReactNode;
  /** timestamp, rendered in mono */
  time?: React.ReactNode;
  description?: React.ReactNode;
  state?: 'done' | 'current' | 'pending' | 'danger' | 'warning';
  /** small glyph inside the node */
  icon?: string;
}
export interface TimelineProps { items: TimelineItem[]; style?: React.CSSProperties; }
export declare function Timeline(props: TimelineProps): JSX.Element;
