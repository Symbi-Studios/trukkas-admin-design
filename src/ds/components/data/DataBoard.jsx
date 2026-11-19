import React from "react";

const ACTION_KEYS = new Set(["a", "actions", "action", "menu"]);
const textOf = (value) => (value == null ? "" : String(value)).trim();

/**
 * Board (kanban) view of the same rows and columns a DataTable shows.
 * Rows are grouped into columns by `groupBy(row)`; each card shows the first column as its
 * title and the other columns as label/value pairs, so pages get a board for free.
 *  - groups: optional ordered group names; groups not listed are appended in the order they appear
 *  - fields: optional column keys to show on cards (default: every column except the first and actions)
 */
export function DataBoard({ columns = [], rows = [], groupBy, groups, fields, onRowClick, rowKey = (r, i) => r.id ?? i, selectedKey, expandedRowKeys = [], renderExpandedRow, emptyLabel = "Nothing here" }) {
  const label = (row) => textOf(groupBy?.(row)) || "Other";
  const order = [...(groups || [])];
  rows.forEach((row) => { const g = label(row); if (!order.includes(g)) order.push(g); });
  const [titleColumn, ...rest] = columns.filter((c) => !ACTION_KEYS.has(c.key));
  const shown = fields ? rest.filter((c) => fields.includes(c.key)) : rest;
  const render = (column, row) => (column.render ? column.render(row) : row[column.key] ?? "—");
  return (
    <div className="tk-board">
      {order.map((group) => {
        const items = rows.filter((row) => label(row) === group);
        return (
          <section className="tk-board-column" key={group} aria-label={group}>
            <header className="tk-board-column-head">
              <strong>{group}</strong>
              <span className="tk-count-pill">{items.length}</span>
            </header>
            <div className="tk-board-cards">
              {items.length === 0 && <div className="tk-board-empty">{emptyLabel}</div>}
              {items.map((row, i) => {
                const key = rowKey(row, i);
                const Tag = onRowClick ? "button" : "div";
                return (
                  <React.Fragment key={key}><Tag type={onRowClick ? "button" : undefined}
                    className={"tk-board-card" + (selectedKey != null && selectedKey === key ? " active" : "")}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}>
                    {titleColumn && <span className="tk-board-card-title">{render(titleColumn, row)}</span>}
                    {shown.length > 0 && (
                      <dl className="tk-board-card-fields">
                        {shown.map((column) => (
                          <div key={column.key}>
                            <dt>{column.header}</dt>
                            <dd>{render(column, row)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </Tag>{expandedRowKeys.includes(key) && renderExpandedRow?.(row)}</React.Fragment>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
