import * as React from 'react';
export interface CopyableIdProps {
  id: string;
  size?: 'sm' | 'md' | 'lg';
  onCopy?: (id: string) => void;
  style?: React.CSSProperties;
}
export declare function CopyableId(props: CopyableIdProps): JSX.Element;
