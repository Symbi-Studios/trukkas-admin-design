'use client';
import { DropdownMenu, FilterSelect } from '../ds.js';

/** Toolbar filter chip that opens a single-choice dropdown. Only one menu is open at a time via `open`/`setOpen`. */
export function FilterMenu({ name, icon, value, allValue, options, open, setOpen, onChange }) {
  return <span style={{ position: 'relative' }}>
    <FilterSelect icon={icon} prefix={name} label={value} active={value !== allValue}
      onClick={() => setOpen(open ? null : name)} onClear={() => { onChange(allValue); setOpen(null); }} />
    {open && <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
      <DropdownMenu width={220} items={[allValue, ...options].map((item) => ({
        label: item, icon: item === value ? 'check' : undefined, onClick: () => { onChange(item); setOpen(null); },
      }))} />
    </span>}
  </span>;
}
