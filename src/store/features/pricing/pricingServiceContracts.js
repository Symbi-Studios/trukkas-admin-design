export const SERVICE_UNITS = [{ value: 'PER_TRUCK', label: 'Per Truck' }, { value: 'PER_KM', label: 'Per km' }, { value: 'PER_TONNE', label: 'Per Tonne' }];
export const SERVICE_CARGO = [{ value: 'CONTAINER', label: 'Container' }, { value: 'BULK_BREAK', label: 'Bulk / Break Bulk' }];
export const SERVICE_MOVEMENTS = [{ value: 'PORT_TO_DESTINATION', label: 'Port to Destination' }, { value: 'PORT_TO_PORT', label: 'Port to Port' }, { value: 'BULK_BREAK', label: 'Bulk / Break Bulk' }, { value: 'EXPORT', label: 'Export' }];
export const SERVICE_CRITERIA = ['cargoType', 'movementType', 'originPortId', 'originState', 'destinationPortId', 'destinationState', 'containerSizeId', 'containerTypeId', 'truckTypeId'];
export const SERVICE_CLEARABLE_CRITERIA = SERVICE_CRITERIA.filter(key => key !== 'cargoType');
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
export const pricingServiceRoles = new Set(['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN']);
export function serviceCore(dto) {
  return { name: text(dto.name), unit: text(dto.unit), basePrice: typeof dto.basePrice === 'number' && Number.isFinite(dto.basePrice) && dto.basePrice >= 0 ? dto.basePrice : null,
    ...Object.fromEntries(SERVICE_CRITERIA.filter(key => Object.hasOwn(dto, key)).map(key => [key, dto[key] === null ? null : text(dto[key]) ?? undefined])) };
}
export function serviceFormFields(draft, baseline) {
  const values = { name: draft.name.trim(), unit: draft.unit, basePrice: Number(draft.basePrice), cargoType: draft.cargoType };
  const cargoChanged = baseline && draft.cargoType !== baseline.cargoType;
  for (const key of SERVICE_CLEARABLE_CRITERIA) {
    const incompatible = draft.cargoType === 'CONTAINER' && key === 'truckTypeId'
      || draft.cargoType === 'BULK_BREAK' && ['containerSizeId', 'containerTypeId'].includes(key);
    if (incompatible) {
      // A cargo switch must explicitly clear the old equipment in the PATCH.
      if (cargoChanged) values[key] = null;
    } else if (draft[key]) values[key] = draft[key];
    else if (baseline && baseline[key] !== undefined) values[key] = null;
  }
  return baseline ? Object.fromEntries(Object.entries(values).filter(([key, value]) => baseline[key] !== value)) : values;
}
export function assertServiceEquipment(fields, current = {}) {
  const cargo = fields.cargoType || current.cargoType || 'CONTAINER';
  const incompatible = cargo === 'CONTAINER' ? ['truckTypeId'] : ['containerSizeId', 'containerTypeId'];
  if (incompatible.some(key => (Object.hasOwn(fields, key) ? fields[key] : current[key]) != null)) {
    throw new Error('Clear the incompatible equipment criteria in the same request when changing cargo type.');
  }
}
export function serviceBody(fields, creating) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || !Object.keys(fields).length) throw new Error('There are no pricing changes to save.');
  const body = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!['name', 'unit', 'basePrice', ...SERVICE_CRITERIA].includes(key)) throw new Error('Only supported service fields can be saved.');
    if (!creating && value === null && SERVICE_CLEARABLE_CRITERIA.includes(key)) {
      body[key] = null;
      continue;
    }
    if (key === 'basePrice') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Enter a valid non-negative base price.');
      body[key] = value;
    } else {
      const parsed = text(value);
      if (!parsed || key === 'name' && parsed.length > 120) throw new Error('Complete the service fields within their character limits.');
      const choices = { unit: SERVICE_UNITS, cargoType: SERVICE_CARGO, movementType: SERVICE_MOVEMENTS }[key];
      if (choices && !choices.some(option => option.value === parsed)) throw new Error('Choose a supported service unit, cargo or movement type.');
      body[key] = parsed;
    }
  }
  if (creating && ['name', 'unit', 'basePrice'].some(key => !Object.hasOwn(body, key))) throw new Error('Service, Unit and Base Price are required.');
  if (creating) assertServiceEquipment(body);
  return body;
}
export function serviceStates(dto) {
  const rows = Array.isArray(dto) ? dto : dto?.states;
  if (!Array.isArray(rows) || rows.some(row => !text(row)) || new Set(rows).size !== rows.length) throw new Error('The accepted pricing states were not returned as a valid catalogue.');
  return rows.map(value => ({ value, label: value }));
}
