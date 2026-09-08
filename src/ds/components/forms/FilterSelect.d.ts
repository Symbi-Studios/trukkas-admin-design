import * as React from 'react';
export interface FilterSelectProps {
  label: React.ReactNode;
  /** leading Lucide glyph, e.g. "filter", "calendar", "sliders-horizontal" */
  icon?: string;
  /** blue border once a value is chosen */
  active?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function FilterSelect(props: FilterSelectProps): JSX.Element;
