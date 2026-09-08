import * as React from 'react';
export interface ListRowProps {
  icon?: string;
  iconTint?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'neutral';
  avatar?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  valueTone?: string;
  caption?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function ListRow(props: ListRowProps): JSX.Element;
