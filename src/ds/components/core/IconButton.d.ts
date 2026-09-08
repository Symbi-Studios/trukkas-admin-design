import * as React from 'react';
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  /** square edge in px, default 32 */
  size?: number;
  tone?: 'ghost' | 'sunk' | 'outline' | 'blue';
  label?: string;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
