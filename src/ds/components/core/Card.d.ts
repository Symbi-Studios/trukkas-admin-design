import * as React from 'react';
/**
 * @startingPoint section="Core" subtitle="r14 surface with hairline border" viewport="700x180"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  pad?: 'none' | 'tight' | 'md';
  tone?: 'white' | 'sunk' | 'cool' | 'navy';
}
export declare function Card(props: CardProps): JSX.Element;
