import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi.js';
import { authReducer } from './features/auth/authSlice.js';
import { reportsReducer } from './features/reports/reportsSlice.js';

// The App Router renders on the server too, so create a store per layout instance.
// `initialAdmin` comes from the httpOnly cookie, read by the root layout on the Next.js server.
export function makeStore(initialAdmin = null) {
  return configureStore({
    reducer: {
      auth: authReducer,
      reports: reportsReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    preloadedState: initialAdmin ? { auth: { admin: initialAdmin, signedIn: true } } : undefined,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    devTools: false,
  });
}