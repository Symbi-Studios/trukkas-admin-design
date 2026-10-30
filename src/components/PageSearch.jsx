'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const PageSearchContext = createContext(null);

export function PageSearchProvider({ children }) {
  const [query, setQuery] = useState('');
  const [filtering, setFiltering] = useState(false);
  const handlers = useRef(new Map());
  const active = () => [...handlers.current.values()].at(-1);
  const register = useCallback((id, handler) => {
    handlers.current.set(id, handler);
    setFiltering(true);
    setQuery(handler.read());
    return () => {
      handlers.current.delete(id);
      const next = active();
      setFiltering(Boolean(next));
      setQuery(next?.read() || '');
    };
  }, []);
  const sync = useCallback((id, value) => {
    if ([...handlers.current.keys()].at(-1) === id) setQuery(value);
  }, []);
  const change = useCallback(value => {
    setQuery(value);
    active()?.write(value);
  }, []);
  return <PageSearchContext.Provider value={{ query, filtering, change, register, sync }}>{children}</PageSearchContext.Provider>;
}

export const usePageSearch = () => useContext(PageSearchContext);

export function matchesPageSearch(value, query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  const text = item => item == null ? '' : typeof item === 'object' ? Object.values(item).map(text).join(' ') : String(item);
  return text(value).toLocaleLowerCase().includes(needle);
}

// Preserve each screen's state and debounce/filter implementation. The active
// screen's existing search control and the navbar edit the same query.
export function usePageSearchState(initial = '', onChange, enabled = true) {
  const [value, setValue] = useState(initial);
  const context = usePageSearch();
  const id = useRef(Symbol('page-search'));
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const register = context?.register, sync = context?.sync;
  const update = useCallback(next => {
    const text = typeof next === 'function' ? next(latest.current.value) : next;
    latest.current.value = text;
    setValue(text);
    sync?.(id.current, text);
    latest.current.onChange?.(text);
  }, [sync]);
  useEffect(() => enabled ? register?.(id.current, { read: () => latest.current.value, write: update }) : undefined, [register, update, enabled]);
  return [value, update];
}

// Forms and detail pages have no record filter: search only the rendered page,
// without hiding fields, changing drafts or searching unopened records.
export function usePageTextSearch(query, enabled) {
  const matches = useRef([]), index = useRef(-1), selected = useRef(null);
  const clear = useCallback(() => {
    const selection = window.getSelection();
    if (selected.current && selection?.rangeCount && selection.getRangeAt(0) === selected.current) selection.removeAllRanges();
    selected.current = null;
  }, []);
  const find = useCallback(() => {
    const root = document.querySelector('main.tk-page-main');
    const needle = query.trim();
    const ranges = [];
    if (root && needle) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, parent = node.parentElement;
        if (!parent || parent.closest('script,style,textarea,input,select,[hidden],[aria-hidden="true"],[role="dialog"]') || !parent.getClientRects().length || getComputedStyle(parent).visibility === 'hidden') continue;
        const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
        for (const match of node.textContent.matchAll(pattern)) {
          const range = document.createRange();
          range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
          if (range.getClientRects().length) ranges.push(range);
        }
      }
    }
    matches.current = ranges;
    return ranges;
  }, [query]);
  const show = useCallback(range => {
    clear();
    if (!range) return;
    const selection = window.getSelection();
    selection?.removeAllRanges(); selection?.addRange(range);
    selected.current = range;
    range.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [clear]);
  useEffect(() => {
    clear(); matches.current = []; index.current = -1;
    if (!enabled || !query.trim()) return;
    const timer = setTimeout(() => { const ranges = find(); index.current = ranges.length ? 0 : -1; show(ranges[0]); }, 200);
    return () => { clearTimeout(timer); clear(); };
  }, [query, enabled, find, show, clear]);
  return event => {
    if (event.key === 'Escape') { clear(); return; }
    if (!enabled || event.key !== 'Enter' || !query.trim()) return;
    event.preventDefault();
    const ranges = find();
    event.currentTarget.setCustomValidity(ranges.length ? '' : 'No matches on this page.');
    if (!ranges.length) { event.currentTarget.reportValidity(); return; }
    index.current = (index.current + (event.shiftKey ? -1 : 1) + ranges.length) % ranges.length;
    show(ranges[index.current]);
  };
}
