import * as React from 'react';
export interface CheckboxProps {
  checked?: boolean;
  /** header checkbox state when only some rows are selected */
  indeterminate?: boolean;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
  style?: React.CSSProperties;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;
