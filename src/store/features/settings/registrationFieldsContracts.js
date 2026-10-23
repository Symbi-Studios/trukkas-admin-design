import { unwrapApiResponseData } from '../../api/baseApi.js';
import { getApiErrorMessage } from '../../api/getApiErrorMessage.js';

const record = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const text = (v) => typeof v === 'string' && v.trim() ? v : null;
const string = (v) => typeof v === 'string' ? v : null;
const boolean = (v) => typeof v === 'boolean' ? v : null;
const positive = (v) => Number.isSafeInteger(v) && v > 0 ? v : null;
const strings = (v) => Array.isArray(v) && v.every((item) => typeof item === 'string') ? v : null;
const timestamp = (v) => text(v) && Number.isFinite(Date.parse(v)) ? v : null;
export const REGISTRATION_ENTITIES = [
  { value: 'driver', label: 'Driver Fields', singular: 'Driver', plural: 'drivers', icon: 'user' },
  { value: 'forwarder', label: 'Forwarder Fields', singular: 'Forwarder', plural: 'forwarders', icon: 'building-2' },
  { value: 'company', label: 'Company Fields', singular: 'Company', plural: 'companies', icon: 'building' },
];
export const registrationEntity = (v) => REGISTRATION_ENTITIES.some((item) => item.value === v);

export function adaptRegistrationField(response, entity) {
  const dto = record(unwrapApiResponseData(response));
  if (!text(dto.id) || dto.entity !== entity) throw new Error('The API returned an unconfirmed registration field. Reload before continuing.');
  return {
    id: dto.id, entity, label: text(dto.label), key: text(dto.key), type: text(dto.type), category: text(dto.category),
    placeholder: string(dto.placeholder), helpText: string(dto.helpText), validation: text(dto.validation),
    required: boolean(dto.required), visible: boolean(dto.visible), editable: boolean(dto.editable),
    enabled: boolean(dto.enabled), system: boolean(dto.system), options: strings(dto.options),
    order: positive(dto.order), updatedAt: timestamp(dto.updatedAt), updatedBy: text(dto.updatedBy),
  };
}
export function adaptRegistrationFields(response, entity) {
  const dto = record(unwrapApiResponseData(response));
  if (dto.entity !== entity || !Array.isArray(dto.fields)) throw new Error('The API did not return the registration fields collection.');
  const fields = dto.fields.map((field) => adaptRegistrationField(field, entity));
  if (new Set(fields.map((field) => field.id)).size !== fields.length) throw new Error('The API returned duplicate registration field IDs.');
  return fields.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
}
export function adaptRegistrationSummary(response) {
  const dto = record(unwrapApiResponseData(response));
  return Object.fromEntries(REGISTRATION_ENTITIES.map(({ value }) => [value, Number.isSafeInteger(dto[value]) && dto[value] >= 0 ? dto[value] : null]));
}
export function adaptRegistrationMeta(response) {
  const dto = record(unwrapApiResponseData(response));
  return Object.fromEntries(['types', 'categories', 'validationRules'].map((key) => {
    const options = dto[key];
    if (!Array.isArray(options) || options.some((o) => !text(o?.value) || !text(o?.label)) || new Set(options.map((o) => o.value)).size !== options.length) throw new Error('The API did not return complete registration field metadata.');
    return [key, options.map(({ value, label }) => ({ value, label }))];
  }));
}
export function validateRegistrationField(entity, draft, { ignoreId, fields = [], metadata } = {}) {
  const errors = {};
  if (!draft.label?.trim()) errors.label = 'Field label is required.';
  else if (draft.label.trim().length > 80) errors.label = 'Keep the label under 80 characters.';
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(draft.key || '')) errors.key = 'Use 2–64 lowercase letters, numbers and underscores, starting with a letter.';
  else if (fields.some((f) => f.key === draft.key && f.id !== ignoreId)) errors.key = 'Another field already uses this key.';
  if (!metadata?.types.some((o) => o.value === draft.type)) errors.type = 'Choose a field type.';
  if (!metadata?.categories.some((o) => o.value === draft.category)) errors.category = 'Choose a field category.';
  if (!metadata?.validationRules.some((o) => o.value === draft.validation)) errors.validation = 'Choose a validation rule.';
  if (['select', 'multi_select'].includes(draft.type) && !strings(draft.options)?.some((o) => o.trim())) errors.options = 'Add at least one option.';
  if ((draft.helpText || '').length > 200) errors.helpText = 'Help text is limited to 200 characters.';
  if (!positive(Number(draft.order))) errors.order = 'Display order must be a whole number from 1.';
  if (!registrationEntity(entity)) errors.form = 'Choose a registration form.';
  return errors;
}
// Allowlist wire properties; unchanged unknown values must not overwrite server data.
export function encodeRegistrationField(draft, original) {
  const body = {};
  for (const property of ['label', 'key', 'type', 'category', 'placeholder', 'helpText', 'required', 'visible', 'editable', 'enabled', 'validation', 'options', 'order']) {
    if (draft[property] == null) continue;
    const value = property === 'options' ? strings(draft.options)?.map((o) => o.trim()).filter(Boolean) : draft[property];
    if (value == null || (original && JSON.stringify(value) === JSON.stringify(original[property]))) continue;
    body[property] = value;
  }
  if (original) {
    if (!timestamp(original.updatedAt)) throw new Error('The API did not return the field version. Reload before saving.');
    body.expectedVersion = original.updatedAt;
  }
  return body;
}
export function registrationFieldsError(error) {
  const dto = record(error?.data), errors = {};
  for (const [key, value] of Object.entries(record(dto.errors))) {
    const message = Array.isArray(value) ? value.filter((v) => typeof v === 'string').join(' ') : text(value);
    if (message) errors[key] = message;
  }
  const message = error instanceof Error ? error.message : getApiErrorMessage(error);
  return { message, errors: { ...errors, form: message } };
}
