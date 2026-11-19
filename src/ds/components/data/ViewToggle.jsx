import React from "react";
import { Icon } from "../../assets/icons/Icon.jsx";

/** List / Board switch for a table's toolbar. */
export function ViewToggle({ value = "list", onChange, style, map = false, hideEmpty = false, onHideEmptyChange }) {
  return (
    <div className="tk-table-view-controls">
    <div className="tk-view-toggle" role="group" aria-label="View" style={style}>
      <button type="button" aria-pressed={value === "list"} className={value === "list" ? "active" : undefined} onClick={() => onChange?.("list")}>
        <Icon name="list" size={15} /> List
      </button>
      <button type="button" aria-pressed={value === "board"} className={value === "board" ? "active" : undefined} onClick={() => onChange?.("board")}>
        <Icon name="square-kanban" size={15} /> Board
      </button>
      {map && <button type="button" aria-pressed={value === 'map'} className={value === 'map' ? 'active' : undefined} onClick={() => onChange?.('map')}>
        <Icon name="map-pin" size={15} /> Map
      </button>}
    </div>
    {value === 'board' && onHideEmptyChange && <label className="tk-board-empty-toggle">
      <input type="checkbox" role="switch" checked={hideEmpty} onChange={(event) => onHideEmptyChange(event.target.checked)} />
      <span>Hide empty columns</span>
    </label>}
    </div>
  );
}
