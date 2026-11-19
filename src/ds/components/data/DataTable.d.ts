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
  expandedRowKeys?: Array<string | number>;
  renderExpandedRow?: (row: T) => React.ReactNode;
  view?: 'list' | 'board';
  boardHideEmpty?: boolean;
  boardGroupBy?: (row: T) => string | null | undefined;
  boardGroups?: Array<string | { value: string; label: string; tone?: string }>;
  boardConfig?: {
    groups: Array<{ value: string; label: string; tone?: string }>;
    card: { title: string | ((row: T) => React.ReactNode); value?: string | ((row: T) => React.ReactNode); subtitle?: string | ((row: T) => React.ReactNode); body?: Array<string | ((row: T) => React.ReactNode)>; footer?: Array<string | ((row: T) => React.ReactNode)>; route?: (row: T) => { from?: string; to?: string } };
    emptyLabel: string;
  };
  boardFields?: string[];
  boardSelectedKey?: string | number;
  boardColumns?: DataTableColumn<T>[];
  boardOnRowClick?: (row: T) => void;
  style?: React.CSSProperties;
}
export declare function DataTable<T>(props: DataTableProps<T>): JSX.Element;
