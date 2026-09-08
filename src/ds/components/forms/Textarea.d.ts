import * as React from 'react';
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  /** renders the 0/500 counter inside the field */
  maxLength?: number;
}
export declare function Textarea(props: TextareaProps): JSX.Element;
