import * as React from 'react';
/**
 * @startingPoint section="Patterns" subtitle="Detail-page identity header" viewport="700x220"
 */
export interface HeaderFact { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; tone?: string; }
export interface EntityHeaderCardProps {
  name: React.ReactNode;
  avatar?: React.ReactNode;
  initials?: string;
  badges?: React.ReactNode;
  subtitle?: React.ReactNode;
  facts?: HeaderFact[];
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function EntityHeaderCard(props: EntityHeaderCardProps): JSX.Element;
