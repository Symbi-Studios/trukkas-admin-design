import { baseApi } from '../../api/baseApi.js';
import { adaptPriceList, pricingRecord } from './pricingApi.js';

// Zone pricing = the backend's regional price lists: one price per destination state (optionally per
// cargo / equipment), used for any truck no rate card covers. Live lists can't be edited in place, so
// saving copies a live list into a draft, replaces its rows with the edited set and updates its header.
// The page then publishes the draft (usePublishPricing) so the change goes live in one step.

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const number = (value) => (value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
const record = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const fail = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const UNIT_LABELS = { PER_TRUCK: 'per truck', PER_KM: 'per km', PER_TONNE: 'per tonne' };
const root = '/admin/pricing/price-lists';

export function adaptZoneRate(value) {
  const dto = record(value);
  return {
    id: text(dto.id), destinationState: text(dto.destinationState) || '', cargoType: text(dto.cargoType) || '',
    containerSizeId: text(record(dto.containerSize).id) || text(dto.containerSizeId) || '', containerSize: text(record(dto.containerSize).name),
    containerTypeId: text(record(dto.containerType).id) || text(dto.containerTypeId) || '', containerType: text(record(dto.containerType).name),
    truckTypeId: text(record(dto.truckType).id) || text(dto.truckTypeId) || '', truckType: text(record(dto.truckType).name),
    unit: text(dto.unit) || 'PER_TRUCK', unitLabel: UNIT_LABELS[dto.unit] || text(dto.unit) || '',
    price: number(dto.price), minimumCharge: number(dto.minimumCharge), includedKm: number(dto.includedKm),
  };
}

export function adaptZone(dto) {
  return {
    ...adaptPriceList(dto), code: text(dto.code), description: text(dto.description) || '',
    originPortId: text(record(dto.originPort).id) || '', originState: text(dto.originState) || '',
    rates: Array.isArray(dto.rates) ? dto.rates.map(adaptZoneRate).filter((rate) => rate.id) : [],
  };
}

/** Request body for one rate row: only the criteria that are set. */
export function zoneRateBody(rate) {
  const body = { destinationState: rate.destinationState, unit: rate.unit, price: Number(rate.price) };
  for (const key of ['cargoType', 'containerSizeId', 'containerTypeId', 'truckTypeId']) if (text(rate[key])) body[key] = rate[key];
  if (number(rate.minimumCharge) != null) body.minimumCharge = Number(rate.minimumCharge);
  if (number(rate.includedKm) != null) body.includedKm = Number(rate.includedKm);
  return body;
}

async function readZone(baseQuery, id) {
  const result = await baseQuery({ url: root + '/' + encodeURIComponent(id) });
  if (result.error) return result;
  const dto = pricingRecord(result.data, 'price-lists');
  return dto.id === id ? { data: adaptZone(dto) } : fail('The zone response did not identify this zone. Refresh and try again.');
}

async function saveZone({ zone, header, rates }, _api, _options, baseQuery) {
  if (!text(header?.name) || !text(header?.region)) return fail('Give the zone a name and a region.');
  if (!rates?.length) return fail('Add at least one state rate.');
  if (rates.some((rate) => !text(rate.destinationState) || !(Number(rate.price) >= 0))) return fail('Every row needs a destination state and a price.');
  const headerBody = { name: header.name.trim(), region: header.region.trim(), ...(text(header.description) ? { description: header.description.trim() } : {}),
    ...(text(header.originPortId) ? { originPortId: header.originPortId } : {}), ...(text(header.originState) ? { originState: header.originState } : {}) };

  if (!zone) {
    const created = await baseQuery({ url: root, method: 'POST', body: { ...headerBody, rates: rates.map(zoneRateBody) } });
    if (created.error) return created;
    const id = text(pricingRecord(created.data, 'price-lists').id);
    return id ? readZone(baseQuery, id) : fail('The zone was created but its ID could not be confirmed. Refresh before trying again.');
  }

  // Edit a draft directly; copy anything else into a new draft first.
  let draftId = zone.id;
  if (zone.statusCode !== 'DRAFT') {
    const copy = await baseQuery({ url: root + '/' + encodeURIComponent(zone.id) + '/duplicate', method: 'POST' });
    if (copy.error) return copy;
    draftId = text(pricingRecord(copy.data, 'price-lists').id);
    if (!draftId) return fail('A draft copy could not be confirmed. Refresh before trying again.');
  }
  const draft = await readZone(baseQuery, draftId);
  if (draft.error) return draft;
  const patched = await baseQuery({ url: root + '/' + encodeURIComponent(draftId), method: 'PATCH', body: headerBody });
  if (patched.error) return patched;
  for (const rate of draft.data.rates) {
    const removed = await baseQuery({ url: `${root}/${encodeURIComponent(draftId)}/rates/${encodeURIComponent(rate.id)}`, method: 'DELETE' });
    if (removed.error) return removed;
  }
  for (const rate of rates) {
    const added = await baseQuery({ url: `${root}/${encodeURIComponent(draftId)}/rates`, method: 'POST', body: zoneRateBody(rate) });
    if (added.error) return added;
  }
  const saved = await readZone(baseQuery, draftId);
  if (saved.error) return saved;
  if (saved.data.rates.length !== rates.length) return fail('The zone was saved as a draft but not every rate was confirmed. Open it and check before publishing.');
  return saved;
}

export const zonePricingApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminPricingZone: builder.query({ queryFn: (id, _api, _options, baseQuery) => readZone(baseQuery, id), providesTags: ['AdminPricing'] }),
    saveAdminPricingZone: builder.mutation({ queryFn: saveZone, invalidatesTags: ['AdminPricing'] }),
  }),
});

export const { useGetAdminPricingZoneQuery, useSaveAdminPricingZoneMutation } = zonePricingApi;
