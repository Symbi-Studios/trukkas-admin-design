import { createSlice } from '@reduxjs/toolkit';
import { clearSession } from '../auth/authSlice.js';
import { currentReportRange, initialReportDraft } from './reportDraft.js';

// A client configuration draft, not a generated report or a saved server template.
const reportsSlice = createSlice({
  name: 'reports', initialState: initialReportDraft,
  reducers: {
    updateReportDraft(state, { payload }) {
      Object.assign(state, payload);
      if (payload.dateRangePreset && payload.dateRangePreset !== 'Custom Range') Object.assign(state, currentReportRange(payload.dateRangePreset));
      else if ('dateFrom' in payload || 'dateTo' in payload) state.dateRangePreset = 'Custom Range';
    },
    toggleReportColumn(state, { payload: { group, key } }) {
      const column = state.columnGroups.find((item) => item.group === group)?.columns.find((item) => item.key === key);
      if (column) column.checked = !column.checked;
    },
    setReportColumnGroup(state, { payload: { group, checked } }) {
      const columns = state.columnGroups.find((item) => item.group === group)?.columns || [];
      columns.forEach((column) => { column.checked = checked === true; });
    },
    setAllReportColumns(state, { payload }) {
      state.columnGroups.forEach((group) => group.columns.forEach((column) => { column.checked = payload === true; }));
    },
  },
  extraReducers: (builder) => builder.addCase(clearSession, () => initialReportDraft()),
});
export const reportActions = reportsSlice.actions;
export const reportsReducer = reportsSlice.reducer;
