import React from 'react';
import { RouteStack } from '../patterns/RouteStack.jsx';
import { Badge } from '../core/Badge.jsx';

const ACTION_KEYS = new Set(['a', 'x', 'actions', 'action', 'menu', 'expand']);
const textOf = (value) => (value == null ? '' : String(value)).trim();

/** Fixed status lanes and compact cards, using the Jobs board's visual structure. */
export function DataBoard({ columns = [], rows = [], groupBy, groups = [], card, fields, onRowClick,
  rowKey = (row, index) => row.id ?? index, selectedKey, expandedRowKeys = [], renderExpandedRow, emptyLabel = 'No items' }) {
  const label = (row) => textOf(groupBy?.(row)) || 'Unavailable';
  const lanes = groups.map((group) => typeof group === 'string' ? { value: group, label: group } : group);
  // Keep unexpected server statuses visible without dropping records.
  rows.forEach((row) => { const value = label(row); if (!lanes.some((lane) => lane.value === value)) lanes.push({ value, label: value }); });
  const usable = columns.filter((column) => !ACTION_KEYS.has(column.key) && column.key !== 'status');
  const slots = card || { title: usable[0]?.key, body: fields || usable.slice(1, 3).map((column) => column.key), footer: usable.slice(3, 5).map((column) => column.key) };
  const render = (key, row) => {
    if (typeof key === 'function') return key(row);
    const column = columns.find((item) => item.key === key);
    return column ? column.render ? column.render(row) : row[key] ?? '—' : null;
  };
  const activate = (event, row) => {
    if (event.target.closest('a, button, input, select, textarea, [role="combobox"]')) return;
    onRowClick?.(row);
  };
  // Compute keys before grouping so index-based keys stay stable across lanes.
  const keyedRows = rows.map((row, index) => ({ row, key: rowKey(row, index) }));
  return <div className="tk-board tk-scroll">
    {lanes.map((lane) => {
      const items = keyedRows.filter(({ row }) => label(row) === lane.value);
      return <section className="tk-board-column" key={lane.value} aria-label={lane.label}>
        <header className="tk-board-column-head">
          <Badge tone={lane.tone} dot>{lane.label}</Badge>
          <span className="tk-count-pill">{items.length}</span>
        </header>
        <div className="tk-board-cards">
          {!items.length && <div className="tk-board-empty">{emptyLabel}</div>}
          {items.map(({ row, key }) => <React.Fragment key={key}>
            <div className={'tk-board-card' + (selectedKey != null && selectedKey === key ? ' active' : '')}
              role={onRowClick ? 'button' : undefined} tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? (event) => activate(event, row) : undefined}
              onKeyDown={onRowClick ? (event) => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onRowClick(row); } } : undefined}>
              <div className="tk-board-card-top">
                <div className="tk-board-card-title">{render(slots.title, row)}</div>
                {slots.value && <div className="tk-board-card-value">{render(slots.value, row)}</div>}
              </div>
              {slots.subtitle && <div className="tk-board-card-subtitle">{render(slots.subtitle, row)}</div>}
              {slots.route && <RouteStack {...slots.route(row)} />}
              {!!slots.body?.length && <div className="tk-board-card-body">{slots.body.map((field, index) => <div key={index}>{render(field, row)}</div>)}</div>}
              {!!slots.footer?.length && <div className="tk-board-card-foot">{slots.footer.map((field, index) => <div key={index}>{render(field, row)}</div>)}</div>}
            </div>
            {expandedRowKeys.includes(key) && renderExpandedRow?.(row)}
          </React.Fragment>)}
        </div>
      </section>;
    })}
  </div>;
}
