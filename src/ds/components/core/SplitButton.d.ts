import * as React from 'react';
export interface SplitButtonProps {
  variant?: 'primary' | 'accent';
  icon?: string;
  children?: React.ReactNode;
  onAction?: () => void;
  onToggle?: () => void;
  style?: React.CSSProperties;
}
export declare function SplitButton(props: SplitButtonProps): JSX.Element;
