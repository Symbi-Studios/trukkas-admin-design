import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * Toolbar filter as a rounded chip.
 * - Plain: `label` reads "All Status", "All Types".
 * - Prefixed: pass `prefix="Status"`; when `active`, it reads "Status: Delivered" (label = current value).
 * - Pass `onClear` to show a small × that resets just this filter while it's active.
 * - Pass `expanded` while its menu is open. `icon` is accepted for older call sites and not drawn:
 *   the words already say what each filter is.
 */
export function FilterSelect({ label, prefix, icon: _icon, active = false, expanded, onClick, onClear, style }) {
  const clearable = active && typeof onClear === 'function';
  return (
    <span className={'tk-filter-chip' + (active ? ' active' : '') + (clearable ? ' clearable' : '')} style={style}>
      <button type="button" className="tk-filter-chip-main" aria-haspopup="menu" aria-expanded={expanded} onClick={onClick}>
        {prefix
          ? <><span>{prefix}{active ? ':' : ''}</span>{active && <strong title={typeof label === 'string' ? label : undefined}>{label}</strong>}</>
          : <span>{label}</span>}
        <Icon name="chevron-down" size={14} className="tk-filter-chip-caret" aria-hidden="true" />
      </button>
      {clearable && (
        <button type="button" className="tk-filter-chip-clear" aria-label={'Clear ' + (prefix || 'filter')} onClick={onClear}>
          <Icon name="x" size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
