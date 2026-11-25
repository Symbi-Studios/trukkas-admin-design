import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { hasKoboPrecision } from '../../../lib/money.js';

// Per-port pricing (Agent Brain, section 07). Each port has a ₦/km rate and a minimum fee for
// every piece of equipment, a fuel surcharge per km and an optional peak multiplier. Terminal
// handling fees stay on the terminal and are edited with the existing terminal rate endpoint.

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const EQUIPMENT_TYPES = new Set(['CONTAINER_SIZE', 'TRUCK_TYPE']);
const PRICING_EDITORS = new Set(['SUPER_ADMIN', 'FINANCE_ADMIN']);
const RATE_FIELDS = ['ratePerKm', 'minimumFee'];
// Decided (section 06): the bulk-break truck types are Flatbed and Lowbed.
const BULK_TRUCKS = /flat\s*bed|low\s*bed/i;

function when(value) {
  const parsed = text(value) ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
}

export const equipmentKey = (type, id) => `${type}:${id}`;

function adaptEquipmentRate(value) {
  const dto = record(value), equipment = record(dto.equipment);
  const type = text(equipment.type) || text(dto.equipmentType), id = text(equipment.id) || text(dto.equipmentId);
  if (!EQUIPMENT_TYPES.has(type) || !id) return null;
  return { key: equipmentKey(type, id), type, id, name: text(equipment.name) || text(equipment.code) || '—', ratePerKm: number(dto.ratePerKm), minimumFee: number(dto.minimumFee) };
}

function adaptPortPricing(response, portId) {
  const body = record(unwrapApiResponseData(response));
  if (body.portId !== portId || body.port?.id !== portId || body.currency !== 'NGN' || !Array.isArray(body.equipmentRates)) {
    throw new Error('The pricing for this port could not be confirmed. Please refresh.');
  }
  const peak = record(body.peak);
  const fuel = number(body.fuelSurchargePerKm);
  return {
    portId,
    fuelSurchargePerKm: fuel,
    // The API treats an explicitly unset fuel surcharge as zero when quoting.
    effectiveFuelPerKm: body.fuelSurchargePerKm === null ? 0 : fuel,
    peakEnabled: typeof peak.enabled === 'boolean' ? peak.enabled : null,
    peakMultiplier: number(peak.multiplier),
    rates: body.equipmentRates.map(adaptEquipmentRate).filter(Boolean),
    updated: when(body.updatedAt),
    updatedBy: text(record(body.updatedBy).name) || text(body.updatedBy),
  };
}

/** The equipment a port is priced for: every container size plus the bulk truck types. */
export function pricedEquipment(options, rates = []) {
  const list = new Map();
  for (const row of options?.containerSizes || []) list.set(equipmentKey('CONTAINER_SIZE', row.value), { key: equipmentKey('CONTAINER_SIZE', row.value), type: 'CONTAINER_SIZE', id: row.value, name: row.label });
  for (const row of options?.truckTypes || []) if (BULK_TRUCKS.test(row.label)) list.set(equipmentKey('TRUCK_TYPE', row.value), { key: equipmentKey('TRUCK_TYPE', row.value), type: 'TRUCK_TYPE', id: row.value, name: row.label });
  // Keep any priced equipment the options list no longer returns, so its rate stays visible.
  for (const rate of rates) if (!list.has(rate.key)) list.set(rate.key, { key: rate.key, type: rate.type, id: rate.id, name: rate.name });
  const byKey = new Map(rates.map((rate) => [rate.key, rate]));
  return [...list.values()].map((item) => ({ ...item, ratePerKm: byKey.get(item.key)?.ratePerKm ?? null, minimumFee: byKey.get(item.key)?.minimumFee ?? null }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.type === 'CONTAINER_SIZE' ? -1 : 1));
}

const money = (value) => value === null || (hasKoboPrecision(value) && Number(value) >= 0);
export const validPeakMultiplier = (value) => /^\d+(?:\.\d{1,3})?$/.test(String(value)) && Number(value) >= 1 && Number(value) <= 5;
const price = (value) => value === null ? null : Number(value);

function matchesSavedPricing(saved, changes) {
  return ['fuelSurchargePerKm', 'peakEnabled', 'peakMultiplier'].every(
    (field) => !(field in changes) || saved[field] === changes[field],
  ) && (changes.equipmentRates ?? []).every((change) => {
    const rate = saved.rates.find((row) => row.key === equipmentKey(change.equipmentType, change.equipmentId));
    return rate && RATE_FIELDS.every((field) => !(field in change) || rate[field] === change[field]);
  });
}

export const portPricingApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminPortPricing'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminPricingPortList: builder.query({
      query: () => ({ url: '/admin/reference/ports' }),
      transformResponse: (response) => {
        const ports = unwrapApiResponseData(response)?.ports;
        if (!Array.isArray(ports) || ports.some((port) => !text(port?.id))) throw new Error('The ports list could not be loaded. Please refresh.');
        return ports.map((port) => ({ id: port.id, name: text(port.name) || '—', state: text(port.state), isActive: typeof port.isActive === 'boolean' ? port.isActive : null }))
          .sort((a, b) => (a.isActive === b.isActive ? a.name.localeCompare(b.name) : a.isActive ? -1 : 1));
      },
      providesTags: ['AdminTerminalRates'],
    }),
    getAdminPortPricing: builder.query({
      query: (portId) => ({ url: `/admin/pricing/ports/${encodeURIComponent(portId)}` }),
      transformResponse: (response, _meta, portId) => adaptPortPricing(response, portId),
      providesTags: (_result, _error, portId) => [{ type: 'AdminPortPricing', id: portId }],
    }),
    updateAdminPortPricing: builder.mutation({
      queryFn: async ({ portId, fuelSurchargePerKm, peakEnabled, peakMultiplier, equipmentRates }, api, _options, baseQuery) => {
        if (!text(portId)) return failure('Choose a port first.');
        if (!PRICING_EDITORS.has(api.getState().auth.admin?.role)) return failure('Only Super Admins and Finance Admins can change prices.');
        const body = {};
        if (fuelSurchargePerKm !== undefined) {
          if (!money(fuelSurchargePerKm)) return failure('Enter a fuel surcharge of ₦0 or more with up to two decimal places.');
          body.fuelSurchargePerKm = price(fuelSurchargePerKm);
        }
        if (typeof peakEnabled === 'boolean') body.peakEnabled = peakEnabled;
        if (peakMultiplier !== undefined) {
          if (peakMultiplier !== null && !validPeakMultiplier(peakMultiplier)) return failure('Enter a peak multiplier between 1 and 5 with up to three decimal places.');
          body.peakMultiplier = price(peakMultiplier);
        }
        if (equipmentRates !== undefined) {
          if (!Array.isArray(equipmentRates) || !equipmentRates.length || equipmentRates.some((row) => !EQUIPMENT_TYPES.has(row?.type) || !text(row.id)
            || !RATE_FIELDS.some((field) => row[field] !== undefined)
            || RATE_FIELDS.some((field) => row[field] !== undefined && !money(row[field])))) return failure('Enter rates of ₦0 or more with up to two decimal places.');
          body.equipmentRates = equipmentRates.map((row) => ({
            equipmentType: row.type, equipmentId: row.id,
            ...Object.fromEntries(RATE_FIELDS.filter((field) => row[field] !== undefined).map((field) => [field, price(row[field])])),
          }));
        }
        if (!Object.keys(body).length) return failure('Nothing to save.');
        const result = await baseQuery({ url: `/admin/pricing/ports/${encodeURIComponent(portId)}`, method: 'PATCH', body });
        if (result.error) return result;
        try {
          const saved = adaptPortPricing(result.data, portId);
          if (matchesSavedPricing(saved, body)) return { data: saved };
        } catch { /* The response did not identify the saved port pricing. */ }
        return failure('The saved prices could not be confirmed. Refresh and check before trying again.');
      },
      invalidatesTags: (_result, _error, { portId }) => [{ type: 'AdminPortPricing', id: portId }, 'AdminPricing'],
    }),
  }),
});

export const { useGetAdminPricingPortListQuery, useGetAdminPortPricingQuery, useUpdateAdminPortPricingMutation } = portPricingApi;

/**
 * One truck's fare from a port's rates, step by step (section 07):
 * distance × (rate + fuel) → at least the minimum → × peak → rounded to kobo.
 */
export function fareForTruck({ km, ratePerKm, fuelPerKm, minimumFee, peakMultiplier }) {
  if (![km, ratePerKm, fuelPerKm, minimumFee].every((value) => Number.isFinite(value) && value >= 0)) return null;
  const distanceFee = km * (ratePerKm + fuelPerKm);
  const base = Math.max(distanceFee, minimumFee);
  const peaked = peakMultiplier && peakMultiplier > 1 ? base * peakMultiplier : base;
  const fare = Math.round((peaked + peaked * Number.EPSILON) * 100) / 100;
  return Number.isFinite(fare) ? { distanceFee, base, usedMinimum: minimumFee > distanceFee, peaked, fare } : null;
}
