import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi.js';
import { authReducer } from './features/auth/authSlice.js';

// The App Router renders on the server too, so create a store per layout instance.
export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    // Tokens are kept in memory only; omit Redux DevTools state history.
    devTools: false,
  });
}
