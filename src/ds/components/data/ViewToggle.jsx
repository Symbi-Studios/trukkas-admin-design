import React from "react";
import { Icon } from "../../assets/icons/Icon.jsx";

/** List / Board switch for a table's toolbar. */
export function ViewToggle({ value = "list", onChange, style }) {
  return (
    <div className="tk-view-toggle" role="group" aria-label="View" style={style}>
      <button type="button" aria-pressed={value === "list"} className={value === "list" ? "active" : undefined} onClick={() => onChange?.("list")}>
        <Icon name="list" size={15} /> List
      </button>
      <button type="button" aria-pressed={value === "board"} className={value === "board" ? "active" : undefined} onClick={() => onChange?.("board")}>
        <Icon name="square-kanban" size={15} /> Board
      </button>
    </div>
  );
}
