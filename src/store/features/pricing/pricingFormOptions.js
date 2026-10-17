import { SERVICE_UNITS, SERVICE_CARGO, serviceStates } from './pricingServiceContracts.js';

const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;

export function adaptPricingFormOptions(dto) {
  const options = {};
  // /pricing/options contains active records only, without isActive flags.
  for (const key of ['ports', 'containerSizes', 'containerTypes', 'truckTypes']) {
    const rows = dto?.[key];
    if (!Array.isArray(rows) || rows.some(row => !text(row?.id) || !text(row?.name))
      || new Set(rows.map(row => row.id)).size !== rows.length) {
      throw new Error('The pricing options response is missing a valid ' + key + ' catalogue.');
    }
    options[key] = rows.map(row => ({ value: row.id, label: row.name }));
  }
  options.states = serviceStates(dto);
  for (const [key, supported] of [['units', SERVICE_UNITS], ['cargoTypes', SERVICE_CARGO]]) {
    const rows = dto?.[key];
    if (!Array.isArray(rows) || !rows.length || rows.some(row => !text(row?.value) || !text(row?.label)
      || !supported.some(option => option.value === row.value)) || new Set(rows.map(row => row.value)).size !== rows.length) {
      throw new Error('The pricing options response is missing supported ' + key + '.');
    }
    options[key] = rows.map(row => ({ value: row.value, label: row.label }));
  }
  if (dto?.currency !== 'NGN') throw new Error('The pricing options response did not confirm NGN currency.');
  return { ...options, currency: dto.currency };
}
