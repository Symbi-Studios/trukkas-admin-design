import * as React from 'react';
export interface SwitchProps {
  checked?: boolean;
  label?: React.ReactNode;
  /** explanatory line under the label, e.g. "Can create, edit and deactivate user accounts." */
  hint?: React.ReactNode;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
  style?: React.CSSProperties;
}
export declare function Switch(props: SwitchProps): JSX.Element;
