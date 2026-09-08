import * as React from 'react';
/**
 * @startingPoint section="Navigation" subtitle="Page title block with actions" viewport="700x150"
 */
export interface PageHeaderProps {
  crumbs?: Array<string | { label: React.ReactNode; onClick?: () => void }>;
  title: React.ReactNode;
  /** one factual sentence describing what the page manages */
  description?: React.ReactNode;
  /** Buttons, right-aligned; at most one primary */
  actions?: React.ReactNode;
  /** inline node beside the title, e.g. a Badge */
  meta?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function PageHeader(props: PageHeaderProps): JSX.Element;
