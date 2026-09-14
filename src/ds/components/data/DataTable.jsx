import React from "react";
import { Checkbox } from "../forms/Checkbox.jsx";

/**
 * The console list table. Columns declare { key, header, width, align, render }.
 * Rows are 56px, separated by hairlines; the header row is uppercase-free 12px ink-400.
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
}) {
  const allOn = rows.length > 0 && selected.length === rows.length;
  const cell = {
    padding: "var(--tk-row-pad-y) var(--tk-row-pad-x)",
    verticalAlign: "middle",
  };
  return (
    <div className="tk-scroll" style={{ overflowX: "auto", ...style }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout,
          font: "var(--tk-body-weight) var(--tk-body-size)/var(--tk-body-lh) var(--tk-font-sans)",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--tk-line)" }}>
            {selectable && (
              <th
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
                style={{
                  ...cell,
                  width: c.width,
                  textAlign: c.align || "left",
                  font: "var(--tk-body-strong-weight) var(--tk-label-size)/var(--tk-label-lh) var(--tk-font-sans)",
                  color: "var(--tk-ink-400)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  backgroundColor: coloredHeader
                    ? "var(--tk-surface-soft)"
                    : "transparent",
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
            return (
              <tr
                key={k}
                onClick={() => onRowClick?.(r)}
                style={{
                  borderBottom: "1px solid var(--tk-line)",
                  background: on ? "var(--tk-surface-soft)" : "transparent",
                  cursor: onRowClick ? "pointer" : "default",
                }}
              >
                {selectable && (
                  <td style={cell} onClick={(e) => e.stopPropagation()}>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
