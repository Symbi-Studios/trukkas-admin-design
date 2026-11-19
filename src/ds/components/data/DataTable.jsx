import React from "react";
import { Checkbox } from "../forms/Checkbox.jsx";
import { DataBoard } from "./DataBoard.jsx";

/**
 * The console list table. Columns declare { key, header, width, align, render }.
 * Rows are separated by hairlines; the header row is an 11px uppercase ink-400 band on surface-sunk.
 * Clickable rows highlight on hover (see ds/styles.css).
 * Pass view="board" with boardGroupBy={(row) => row.status} to show the same rows as a board
 * (pair it with <ViewToggle> in the toolbar). boardGroups orders the columns; boardFields picks card fields.
 */
export function DataTable({
  columns = [],
  rows = [],
  selectable,
  selected = [],
  onSelect,
  onRowClick,
  rowKey = (r, i) => r.id ?? i,
  tableLayout = "auto",
  style,
  coloredHeader,
  expandedRowKeys = [],
  renderExpandedRow,
  view = "list",
  boardGroupBy,
  boardGroups,
  boardFields,
  boardSelectedKey,
  boardColumns,
  boardOnRowClick,
  boardConfig,
}) {
  if (view === "board" && boardGroupBy) {
    return <DataBoard columns={boardColumns || columns} rows={rows} groupBy={boardGroupBy} groups={boardConfig?.groups || boardGroups} card={boardConfig?.card} emptyLabel={boardConfig?.emptyLabel} fields={boardFields} onRowClick={boardOnRowClick || onRowClick} rowKey={rowKey} selectedKey={boardSelectedKey} expandedRowKeys={expandedRowKeys} renderExpandedRow={renderExpandedRow} />;
  }
  const allOn = rows.length > 0 && selected.length === rows.length;
  const cell = {
    padding: "var(--tk-row-pad-y) var(--tk-row-pad-x)",
    verticalAlign: "middle",
  };
  return (
    <div className="tk-scroll tk-table-wrap" style={{ overflowX: "auto", ...style }}>
      <table
        className="tk-data-table"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout,
          minWidth: Math.max(640, columns.length * 118 + (selectable ? 44 : 0)),
          font: "var(--tk-body-weight) var(--tk-body-size)/var(--tk-body-lh) var(--tk-font-sans)",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--tk-line)" }}>
            {selectable && (
              <th className="tk-table-select"
                style={{
                  ...cell,
                  width: 44,
                }}
              >
                <Checkbox
                  checked={allOn}
                  indeterminate={!allOn && selected.length > 0}
                  onChange={(v) => onSelect?.(v ? rows.map(rowKey) : [])}
                />
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.key}
                data-key={c.key}
                style={{
                  ...cell,
                  width: c.width,
                  textAlign: c.align || "left",
                  paddingTop: 12,
                  paddingBottom: 12,
                  font: "600 11px/16px var(--tk-font-sans)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--tk-ink-400)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  backgroundColor: "var(--tk-surface-sunk)",
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const k = rowKey(r, i);
            const on = selected.includes(k);
            const expanded = expandedRowKeys.includes(k);
            return (
              <React.Fragment key={k}>
              <tr
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onRowClick(r); } } : undefined}
                onClick={() => onRowClick?.(r)}
                style={{
                  borderBottom: "1px solid var(--tk-line)",
                  background: on ? "var(--tk-surface-soft)" : undefined,
                  cursor: onRowClick ? "pointer" : "default",

                }}
              >
                {selectable && (
                  <td className="tk-table-select" style={cell} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={on}
                      onChange={(v) =>
                        onSelect?.(
                          v
                            ? [...selected, k]
                            : selected.filter((x) => x !== k),
                        )
                      }
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td
                    key={c.key}
                    data-label={c.header}
                    data-key={c.key}
                    style={{
                      ...cell,
                      textAlign: c.align || "left",
                      color: "var(--tk-ink-500)",
                    }}
                  >
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
              {expanded && renderExpandedRow && (
                <tr className="tk-data-table-expanded">
                  <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ padding: 0, background: "var(--tk-surface-soft)" }}>
                    {renderExpandedRow(r)}
                  </td>
                </tr>
              )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
