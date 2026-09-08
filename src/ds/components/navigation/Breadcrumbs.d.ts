import * as React from 'react';
export interface Crumb { label: React.ReactNode; onClick?: () => void; }
export interface BreadcrumbsProps { items: Array<string | Crumb>; style?: React.CSSProperties; }
export declare function Breadcrumbs(props: BreadcrumbsProps): JSX.Element;
