import * as React from 'react';
/**
 * @startingPoint section="Navigation" subtitle="Console top bar" viewport="700x90"
 */
export interface WorkspaceSearchItem { id: string; section: string; key: string; icon: string; label: string; meta?: string | null; tag?: string | null; to: string; }
export interface WorkspaceSearchGroup { section: string; total?: number | null; items: WorkspaceSearchItem[]; }
export interface TopBarProps {
  onMenu?: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: React.ChangeEventHandler<HTMLInputElement>;
  onSearchKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  searchResults?: WorkspaceSearchGroup[];
  searchLoading?: boolean;
  searchUnavailable?: boolean;
  onSearchSelect?: (item: WorkspaceSearchItem) => void;
  /** label beside the green dot; pass null to hide the pill */
  health?: React.ReactNode;
  notifications?: number;
  user?: string;
  role?: string;
  style?: React.CSSProperties;
}
export declare function TopBar(props: TopBarProps): JSX.Element;
