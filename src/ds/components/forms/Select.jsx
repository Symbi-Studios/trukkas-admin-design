import React from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../assets/icons/Icon.jsx';

export function Select({ label, options = [], value, onChange, placeholder = 'Select…', leadingDot, disabled, style, id, name, required, ...rest }) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [position, setPosition] = React.useState(null);
  const trigger = React.useRef(null), menu = React.useRef(null);
  const searchRef = React.useRef({ text: '', at: 0 });
  const generatedId = React.useId();
  const listId = generatedId + '-options';
  const choices = options.map(option => typeof option === 'string' ? { value: option, label: option } : option);
  const selected = choices.find(option => String(option.value) === String(value));
  React.useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!trigger.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const upward = below < 180 && above > below;
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: Math.min(rect.width, window.innerWidth - 16), top: upward ? undefined : rect.bottom + 4, bottom: upward ? window.innerHeight - rect.top + 4 : undefined, maxHeight: Math.max(80, Math.min(260, (upward ? above : below) - 12)) });
    };
    const outside = event => { if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false); };
    update();
    window.addEventListener('scroll', update, true); window.addEventListener('resize', update); document.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  React.useEffect(() => { if (open) menu.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [open, active]);
  function choose(option) {
    if (!option || option.disabled) return;
    onChange?.({ target: { value: option.value, name }, currentTarget: { value: option.value, name } });
    setOpen(false); trigger.current?.focus();
  }
  function move(direction) {
    if (!choices.length) return;
    let index = active;
    for (let n = 0; n < choices.length; n++) { index = (index + direction + choices.length) % choices.length; if (!choices[index].disabled) { setActive(index); break; } }
  }
  function keyDown(event) {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!open) { setActive(Math.max(0, choices.findIndex(o => String(o.value) === String(value)))); setOpen(true); } else move(event.key === 'ArrowDown' ? 1 : -1); }
    else if ((event.key === 'Enter' || event.key === ' ') && open) { event.preventDefault(); choose(choices[active]); }
    else if (event.key === 'Tab') setOpen(false);
    else if (event.key === 'Home' && open) { event.preventDefault(); setActive(Math.max(0, choices.findIndex(option => !option.disabled))); }
    else if (event.key === 'End' && open) { event.preventDefault(); for (let i = choices.length - 1; i >= 0; i--) if (!choices[i].disabled) { setActive(i); break; } }
    else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now(); const query = (now - searchRef.current.at > 700 ? '' : searchRef.current.text) + event.key.toLowerCase();
      searchRef.current = { text: query, at: now };
      const index = choices.findIndex(option => !option.disabled && String(option.label).toLowerCase().startsWith(query));
      if (index >= 0) { event.preventDefault(); setActive(index); setOpen(true); }
    }
  }
  return <div className="tk-field tk-select-field" style={{ display: 'grid', gap: 6, minWidth: 0, ...style }}>
    {label && <label htmlFor={id || generatedId} style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{label}</label>}
    <button {...rest} id={id || generatedId} ref={trigger} type="button" role="combobox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-haspopup="listbox" aria-activedescendant={open ? listId + '-' + active : undefined} aria-required={required || undefined} disabled={disabled} onKeyDown={keyDown} onClick={() => { setActive(Math.max(0, choices.findIndex(o => String(o.value) === String(value)))); setOpen(o => !o); }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0, height: 'var(--tk-h-input)', padding: '0 12px', textAlign: 'left', background: disabled ? 'var(--tk-surface-sunk)' : '#fff', border: '1px solid ' + (open ? 'var(--tk-blue)' : 'var(--tk-line-strong)'), borderRadius: 'var(--tk-r-md)', boxShadow: open ? 'var(--tk-focus-ring)' : 'none', cursor: disabled ? 'default' : 'pointer', font: '400 14px/20px var(--tk-font-sans)', color: selected ? 'var(--tk-ink-900)' : 'var(--tk-ink-300)' }}>
      {leadingDot && <span style={{ width: 8, height: 8, borderRadius: 999, background: leadingDot, flex: '0 0 auto' }} />}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected?.label ?? placeholder}</span><Icon name="chevron-down" size={16} color="var(--tk-ink-400)" />
    </button>
    {(name || required) && <select aria-hidden="true" tabIndex={-1} name={name} required={required} disabled={disabled} value={value ?? ''} onChange={() => {}} onInvalid={event => { event.preventDefault(); trigger.current?.focus(); }} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}><option value="" />{choices.filter(option => String(option.value) !== '').map(option => <option key={String(option.value)} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select>}
    {open && position && createPortal(<div ref={menu} id={listId} role="listbox" style={{ position: 'fixed', zIndex: 1000, ...position, overflowY: 'auto', background: 'var(--tk-surface)', border: '1px solid var(--tk-line-strong)', borderRadius: 'var(--tk-r-md)', boxShadow: 'var(--tk-shadow-menu)', padding: 4 }}>
      {choices.map((option, index) => <div id={listId + '-' + index} key={String(option.value)} role="option" aria-selected={String(option.value) === String(value)} aria-disabled={option.disabled || undefined} data-active={active === index} onMouseMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)} style={{ padding: '9px 10px', borderRadius: 'var(--tk-r-sm)', cursor: option.disabled ? 'default' : 'pointer', background: active === index ? 'var(--tk-surface-sunk)' : 'transparent', color: option.disabled ? 'var(--tk-ink-300)' : 'var(--tk-ink-900)', font: '400 13px/18px var(--tk-font-sans)', overflowWrap: 'anywhere' }}>{option.label}</div>)}
    </div>, document.body)}
  </div>;
}

// Adapter for existing select markup so every dropdown uses the same menu.
export function CustomSelect({ children, defaultValue, value, style, className, ...props }) {
  const choices = React.Children.toArray(children).filter(React.isValidElement).map(option => ({ value: option.props.value ?? option.props.children, label: option.props.children, disabled: option.props.disabled }));
  const [internal, setInternal] = React.useState(defaultValue ?? choices[0]?.value ?? '');
  return <Select {...props} className={className} style={style} options={choices} value={value ?? internal} onChange={event => { setInternal(event.target.value); props.onChange?.(event); }} />;
}
