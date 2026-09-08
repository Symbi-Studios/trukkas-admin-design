import * as React from 'react';
/**
 * @startingPoint section="Forms" subtitle="Labelled text input with hint and error" viewport="700x150"
 */
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  required?: boolean;
  /** helper under the field */
  hint?: React.ReactNode;
  /** replaces hint and turns the border red */
  error?: React.ReactNode;
  /** leading Lucide glyph */
  icon?: string;
  /** trailing node — a unit, a counter, a small button */
  suffix?: React.ReactNode;
}
export declare function TextField(props: TextFieldProps): JSX.Element;
