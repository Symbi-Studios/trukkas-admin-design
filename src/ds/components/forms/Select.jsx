import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

const shell = (invalid, focused, disabled) => ({
  display: 'flex', alignItems: 'center', gap: 8,
  height: 'var(--tk-h-input)', padding: '0 12px',
  background: disabled ? 'var(--tk-surface-sunk)' : '#fff',
  border: '1px solid ' + (invalid ? 'var(--tk-danger)' : focused ? 'var(--tk-blue)' : 'var(--tk-line-strong)'),
  borderRadius: 'var(--tk-r-md)',
  boxShadow: focused ? (invalid ? 'var(--tk-focus-ring-danger)' : 'var(--tk-focus-ring)') : 'none',
  transition: 'var(--tk-transition)',
});
const input = { flex: 1, border: 0, outline: 'none', background: 'transparent',
  font: '400 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)', minWidth: 0 };

export function Select({ label, options = [], value, onChange, placeholder = 'Select…',
                         leadingDot, disabled, style, ...rest }) {
  const [f, setF] = React.useState(false);
  return (
    <label className="tk-field tk-select-field" style={{ display: 'grid', gap: 6, ...style }}>
      {label && <span style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{label}</span>}
      <div style={{ ...shell(false, f, disabled), position: 'relative', paddingRight: 34 }}>
        {leadingDot && <span style={{ width: 8, height: 8, borderRadius: 999, background: leadingDot }} />}
        <select value={value} onChange={onChange} disabled={disabled}
                onFocus={() => setF(true)} onBlur={() => setF(false)} {...rest}
                style={{ ...input, appearance: 'none', cursor: 'pointer', height: '100%',
                         color: value ? 'var(--tk-ink-900)' : 'var(--tk-ink-300)' }}>
          {!value && <option value="">{placeholder}</option>}
          {options.map(o => {
            const v = typeof o === 'string' ? o : o.value;
            return <option key={v} value={v}>{typeof o === 'string' ? o : o.label}</option>;
          })}
        </select>
        <Icon name="chevron-down" size={16} color="var(--tk-ink-400)"
              style={{ position: 'absolute', right: 12, pointerEvents: 'none' }} />
      </div>
    </label>
  );
}
