import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';
import { Tooltip } from '../feedback/Tooltip.jsx';
import { STATS_PERIODS, statsPeriod } from '../../../domain/statsPeriod.js';

/** Segmented 1 day / 7 days / Month / Quarter / All time switch for page stats. */
export function StatsPeriodToggle({ value, onChange, periods = STATS_PERIODS, disabled }) {
  return (
    <div className="tk-period-toggle" role="radiogroup" aria-label="Stats period">
      {periods.map((p) => (
        <button key={p.key} type="button" role="radio" aria-checked={value === p.key}
          className={value === p.key ? 'active' : undefined} disabled={disabled}
          title={p.summary} onClick={() => onChange?.(p.key)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The stats block at the top of a list page: a small header (title + what period the numbers
 * cover) with the period switch on the right, then the stat cards.
 *  - period/onPeriodChange: show the switch (the page's stats API supports a date range)
 *  - fixedLabel: no switch; say what the numbers cover instead ("All time", "This month")
 *  - stack: children are already laid out (e.g. two rows of cards); just stack them
 */


/**
 * @param {{
 *   title?: string,
 *   period?: any,
 *   onPeriodChange?: (value: any) => void,
 *   periods?: any,
 *   fixedLabel?: string,
 *   fixedHint?: string,
 *   columns?: any,
 *   stack?: boolean,
 *   children?: import('react').ReactNode,
 *   style?: import('react').CSSProperties,
 * }} props
 */


export function StatsPanel({ title = 'Overview', period = undefined, onPeriodChange = undefined, periods = undefined, fixedLabel = undefined, fixedHint = undefined, columns = undefined, stack = false, children, style = undefined }) {
  const p = period ? statsPeriod(period) : null;
  const caption = p ? (p.compare ? `${p.summary}, compared with ${p.compare}` : 'All time') : fixedLabel;
  return (
    <section className="tk-stats-panel" style={style} aria-label={title}>
      <header className="tk-stats-panel-head">
        <div className="tk-stats-panel-title">
          <h2>{title}</h2>
          {caption && <span>{caption}</span>}
        </div>
        {p && onPeriodChange
          ? <StatsPeriodToggle value={period} onChange={onPeriodChange} periods={periods} />
          : fixedLabel && (
            <Tooltip label={fixedHint || 'These totals cover all time; the stats for this page can’t be filtered by date yet.'}>
              <span className="tk-period-fixed" tabIndex={0}><Icon name="calendar" size={13} />{fixedLabel}</span>
            </Tooltip>
          )}
      </header>
      {stack
        ? <div className="tk-stats-stack">{children}</div>
        : <div className="tk-stats-grid" style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>{children}</div>}
    </section>
  );
}
