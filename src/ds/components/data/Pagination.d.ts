import * as React from 'react';
export interface PaginationProps {
  page?: number;
  pageCount?: number;
  pageSize?: number;
  /** total rows — renders the "Showing 1 to 10 of 1,248" line */
  total?: number;
  onPage?: (page: number) => void;
  /** omit to hide the rows-per-page select */
  onPageSize?: (size: number) => void;
  style?: React.CSSProperties;
}
export declare function Pagination(props: PaginationProps): JSX.Element;
