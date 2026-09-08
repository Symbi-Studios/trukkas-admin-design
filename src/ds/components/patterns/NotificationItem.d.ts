import * as React from 'react';
export interface NotificationItemProps {
  icon?: string;
  tone?: 'blue' | 'orange' | 'green' | 'purple' | 'red';
  title: React.ReactNode;
  preview?: React.ReactNode;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  unread?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function NotificationItem(props: NotificationItemProps): JSX.Element;
