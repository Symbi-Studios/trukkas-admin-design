// Mock API for Settings → Fields Registration.
//
// THERE IS NO BACKEND FOR THIS YET. Each function below is named after, and
// returns the same shape as, the endpoint in docs/api/registration-fields.md.
// To wire the real API, replace each body with the request in its comment and
// keep the return shape — the screen only depends on these signatures and on
// useCollection('registrationFields').
import { seed, getSnapshot, setRows, patchRow, getRow } from './db.js';
import { registrationFields } from './fixtures/registrationFields.js';

const DOMAIN = 'registrationFields';
const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));
const KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

seed(DOMAIN, registrationFields);

function stamp() {
  return { updatedAt: new Date().toISOString(), updatedBy: 'Trukkas Admin' };
}

function fieldsFor(entity) {
  return (getSnapshot(DOMAIN) || []).filter((f) => f.entity === entity).sort((a, b) => a.order - b.order);
}

/** Mirrors the backend's 422 response: { message, errors: { [field]: message } }. */
export function validateRegistrationField(entity, draft, { ignoreId } = {}) {
  const errors = {};
  if (!draft.label?.trim()) errors.label = 'Field label is required.';
  else if (draft.label.trim().length > 80) errors.label = 'Keep the label under 80 characters.';
  if (!KEY_PATTERN.test(draft.key || '')) errors.key = 'Use 2–64 lowercase letters, numbers and underscores, starting with a letter.';
  else if (fieldsFor(entity).some((f) => f.key === draft.key && f.id !== ignoreId)) errors.key = 'Another field already uses this key.';
  if (!draft.type) errors.type = 'Choose a field type.';
  if (['select', 'multi_select'].includes(draft.type) && !(draft.options || []).length) errors.options = 'Add at least one option.';
  if ((draft.helpText || '').length > 200) errors.helpText = 'Help text is limited to 200 characters.';
  if (!Number.isInteger(Number(draft.order)) || Number(draft.order) < 1) errors.order = 'Display order must be a whole number from 1.';
  return errors;
}

/** Renumbers an entity's fields 1..n with `movedId` placed at `targetOrder`. */
function reorder(entity, movedId, targetOrder) {
  const list = fieldsFor(entity);
  const moved = list.find((f) => f.id === movedId);
  const rest = list.filter((f) => f.id !== movedId);
  const at = Math.max(0, Math.min(rest.length, targetOrder - 1));
  if (moved) rest.splice(at, 0, moved);
  const orderById = new Map(rest.map((f, i) => [f.id, i + 1]));
  setRows(DOMAIN, (getSnapshot(DOMAIN) || []).map((f) => (orderById.has(f.id) ? { ...f, order: orderById.get(f.id) } : f)));
}

// POST /admin/settings/registration-fields/:entity
export async function createRegistrationField(entity, draft) {
  await delay();
  const errors = validateRegistrationField(entity, draft);
  if (Object.keys(errors).length) throw { status: 422, message: 'Validation failed.', errors };
  const row = {
    visible: true, editable: true, enabled: true, required: false,
    placeholder: '', helpText: '', validation: 'none', options: [],
    ...draft,
    system: false,
    id: `${entity}_${draft.key}`,
    entity,
    order: fieldsFor(entity).length + 1,
    ...stamp(),
  };
  setRows(DOMAIN, [...(getSnapshot(DOMAIN) || []), row]);
  if (Number(draft.order) && Number(draft.order) !== row.order) reorder(entity, row.id, Number(draft.order));
  return getRow(DOMAIN, 'id', row.id);
}

// PATCH /admin/settings/registration-fields/:entity/:fieldId
export async function updateRegistrationField(entity, id, changes) {
  await delay();
  const current = getRow(DOMAIN, 'id', id);
  if (!current) throw { status: 404, message: 'Field not found.' };
  if (current.system && (changes.enabled === false || changes.required === false
    || (changes.key && changes.key !== current.key) || (changes.type && changes.type !== current.type))) {
    throw { status: 409, message: 'System fields cannot be disabled, made optional, or have their key or type changed.' };
  }
  const errors = validateRegistrationField(entity, { ...current, ...changes }, { ignoreId: id });
  if (Object.keys(errors).length) throw { status: 422, message: 'Validation failed.', errors };
  const { order, ...rest } = changes;
  patchRow(DOMAIN, 'id', id, { ...rest, ...stamp() });
  if (order != null && Number(order) !== current.order) reorder(entity, id, Number(order));
  return getRow(DOMAIN, 'id', id);
}

// PATCH /admin/settings/registration-fields/:entity/:fieldId  body: { enabled }
export async function setRegistrationFieldEnabled(entity, id, enabled) {
  return updateRegistrationField(entity, id, { enabled });
}

// DELETE /admin/settings/registration-fields/:entity/:fieldId
export async function deleteRegistrationField(entity, id) {
  await delay();
  if (getRow(DOMAIN, 'id', id)?.system) throw { status: 409, message: 'System fields cannot be deleted.' };
  setRows(DOMAIN, (getSnapshot(DOMAIN) || []).filter((f) => f.id !== id));
  const orderById = new Map(fieldsFor(entity).map((f, i) => [f.id, i + 1]));
  setRows(DOMAIN, (getSnapshot(DOMAIN) || []).map((f) => (orderById.has(f.id) ? { ...f, order: orderById.get(f.id) } : f)));
  return { id, deleted: true };
}

// PUT /admin/settings/registration-fields/:entity/order  body: { fieldIds: [...] }
export async function reorderRegistrationFields(entity, fieldIds) {
  await delay(80);
  const orderById = new Map(fieldIds.map((id, i) => [id, i + 1]));
  setRows(DOMAIN, (getSnapshot(DOMAIN) || []).map((f) => (f.entity === entity && orderById.has(f.id) ? { ...f, order: orderById.get(f.id) } : f)));
  return fieldsFor(entity);
}

// POST /admin/settings/registration-fields/:entity/:fieldId/duplicate
export async function duplicateRegistrationField(entity, id) {
  const source = getRow(DOMAIN, 'id', id);
  if (!source) throw { status: 404, message: 'Field not found.' };
  if (source.system) throw { status: 409, message: 'System fields cannot be duplicated.' };
  let key = `${source.key}_copy`;
  for (let n = 2; fieldsFor(entity).some((f) => f.key === key); n++) key = `${source.key}_copy_${n}`;
  return createRegistrationField(entity, { ...source, key, label: `${source.label} (Copy)`, order: source.order + 1 });
}

// PATCH /admin/settings/registration-fields/:entity/bulk  body: { fieldIds, changes }
export async function bulkUpdateRegistrationFields(entity, ids, changes) {
  await delay();
  const set = new Set(ids.filter((id) => !getRow(DOMAIN, 'id', id)?.system || (changes.enabled !== false && changes.required !== false)));
  setRows(DOMAIN, (getSnapshot(DOMAIN) || []).map((f) => (f.entity === entity && set.has(f.id) ? { ...f, ...changes, ...stamp() } : f)));
  return fieldsFor(entity).filter((f) => set.has(f.id));
}
