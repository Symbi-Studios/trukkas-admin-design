import * as React from 'react';
export interface MessageBubbleProps {
  author: React.ReactNode;
  role?: React.ReactNode;
  roleTone?: 'blue' | 'purple' | 'teal' | 'orange' | 'neutral';
  time?: React.ReactNode;
  children?: React.ReactNode;
  internal?: boolean;
  style?: React.CSSProperties;
}
export declare function MessageBubble(props: MessageBubbleProps): JSX.Element;
