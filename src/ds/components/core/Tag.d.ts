import * as React from 'react';
export interface TagProps {
  children?: React.ReactNode;
  tone?: 'neutral' | 'blue' | 'orange' | 'purple' | 'teal' | 'danger' | 'success';
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Tag(props: TagProps): JSX.Element;
