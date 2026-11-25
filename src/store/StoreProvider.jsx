'use client';

import React from 'react';
import { Provider } from 'react-redux';
import { makeStore } from './store.js';

// No token refresh timer here any more: proxy.ts and the /api/backend route renew the session on the Next.js server.
export function StoreProvider({ children, initialAdmin = null }) {
  const [store] = React.useState(() => makeStore(initialAdmin));
  return <Provider store={store}>{children}</Provider>;
}