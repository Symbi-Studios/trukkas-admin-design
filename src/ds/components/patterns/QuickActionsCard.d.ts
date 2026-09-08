import * as React from 'react';
export interface QuickAction { icon: string; label: React.ReactNode; hint?: React.ReactNode; onClick?: () => void; }
export interface QuickActionsCardProps {
  title?: React.ReactNode;
  items: QuickAction[];
  layout?: 'list' | 'grid';
  style?: React.CSSProperties;
}
export declare function QuickActionsCard(props: QuickActionsCardProps): JSX.Element;
