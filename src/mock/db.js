// Tiny in-memory, pub/sub "database" the mock API layer reads and writes.
// Shaped so swapping api.js for real network calls later doesn't touch the
// components that call it — see HANDOFF.md, "Mock data contract".
const state = {};
const listeners = new Map();

function emit(domain) {
  (listeners.get(domain) || new Set()).forEach(fn => fn());
}

export function seed(domain, rows) {
  state[domain] = rows;
}

export function getSnapshot(domain) {
  return state[domain];
}

export function subscribe(domain, fn) {
  if (!listeners.has(domain)) listeners.set(domain, new Set());
  listeners.get(domain).add(fn);
  return () => listeners.get(domain).delete(fn);
}

export function setRows(domain, rows) {
  state[domain] = rows;
  emit(domain);
}

export function patchRow(domain, idKey, id, changes) {
  state[domain] = (state[domain] || []).map(r => (r[idKey] === id ? { ...r, ...changes } : r));
  emit(domain);
  return state[domain].find(r => r[idKey] === id);
}

export function prependRow(domain, row) {
  state[domain] = [row, ...(state[domain] || [])];
  emit(domain);
  return row;
}

export function getRow(domain, idKey, id) {
  return (state[domain] || []).find(r => r[idKey] === id);
}
