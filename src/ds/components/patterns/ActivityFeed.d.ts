import * as React from 'react';
export interface ActivityItem {
  text: React.ReactNode;
  actor?: React.ReactNode;
  time?: React.ReactNode;
  tone?: string;
}
export interface ActivityFeedProps {
  items: ActivityItem[];
  showDot?: boolean;
  style?: React.CSSProperties;
}
export declare function ActivityFeed(props: ActivityFeedProps): JSX.Element;
