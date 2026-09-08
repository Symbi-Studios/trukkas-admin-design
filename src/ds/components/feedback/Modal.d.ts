import * as React from 'react';
/**
 * @startingPoint section="Feedback" subtitle="Centered dialog over a scrim" viewport="600x420"
 */
export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Panel width in px. Default 480. */
  width?: number;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Modal(props: ModalProps): JSX.Element | null;
