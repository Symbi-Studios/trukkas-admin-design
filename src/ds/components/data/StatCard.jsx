import React from 'react';
import { Card } from '../core/Card.jsx';
import { Icon } from '../../assets/icons/Icon.jsx';

const TINT = {
  blue:   ['var(--tk-blue-soft)', 'var(--tk-blue)'],
  green:  ['var(--tk-success-soft)', 'var(--tk-success)'],
  amber:  ['var(--tk-warning-soft)', 'var(--tk-warning)'],
  red:    ['var(--tk-danger-soft)', 'var(--tk-danger)'],
  purple: ['var(--tk-purple-soft)', 'var(--tk-purple)'],
  teal:   ['var(--tk-teal-soft)', 'var(--tk-teal)'],
  navy:   ['var(--tk-neutral-soft)', 'var(--tk-navy)'],
};

/** The KPI tile that opens every console page: icon tile, label, big figure, delta or caption. */
export function StatCard({ icon, tint = 'blue', label, value, delta, direction = 'up',
                           caption, sparkline, layout = 'row', style }) {
  const [bg, fg] = TINT[tint] || TINT.blue;
  const good = direction === 'up';
  const tile = (
    <span style={{ width: 42, height: 42, borderRadius: 'var(--tk-r-lg)', background: bg, color: fg,
                   display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
      <Icon name={icon} size={20} />
    </span>
  );
  return (
    <Card style={{ display: 'grid', gap: 12, minWidth: 0, ...style }}>
      <div style={{ display: 'flex', flexDirection: layout === 'stack' ? 'column' : 'row',
                    alignItems: layout === 'stack' ? 'flex-start' : 'center', gap: 14, minWidth: 0 }}>
        {icon && tile}
        <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <span style={{ font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>{label}</span>
          <span className="tk-metric">{value}</span>
          {(delta || caption) && (
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2,
                           flexWrap: 'wrap', minWidth: 0 }}>
              {delta && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                               font: '600 12px/16px var(--tk-font-sans)', flex: '0 0 auto',
                               color: good ? 'var(--tk-success)' : 'var(--tk-danger)' }}>
                  <Icon name={good ? 'arrow-up' : 'arrow-down'} size={12} />{delta}
                </span>
              )}
              {caption && (
                <span style={{ font: '400 11px/15px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>
                  {caption}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      {sparkline}
    </Card>
  );
}
