import * as React from 'react';
export interface FilterSelectProps {
  /** Without `prefix`: the chip text ("All Status"). With `prefix`: the current value, shown after "Prefix:" when active. */
  label: React.ReactNode;
  /** Filter name shown on the chip, e.g. "Status". When active the chip reads "Status: Delivered". */
  prefix?: string;
  /** leading Lucide glyph, e.g. "filter", "calendar", "sliders-horizontal" */
  icon?: string;
  /** blue chip once a value is chosen */
  active?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** shows a × on the active chip that resets just this filter */
  onClear?: () => void;
  style?: React.CSSProperties;
}
export declare function FilterSelect(props: FilterSelectProps): JSX.Element;
