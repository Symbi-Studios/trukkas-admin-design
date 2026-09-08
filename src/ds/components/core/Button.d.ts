import * as React from 'react';
/**
 * @startingPoint section="Core" subtitle="Action button, six fills" viewport="700x160"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = the one blue action per view; accent = the orange CTA on the navy shell */
  variant?: 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Lucide glyph id rendered before the label */
  icon?: string;
  /** Lucide glyph id rendered after the label — usually "chevron-down" */
  iconRight?: string;
  fullWidth?: boolean;
}
export declare function Button(props: ButtonProps): JSX.Element;
