import * as React from 'react';
export interface TableToolbarProps {
  /** a <SearchField/> */
  search?: React.ReactNode;
  /** one or more <FilterSelect/> */
  filters?: React.ReactNode;
  /** right-aligned extras, e.g. an Apply Filters button */
  trailing?: React.ReactNode;
  onClear?: () => void;
  style?: React.CSSProperties;
}
export declare function TableToolbar(props: TableToolbarProps): JSX.Element;
