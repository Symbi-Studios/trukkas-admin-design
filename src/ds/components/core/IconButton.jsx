import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

// fill / hover / text / border. Hover and press come from .tk-btn in styles.css.
const TONES = {
  ghost:   ['transparent', 'var(--tk-surface-sunk)', 'var(--tk-ink-400)', 'transparent'],
  sunk:    ['var(--tk-surface-sunk)', 'var(--tk-line)', 'var(--tk-ink-500)', 'transparent'],
  outline: ['var(--tk-surface)', 'var(--tk-surface-sunk)', 'var(--tk-ink-500)', 'var(--tk-line-strong)'],
  blue:    ['var(--tk-blue-soft)', 'var(--tk-blue-soft)', 'var(--tk-blue)', 'transparent'],
};

export function IconButton({ icon, size = 32, tone = 'ghost', label, className, style, ...rest }) {
  const [fill, hover, fg, bd] = TONES[tone] || TONES.ghost;
  return (
    <button type="button" aria-label={label || icon} {...rest}
      className={'tk-btn' + (className ? ' ' + className : '')}
      style={{
        '--tk-btn-fill': fill, '--tk-btn-fill-hover': hover, '--tk-btn-fill-press': hover,
        width: size, height: size, display: 'grid', placeItems: 'center',
        borderRadius: 'var(--tk-r-sm)', border: '1px solid ' + bd,
        background: 'var(--tk-btn-bg, var(--tk-btn-fill))',
        color: fg, cursor: 'pointer', ...style,
      }}>
      <Icon name={icon} size={Math.round(size * 0.5)} aria-hidden="true" />
    </button>
  );
}
