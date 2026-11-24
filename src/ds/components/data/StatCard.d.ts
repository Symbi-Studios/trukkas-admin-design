import * as React from 'react';
/**
 * @startingPoint section="Data" subtitle="KPI tile with delta" viewport="700x140"
 */
export interface StatCardProps {
  /** Lucide glyph for the tinted 42px tile */
  icon?: string;
  tint?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'navy';
  label: React.ReactNode;
  value: React.ReactNode;
  /** e.g. "24%" — rendered with an arrow; green when the change is good, red when bad, grey when flat */
  delta?: React.ReactNode;
  direction?: 'up' | 'down' | null;
  /** false for metrics where a rise is bad (cancellations, locked users): flips the green/red, not the arrow */
  higherIsBetter?: boolean;
  /** grey trailing caption, e.g. "vs last month" or "43.2% of total" — ignored when labelPosition="bottom" */
  caption?: React.ReactNode;
  /** optional <Sparkline/> under the figure */
  sparkline?: React.ReactNode;
  layout?: 'row' | 'stack';
  /** 'bottom' renders the label under the value instead of above it, and drops the caption */
  labelPosition?: 'top' | 'bottom';
  style?: React.CSSProperties;
}
export declare function StatCard(props: StatCardProps): JSX.Element;
