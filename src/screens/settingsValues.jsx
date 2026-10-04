'use client';

import { TextField, Textarea, Select, Switch, Checkbox } from '../ds.js';
import { DriverLoadingNotice } from './DriversLoading.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

// Retain the existing controls and their markup. Null/undefined are unknown,
// whereas false and zero are real values and must keep their normal rendering.
export function SettingsTextField(props) {
  return <TextField {...props} value={props.value ?? ''} placeholder={props.value == null ? '—' : props.placeholder} />;
}
export function SettingsTextarea(props) {
  return <Textarea {...props} value={props.value ?? '—'} />;
}
export function SettingsSelect(props) {
  const known = props.value != null && props.options?.some((option) => (typeof option === 'string' ? option : option.value) === props.value);
  return <Select {...props} value={known ? props.value : ''} placeholder={known ? props.placeholder : '—'} />;
}
export function SettingsSwitch(props) {
  return <Switch {...props} checked={props.checked === true} unknown={props.checked == null} />;
}
export function SettingsCheckbox(props) {
  return <Checkbox {...props} checked={props.checked === true} indeterminate={props.checked == null || props.indeterminate} />;
}
export function SettingsReadNotice({ error }) {
  return error ? <DriverLoadingNotice>{getApiErrorMessage(error)}</DriverLoadingNotice> : null;
}
