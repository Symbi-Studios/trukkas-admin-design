import * as React from 'react';
export interface BannerProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  /** override the default glyph for the tone */
  icon?: string;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** trailing control, usually a small Button */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Banner(props: BannerProps): JSX.Element;
