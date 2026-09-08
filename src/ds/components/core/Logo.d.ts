import * as React from 'react';
/**
 * @startingPoint section="Brand" subtitle="Trukkas mark and lockup" viewport="700x120"
 */
export interface LogoProps {
  showWordmark?: boolean;
  /** tile edge in px, default 38 */
  size?: number;
  /** flips the wordmark to white — for the navy wallet card, not the sidebar */
  onDark?: boolean;
  style?: React.CSSProperties;
}
export declare function Logo(props: LogoProps): JSX.Element;
