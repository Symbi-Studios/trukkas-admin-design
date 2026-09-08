import * as React from 'react';
/**
 * @startingPoint section="Core" subtitle="Status badge vocabulary" viewport="700x150"
 */
export type BadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'purple' | 'orange' | 'teal';
export interface BadgeProps {
  children?: React.ReactNode;
  /** omit to let TK_STATUS map the label to its tone */
  tone?: BadgeTone;
  /** leading 6px dot — used in the fleet Status column */
  dot?: boolean;
  style?: React.CSSProperties;
}
export declare const TK_STATUS: Record<string, BadgeTone>;
export declare function Badge(props: BadgeProps): JSX.Element;
