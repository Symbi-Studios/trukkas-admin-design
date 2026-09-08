import * as React from 'react';
export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** "global" = the sunk-grey top-bar field with the shortcut hint */
  variant?: 'global' | 'panel';
  shortcut?: string;
}
export declare function SearchField(props: SearchFieldProps): JSX.Element;
