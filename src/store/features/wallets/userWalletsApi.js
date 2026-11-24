import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

// Finance › Wallets: the Trukkas wallet each forwarder, truck company and individual driver holds.
// There's no admin wallet list, so the directory reads a page of users (GET /admin/users or
// GET /admin/users/truckers)
// and fills each row's balance from GET /admin/users/{id}/profile (stats.walletBalance).

export const WALLET_PAGE_SIZE = 10;
// Drivers employed by a company have no wallet; their pay goes to the company.
// Individual drivers are TRUCKER accounts with truckerType INDIVIDUAL.
export const WALLET_ROLES = [
  {
    value: 'FORWARDER', label: 'Forwarders', single: 'Forwarder', roleCode: 'FORWARDER',
    url: '/admin/users', params: { role: 'FORWARDER' }, statuses: { active: 'active', suspended: 'suspended' },
    route: (id) => `/forwarders/detail?id=${encodeURIComponent(id)}`,
  },
  {
    value: 'COMPANY', label: 'Truck Companies', single: 'Truck company', roleCode: 'TRUCKER',
    url: '/admin/users/truckers', params: { truckerType: 'COMPANY' }, statuses: { active: 'ACTIVE', suspended: 'suspended' },
    route: (id) => `/companies/detail?id=${encodeURIComponent(id)}`,
  },
  {
    value: 'INDIVIDUAL', label: 'Individual Drivers', single: 'Individual driver', roleCode: 'TRUCKER',
    url: '/admin/users/truckers', params: { truckerType: 'INDIVIDUAL' }, statuses: { active: 'ACTIVE', suspended: 'suspended' },
    route: (id) => `/drivers/detail?id=${encodeURIComponent(id)}`,
  },
];

const record = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const money = (value) => {
  const n = typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
const words = (value) => text(value)?.toLowerCase().split(/[_\s]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') ?? '—';
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });

function when(value) {
  const date = text(value) ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return { date: '—', time: '—' };
  const fmt = (options) => new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', ...options }).format(date);
  return { date: fmt({ day: 'numeric', month: 'short', year: 'numeric' }), time: fmt({ hour: '2-digit', minute: '2-digit' }) };
}

function personName(dto) {
  return text(dto.businessName) ?? text([text(dto.firstName), text(dto.lastName)].filter(Boolean).join(' ')) ?? text(dto.name) ?? '—';
}

function adaptProfileWallet(response) {
  const dto = record(unwrapApiResponseData(response)), stats = record(dto.stats);
  // Each stat is either a bare number or { amount, changeThisWeek } depending on the role.
  const amount = (value) => money(record(value).amount ?? value);
  return {
    balance: amount(stats.walletBalance),
    earned: amount(stats.totalEarned),
    spent: amount(stats.totalSpent),
  };
}

async function directory(baseQuery, { role, search, status, page = 1 }) {
  const meta = WALLET_ROLES.find((item) => item.value === role);
  if (!meta) return failure('Select a wallet type.');
  const params = Object.fromEntries(Object.entries({ ...meta.params, search: text(search), status: meta.statuses[status] ?? null, page, limit: WALLET_PAGE_SIZE }).filter(([, v]) => v != null));
  const result = await baseQuery({ url: meta.url, params });
  if (result.error) return { error: result.error };
  const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination);
  if (!Array.isArray(dto.users)) return failure('The response is missing the user list.');
  const users = dto.users.filter((user) => text(user?.id));
  const profiles = await Promise.all(users.map((user) => baseQuery({ url: `/admin/users/${encodeURIComponent(user.id)}/profile` })));
  return {
    data: {
      total: count(pagination.total),
      pages: count(pagination.totalPages),
      rows: users.map((user, index) => {
        const wallet = profiles[index].error ? { balance: null, earned: null, spent: null } : adaptProfileWallet(profiles[index].data);
        return {
          id: user.id,
          name: personName(user),
          contact: text([text(user.firstName), text(user.lastName)].filter(Boolean).join(' ')),
          email: text(user.email),
          phone: text(user.phone),
          role: meta.single,
          roleCode: meta.roleCode,
          status: words(user.displayStatus ?? user.status),
          joined: when(user.createdAt ?? user.joinedAt).date,
          profileRoute: meta.route(user.id),
          walletError: Boolean(profiles[index].error),
          ...wallet,
        };
      }),
    },
  };
}

function adaptTransactions(response) {
  const dto = record(unwrapApiResponseData(response)), pagination = record(dto.pagination);
  if (!Array.isArray(dto.transactions)) return failure('The response is missing the transaction list.');
  return {
    data: {
      total: count(pagination.total ?? dto.total),
      pages: count(pagination.totalPages),
      rows: dto.transactions.filter((row) => text(row?.id)).map((row) => ({
        id: row.id,
        label: text(row.label) ?? words(row.type),
        type: words(row.type),
        typeCode: text(row.type),
        amount: money(row.amount),
        status: words(row.status),
        ...when(row.createdAt),
      })),
    },
  };
}

function adaptPayouts(response) {
  const dto = record(unwrapApiResponseData(response));
  if (!Array.isArray(dto.logs)) return failure('The response is missing the payout list.');
  return {
    data: dto.logs.filter((row) => text(row?.id)).map((row) => ({
      id: row.id,
      amount: money(row.amount),
      status: words(row.status),
      account: text(row.accountNumber) ? `•••• ${row.accountNumber.slice(-4)}` : '—',
      admin: text(record(row.admin).name) ?? '—',
      note: text(row.note),
      ...when(row.createdAt),
    })),
  };
}

export const userWalletsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminUserWallets'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminUserWallets: builder.query({
      queryFn: (args, _api, _options, baseQuery) => directory(baseQuery, args),
      providesTags: ['AdminUserWallets'],
    }),
    getAdminUserWalletTransactions: builder.query({
      async queryFn({ id, page = 1 }, _api, _options, baseQuery) {
        if (!text(id)) return failure('A user is required.');
        const result = await baseQuery({ url: `/admin/users/${encodeURIComponent(id)}/transactions`, params: { page, limit: 8 } });
        return result.error ? { error: result.error } : adaptTransactions(result.data);
      },
      providesTags: ['AdminUserWallets'],
    }),
    getAdminUserWalletPayouts: builder.query({
      async queryFn(id, _api, _options, baseQuery) {
        if (!text(id)) return failure('A user is required.');
        const result = await baseQuery({ url: '/admin/payouts', params: { userId: id, limit: 5 } });
        return result.error ? { error: result.error } : adaptPayouts(result.data);
      },
      providesTags: ['AdminUserWallets'],
    }),
  }),
});

export const { useGetAdminUserWalletsQuery, useGetAdminUserWalletTransactionsQuery, useGetAdminUserWalletPayoutsQuery } = userWalletsApi;
