import * as React from 'react';
export interface ChoiceCardProps {
  selected?: boolean;
  icon?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  onSelect?: () => void;
  style?: React.CSSProperties;
}
export declare function ChoiceCard(props: ChoiceCardProps): JSX.Element;
