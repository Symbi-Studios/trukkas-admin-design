'use client';
import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

const KEY = 'trukkas-theme';

function currentTheme() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Light / Dark switch. Saves the choice and applies data-theme on <html>. */
export function ThemeToggle({ compact = false }) {
  const [theme, setTheme] = React.useState('light');
  React.useEffect(() => { setTheme(currentTheme()); }, []);
  const apply = (next) => {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* private mode: still switch for this visit */ }
    setTheme(next);
  };
  if (compact) {
    const next = theme === 'dark' ? 'light' : 'dark';
    return (
      <button type="button" className="tk-theme-icon" onClick={() => apply(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>
    );
  }
  return (
    <div className="tk-theme-toggle" role="radiogroup" aria-label="Theme">
      {[['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']].map(([value, icon, label]) => (
        <button key={value} type="button" role="radio" aria-checked={theme === value} className={theme === value ? 'active' : undefined} onClick={() => apply(value)}>
          <Icon name={icon} size={15} />{label}
        </button>
      ))}
    </div>
  );
}
