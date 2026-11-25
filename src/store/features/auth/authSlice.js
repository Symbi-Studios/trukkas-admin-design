import { createSlice } from '@reduxjs/toolkit';

// The tokens are NOT here any more. They live in httpOnly cookies that only the Next.js server can read.
// `signedIn` is only the browser's note that a session exists (it replaces the old `accessToken` checks).
const initialState = {
  admin: null,
  signedIn: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Only the admin matters here. Any token in the payload is ignored on purpose.
    setCredentials(state, action) {
      const { admin } = action.payload ?? {};
      if (admin !== undefined) state.admin = admin;
      state.signedIn = Boolean(state.admin);
    },
    clearSession() {
      return initialState;
    },
  },
});

export const { setCredentials, clearSession } = authSlice.actions;
export const authReducer = authSlice.reducer;