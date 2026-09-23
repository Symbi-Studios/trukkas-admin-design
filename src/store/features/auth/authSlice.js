import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  admin: null,
  accessToken: null,
  refreshToken: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      const { admin, accessToken, refreshToken } = action.payload;
      if (admin !== undefined) state.admin = admin;
      if (accessToken) state.accessToken = accessToken;
      if (refreshToken) state.refreshToken = refreshToken;
    },
    clearSession() {
      return initialState;
    },
  },
});

export const { setCredentials, clearSession } = authSlice.actions;
export const authReducer = authSlice.reducer;
