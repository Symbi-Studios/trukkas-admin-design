import * as React from 'react';
/**
 * @startingPoint section="Data" subtitle="Console list table" viewport="700x300"
 */
export interface DataTableColumn<T = any> {
  key: string;
  header?: React.ReactNode;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
}
export interface DataTableProps<T = any> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** adds the leading checkbox column */
  selectable?: boolean;
  /** tints the entire header row with the info-soft background */
  coloredHeader?: boolean;
  selected?: Array<string | number>;
  onSelect?: (keys: Array<string | number>) => void;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T, index: number) => string | number;
  /** 'fixed' makes each column's `width` authoritative instead of content-negotiated —
   *  use for dense tables (8+ columns) where auto-layout starves narrow columns to make
   *  room for badges/numbers with hard content minimums. Pair with an ellipsis style on
   *  cell content so overflow truncates instead of breaking the row. Default 'auto'. */
  tableLayout?: 'auto' | 'fixed';
  style?: React.CSSProperties;
}
export declare function DataTable<T>(props: DataTableProps<T>): JSX.Element;
