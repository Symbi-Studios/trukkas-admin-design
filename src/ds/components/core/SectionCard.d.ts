import * as React from 'react';
/**
 * @startingPoint section="Core" subtitle="Titled panel with footer link" viewport="700x260"
 */
export interface SectionCardProps {
  title: React.ReactNode;
  description: React.ReactNode;
  /** Lucide glyph shown before the title */
  icon?: string;
  /** Hover explanation shown from an info glyph beside the title */
  tooltip?: React.ReactNode;
  /** blue pill count beside the title, e.g. 68 opportunities */
  count?: number | string;
  /** right-hand control: a "View all" link, a range Select, a Tabs strip */
  action?: React.ReactNode;
  /** centred footer link under a hairline, e.g. "View all events" */
  footer?: React.ReactNode;
  pad?: "none" | "md";
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function SectionCard(props: SectionCardProps): JSX.Element;
