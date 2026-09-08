import * as React from 'react';
/**
 * @startingPoint section="Patterns" subtitle="Sidebar + top bar + content + rail" viewport="1440x900"
 */
export interface AppShellProps {
  /** a <Sidebar/> */
  sidebar?: React.ReactNode;
  /** a <TopBar/> */
  topbar?: React.ReactNode;
  children?: React.ReactNode;
  /** the 320px right-hand insight column — omit for full-width pages */
  rail?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function AppShell(props: AppShellProps): JSX.Element;
