import * as React from 'react';
export interface AttachmentCardProps {
  name: React.ReactNode;
  size?: React.ReactNode;
  kind?: 'pdf' | 'image' | 'sheet' | 'doc';
  onOpen?: () => void;
  style?: React.CSSProperties;
}
export declare function AttachmentCard(props: AttachmentCardProps): JSX.Element;
