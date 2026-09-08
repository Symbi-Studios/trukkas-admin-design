import * as React from 'react';
export interface AvatarProps {
  /** used for the initials and for the deterministic fill colour */
  name?: string;
  src?: string;
  /** 28 in a table row, 36 default, 44 in a detail header */
  size?: number;
  /** rounded square — used for the account chip in the top bar */
  square?: boolean;
  tone?: string;
  style?: React.CSSProperties;
}
export declare function Avatar(props: AvatarProps): JSX.Element;
