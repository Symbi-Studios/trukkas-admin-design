import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot } from './db.js';

/** Subscribes a component to one domain's rows. Re-renders on any patch/prepend/setRows. */
export function useCollection(domain) {
  return useSyncExternalStore(
    (onChange) => subscribe(domain, onChange),
    () => getSnapshot(domain),
    () => getSnapshot(domain),
  );
}
