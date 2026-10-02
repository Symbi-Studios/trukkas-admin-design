import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
const date = (value) => { const parsed = value ? new Date(value) : null; return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
const money = (value) => value == null ? '—' : `₦${value.toLocaleString('en-NG')}`;
const format = (value, unit) => value == null ? '—' : unit === 'NGN' ? money(value) : unit === 'NGN/day' ? `${money(value)}/day` : unit === 'NGN/km' ? `${money(value)}/km` : unit === '%' ? `${value}%` : `${value.toLocaleString('en-NG')} ${unit}`;

// Response paths are nested; POST /admin/config accepts these flat DTO keys.
const fields = [
  { key: 'platformFee', path: ['pricing', 'platformFee'], name: 'Platform Fee', description: 'Flat platform fee charged on every job', appliesTo: 'All jobs', unit: 'NGN', min: 0, group: 'fee', icon: 'coins' },
  { key: 'vatPercent', path: ['pricing', 'vatPercent'], name: 'VAT', description: 'VAT percentage applied to total job cost', appliesTo: 'All jobs', unit: '%', min: 0, max: 100, group: 'fee', icon: 'badge-percent' },
  { key: 'commissionPercent', path: ['pricing', 'commissionPercent'], name: 'Platform Commission', description: 'Commission charged on completed jobs', appliesTo: 'Completed jobs', unit: '%', min: 0, max: 100, group: 'fee', icon: 'badge-percent' },
  { key: 'withdrawalFeePercent', path: ['pricing', 'withdrawalFeePercent'], name: 'Withdrawal Fee', description: 'Platform fee on wallet withdrawals', appliesTo: 'Wallet withdrawals', unit: '%', min: 0, max: 10, group: 'fee', icon: 'wallet' },
  { key: 'depositFeePercent', path: ['pricing', 'depositFeePercent'], name: 'Deposit Fee', description: 'Platform fee on wallet deposits', appliesTo: 'Wallet deposits', unit: '%', min: 0, max: 10, group: 'fee', icon: 'wallet' },
  { key: 'demurrageRatePerDay', path: ['demurrage', 'ratePerDay'], name: 'Demurrage Rate', description: 'Daily charge for late offloading after the free window', appliesTo: 'Forwarder late offloading', unit: 'NGN/day', min: 0, group: 'fee', icon: 'hourglass' },
  { key: 'driverDemurrageRatePerDay', path: ['driverDemurrage', 'ratePerDay'], name: 'Driver Demurrage Rate', description: 'Daily deduction for delivery beyond ETA and the grace period', appliesTo: 'Trucker late delivery', unit: 'NGN/day', min: 0, group: 'fee', icon: 'hourglass' },
  { key: 'lateCancellationFee', path: ['cancellation', 'lateCancellationFee'], name: 'Late Cancellation Fee', description: 'Flat fee charged outside the free cancellation window', appliesTo: 'Late cancellations', unit: 'NGN', min: 0, group: 'fee', icon: 'circle-x' },
  { key: 'noShowFee', path: ['cancellation', 'noShowFee'], name: 'No-Show Fee', description: 'Flat fee charged when a driver does not show up', appliesTo: 'Driver no-shows', unit: 'NGN', min: 0, group: 'fee', icon: 'triangle-alert' },
  { key: 'minFeePercent', path: ['pricing', 'minFeePercent'], name: 'Minimum Fare', description: 'Minimum job fee as a percentage of recommended fare', unit: '%', min: 1, max: 100, group: 'rule', icon: 'shield-check' },
  { key: 'maxFeePercent', path: ['pricing', 'maxFeePercent'], name: 'Maximum Fare', description: 'Maximum bid or counter-offer as a percentage of recommended fare', unit: '%', min: 100, max: 500, group: 'rule', icon: 'shield-check' },
  { key: 'mobilizationPercent', path: ['escrow', 'mobilizationPercent'], name: 'Mobilization Payment', description: 'Percentage paid as mobilization; the remainder is the final payment', unit: '%', min: 0, max: 100, group: 'rule', icon: 'wallet' },
  { key: 'demurrageGracePeriodMinutes', path: ['demurrage', 'freeMinutes'], name: 'Offloading Free Window', description: 'Free window before forwarder demurrage starts', unit: 'minutes', min: 1, group: 'rule', icon: 'hourglass' },
  { key: 'driverDemurrageGracePeriodMinutes', path: ['driverDemurrage', 'freeMinutes'], name: 'Delivery Grace Period', description: 'Grace period added to the delivery ETA before driver demurrage', unit: 'minutes', min: 1, group: 'rule', icon: 'hourglass' },
  { key: 'freeCancellationWindowHours', path: ['cancellation', 'freeCancellationWindowHours'], name: 'Free Cancellation Window', description: 'Window within which cancellation is free of charge', unit: 'hours', min: 0, group: 'rule', icon: 'clock' },
  { key: 'defaultCurrency', path: ['platform', 'defaultCurrency'], name: 'Base Currency', description: 'Default platform currency', unit: 'currency', options: ['NGN', 'USD', 'GBP'], group: 'rule', icon: 'coins' },
];
export function adaptAdminPricingConfig(response) {
  const dto = unwrapApiResponseData(response)?.config;
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) throw new Error('The platform configuration response is missing its config object.');
  const rows = fields.map((field) => {
    const raw = field.path.reduce((value, part) => value?.[part], dto);
    const value = field.options ? text(raw) : number(raw);
    return { ...field, id: `config:${field.key}`, source: 'config', value, rate: field.options ? value || '—' : format(value, field.unit), iconTint: 'blue', status: value == null ? 'Unavailable' : 'Configured', effectiveFrom: '—', editable: value != null };
  });
  return { currency: text(dto.platform?.defaultCurrency), fees: rows.filter((row) => row.group === 'fee'), rules: rows.filter((row) => row.group === 'rule') };
}
export function pricingError(error) {
  if (error?.status === 401) return 'Your session has expired. Please sign in again.';
  if (error?.status === 403) return 'You do not have permission to access or change these pricing settings.';
  const message = unwrapApiResponseData(error?.data)?.message;
  return (Array.isArray(message) ? message.join(' ') : text(message)) || text(error?.error) || text(error?.message) || 'Unable to load pricing settings. Please try again.';
}
function validateValue(field, value) {
  if (!field) throw new Error('Unsupported pricing setting.');
  if (field.options) { if (!field.options.includes(value)) throw new Error('Select a supported currency.'); return value; }
  const parsed = number(value);
  if (parsed == null || parsed < field.min || (field.max != null && parsed > field.max)) throw new Error('Enter a valid value within the allowed range.');
  return parsed;
}
export const pricingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminPricingConfig: builder.query({ query: () => ({ url: '/admin/config' }), transformResponse: adaptAdminPricingConfig, providesTags: ['AdminPricingConfig'] }),
    getAdminPricingTerminalRates: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const result = await baseQuery({ url: '/admin/reference/ports' });
        if (result.error) return result;
        const ports = unwrapApiResponseData(result.data)?.ports;
        if (!Array.isArray(ports) || ports.some((port) => !text(port?.id))) return { error: { status: 'CUSTOM_ERROR', error: 'The ports response is missing valid port records.' } };
        const rows = [], warnings = [];
        for (let start = 0; start < ports.length; start += 4) {
          const results = await Promise.all(ports.slice(start, start + 4).map(async (port) => ({ port, result: await baseQuery({ url: `/admin/reference/ports/${encodeURIComponent(port.id)}/terminals` }) })));
          for (const { port, result: terminalResult } of results) {
            if (terminalResult.error?.status === 401) return { error: terminalResult.error };
            const terminals = unwrapApiResponseData(terminalResult.data)?.terminals;
            if (terminalResult.error || !Array.isArray(terminals) || terminals.some((terminal) => !text(terminal?.id))) { warnings.push(text(port.name) || port.id); continue; }
            for (const terminal of terminals) for (const [key, title, unit] of [['handlingFee', 'Terminal Handling Fee', 'NGN'], ['baseFeePerKm', 'Recommended Fare per km', 'NGN/km']]) {
              const value = number(terminal[key]);
              rows.push({ id: `terminal:${terminal.id}:${key}`, terminalId: terminal.id, key, name: `${title} · ${text(terminal.name) || 'Terminal'}`, description: `${text(port.name) || 'Port'} / ${text(terminal.name) || 'Terminal'}`, appliesTo: `${text(port.name) || 'Port'} / ${text(terminal.name) || 'Terminal'}`, source: 'terminal', value, unit, min: 0, rate: format(value, unit), effectiveFrom: '—', lastUpdated: date(terminal.updatedAt), status: terminal.isActive === true && port.isActive === true ? 'Active Terminal' : terminal.isActive === false || port.isActive === false ? 'Inactive Terminal / Port' : '—', icon: 'anchor', iconTint: 'blue', editable: value != null });
            }
          }
        }
        return { data: { rows, warnings } };
      }, providesTags: ['AdminTerminalRates'],
    }),
    updateAdminPricingConfig: builder.mutation({
      query: ({ key, value }) => ({ url: '/admin/config', method: 'POST', body: { [key]: validateValue(fields.find((field) => field.key === key), value) } }),
      invalidatesTags: ['AdminPricingConfig'],
    }),
    updateAdminPricingTerminalRate: builder.mutation({
      query: ({ id, key, value }) => {
        if (!text(id) || !['handlingFee', 'baseFeePerKm'].includes(key)) throw new Error('Unsupported terminal pricing setting.');
        return { url: `/admin/reference/terminals/${encodeURIComponent(id)}`, method: 'PATCH', body: { [key]: validateValue({ min: 0 }, value) } };
      }, invalidatesTags: ['AdminTerminalRates'],
    }),
  }),
});
export const { useGetAdminPricingConfigQuery, useGetAdminPricingTerminalRatesQuery, useUpdateAdminPricingConfigMutation, useUpdateAdminPricingTerminalRateMutation } = pricingApi;
