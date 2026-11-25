import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

// fill / hover / press / text / border. Hover and press are applied by .tk-btn in styles.css
// through custom properties, so the inline style keeps its precedence over screen CSS.
const FILL = {
  primary:   ['var(--tk-blue)', 'var(--tk-blue-hover)', 'var(--tk-blue-press)', '#fff', 'transparent'],
  accent:    ['var(--tk-orange)', 'var(--tk-orange-hover)', 'var(--tk-orange-hover)', '#fff', 'transparent'],
  secondary: ['var(--tk-surface)', 'var(--tk-blue-soft)', 'var(--tk-blue-soft)', 'var(--tk-blue)', 'var(--tk-blue)'],
  outline:   ['var(--tk-surface)', 'var(--tk-surface-sunk)', 'var(--tk-line)', 'var(--tk-ink-700)', 'var(--tk-line-strong)'],
  ghost:     ['transparent', 'var(--tk-surface-sunk)', 'var(--tk-line)', 'var(--tk-ink-500)', 'transparent'],
  danger:    ['var(--tk-surface)', 'var(--tk-danger-soft)', 'var(--tk-danger-soft)', 'var(--tk-danger)', 'var(--tk-danger-soft)'],
};
const SIZE = { sm: { h: 'var(--tk-h-btn-sm)', px: 10, fs: 13, ic: 14 },
               md: { h: 'var(--tk-h-btn)',    px: 14, fs: 14, ic: 16 },
               lg: { h: 'var(--tk-h-btn-lg)', px: 18, fs: 15, ic: 18 } };

export function Button({
  variant = 'primary', size = 'md', icon, iconRight, disabled, loading = false, fullWidth,
  children, className, style, ...rest
}) {
  const [fill, hover, press, fg, bd] = FILL[variant] || FILL.primary;
  const s = SIZE[size] || SIZE.md;
  const off = disabled || loading;
  return (
    <button
      type="button" disabled={off} aria-busy={loading || undefined}
      {...rest}
      className={'tk-btn' + (className ? ' ' + className : '')}
      style={{
        '--tk-btn-fill': fill, '--tk-btn-fill-hover': hover, '--tk-btn-fill-press': press,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        height: s.h, padding: `0 ${s.px}px`, width: fullWidth ? '100%' : undefined,
        borderRadius: 'var(--tk-r-md)',
        border: '1px solid ' + (disabled ? 'transparent' : bd),
        background: disabled ? 'var(--tk-neutral-soft)' : 'var(--tk-btn-bg, var(--tk-btn-fill))',
        color: disabled ? 'var(--tk-ink-300)' : fg,
        font: `600 ${s.fs}px/1 var(--tk-font-sans)`,
        cursor: disabled ? 'not-allowed' : loading ? 'progress' : 'pointer', whiteSpace: 'nowrap',
        ...style,
      }}>
      {loading ? <span className="tk-btn-spinner" aria-hidden="true" style={{ width: s.ic, height: s.ic }} />
        : icon && <Icon name={icon} size={s.ic} aria-hidden="true" />}
      {children}
      {iconRight && <Icon name={iconRight} size={s.ic} aria-hidden="true" />}
    </button>
  );
}
