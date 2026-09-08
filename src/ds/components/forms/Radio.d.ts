import * as React from 'react';
export interface RadioProps {
  checked?: boolean;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
  style?: React.CSSProperties;
}
export declare function Radio(props: RadioProps): JSX.Element;
