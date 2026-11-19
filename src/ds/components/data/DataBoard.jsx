import React from 'react';
import { RouteStack } from '../patterns/RouteStack.jsx';
import { Badge, TK_STATUS } from '../core/Badge.jsx';
import { Icon } from '../../assets/icons/Icon.jsx';
import { isMissing } from '../core/NotAvailable.jsx';

const TONE_INK = {
  success: 'var(--tk-success)', info: 'var(--tk-blue)', warning: 'var(--tk-warning)', danger: 'var(--tk-danger)',
  neutral: 'var(--tk-neutral)', purple: 'var(--tk-purple)', orange: 'var(--tk-orange-ink)', teal: 'var(--tk-teal)',
};
// Small leading glyphs for common card fields, keyed by the table column key.
const FIELD_ICONS = {
  date: 'calendar', updated: 'clock-3', joined: 'calendar', joinedOn: 'calendar', settledOn: 'calendar', lastActive: 'clock-3', eta: 'clock-3',
  license: 'id-card', licenseStatus: 'badge-check', truckPlate: 'truck', plate: 'truck', email: 'mail', contact: 'phone',
  job: 'briefcase', relatedTo: 'link-2', container: 'container', vessel: 'ship', description: 'align-left', d: 'align-left',
  entity: 'building-2', location: 'map-pin', driver: 'user-round', type: 'tag', jobType: 'tag', registrationType: 'tag', entityType: 'tag',
  category: 'folder', priority: 'flag', riskLevel: 'shield', verification: 'shield-check', bids: 'gavel', helpful: 'thumbs-up',
  channel: 'radio', action: 'zap', role: 'user-cog', daysUsed: 'calendar-days', daysOver: 'calendar-x', v: 'eye', delta: 'trending-up',
};
// A slot whose rendered value is empty or a bare dash is left off the card.
const shown = (node) => node != null && node !== false && !(typeof node === 'string' && isMissing(node))
  && !(React.isValidElement(node) && typeof node.props?.children === 'string' && isMissing(node.props.children));
const Field = ({ field, children, className }) => {
  const icon = typeof field === 'string' ? FIELD_ICONS[field] : field?.icon || null;
  return <div className={className}>{icon && <Icon name={icon} size={14} className="tk-board-field-icon" />}<div className="tk-board-field-value">{children}</div></div>;
};

const ACTION_KEYS = new Set(['a', 'x', 'actions', 'action', 'menu', 'expand']);
const textOf = (value) => (value == null ? '' : String(value)).trim();

/** Fixed status lanes and compact cards, using the Jobs board's visual structure. */
export function DataBoard({ columns = [], rows = [], groupBy, groups = [], card, fields, onRowClick,
  rowKey = (row, index) => row.id ?? index, selectedKey, hideEmpty = false, expandedRowKeys = [], renderExpandedRow, emptyLabel = 'No items' }) {
  const label = (row) => textOf(groupBy?.(row)) || 'Unavailable';
  const lanes = groups.map((group) => typeof group === 'string' ? { value: group, label: group } : group)
    .map((lane) => ({ ...lane, tone: lane.tone || TK_STATUS[lane.label] || 'neutral' }));
  // Keep unexpected server statuses visible without dropping records.
  rows.forEach((row) => { const value = label(row); if (!lanes.some((lane) => lane.value === value)) lanes.push({ value, label: value }); });
  const usable = columns.filter((column) => !ACTION_KEYS.has(column.key) && column.key !== 'status');
  const slots = card || { title: usable[0]?.key, body: fields || usable.slice(1, 3).map((column) => column.key), footer: usable.slice(3, 5).map((column) => column.key) };
  const render = (key, row) => {
    if (typeof key === 'function') return key(row);
    if (key && typeof key === 'object') return render(key.value, row);
    const column = columns.find((item) => item.key === key);
    return column ? column.render ? column.render(row) : row[key] ?? '—' : null;
  };
  const activate = (event, row) => {
    if (event.target.closest('a, button, input, select, textarea, [role="combobox"]')) return;
    onRowClick?.(row);
  };
  // Compute keys before grouping so index-based keys stay stable across lanes.
  const keyedRows = rows.map((row, index) => ({ row, key: rowKey(row, index) }));
  const visibleLanes = hideEmpty ? lanes.filter((lane) => keyedRows.some(({ row }) => label(row) === lane.value)) : lanes;
  return <div className="tk-board tk-scroll" style={{ '--tk-board-lane-count': Math.max(1, lanes.length), '--tk-board-gap-space': `${Math.max(0, lanes.length - 1) * 14}px` }}>
    {!visibleLanes.length && <div className="tk-board-empty">{emptyLabel}</div>}
    {visibleLanes.map((lane) => {
      const items = keyedRows.filter(({ row }) => label(row) === lane.value);
      return <section className="tk-board-column" key={lane.value} aria-label={lane.label}>
        <header className="tk-board-column-head">
          <span className="tk-board-lane-swatch" style={{ background: TONE_INK[lane.tone] || TONE_INK.neutral }} />
          <span className="tk-board-lane-label">{lane.label}</span>
          <span className="tk-board-lane-count">{items.length}</span>
        </header>
        <div className="tk-board-cards">
          {!items.length && <div className="tk-board-empty">{emptyLabel}</div>}
          {items.map(({ row, key }) => <React.Fragment key={key}>
            <div className={'tk-board-card' + (selectedKey != null && selectedKey === key ? ' active' : '')}
              role={onRowClick ? 'button' : undefined} tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? (event) => activate(event, row) : undefined}
              onKeyDown={onRowClick ? (event) => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onRowClick(row); } } : undefined}>
              <div className="tk-board-card-top">
                <Badge tone={lane.tone} dot>{lane.label}</Badge>
                {slots.value && shown(render(slots.value, row)) && <span className="tk-board-card-chip">{render(slots.value, row)}</span>}
              </div>
              <div className="tk-board-card-heading">
                <div className="tk-board-card-title">{render(slots.title, row)}</div>
                {slots.subtitle && shown(render(slots.subtitle, row)) && <div className="tk-board-card-subtitle">{render(slots.subtitle, row)}</div>}
              </div>
              {slots.route && <div className="tk-board-card-route"><RouteStack {...slots.route(row)} /></div>}
              {!!slots.body?.length && <div className="tk-board-card-body">{slots.body.filter((field) => shown(render(field, row))).map((field, index) => <Field key={index} field={field} className="tk-board-field">{render(field, row)}</Field>)}</div>}
              {!!slots.footer?.length && <div className="tk-board-card-foot">{slots.footer.filter((field) => shown(render(field, row))).map((field, index) => <Field key={index} field={field} className="tk-board-field">{render(field, row)}</Field>)}</div>}
            </div>
            {expandedRowKeys.includes(key) && renderExpandedRow?.(row)}
          </React.Fragment>)}
        </div>
      </section>;
    })}
  </div>;
}
