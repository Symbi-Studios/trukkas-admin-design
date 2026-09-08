import * as React from 'react';
export interface ColorSwatchPickerProps {
  value?: string;
  onChange?: (color: string) => void;
  /** defaults to ROLE_COLORS, the nine role colours used in Administration */
  colors?: string[];
  style?: React.CSSProperties;
}
export declare const ROLE_COLORS: string[];
export declare function ColorSwatchPicker(props: ColorSwatchPickerProps): JSX.Element;
