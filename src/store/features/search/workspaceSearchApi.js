import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const joined = (...values) => values.map(text).filter(Boolean).join(' · ');
const url = (path, id) => `${path}${encodeURIComponent(id)}`;
const definitions = [
  { section: 'Jobs', path: '/admin/jobs', key: 'jobs', icon: 'briefcase-business', id: r => text(r.id), label: r => text(r.jobNumber), meta: r => text(r.route), target: id => url('/jobs/detail?id=', id) },
  { section: 'Trips', path: '/admin/trips', key: 'trips', icon: 'route', id: r => text(r.tripId), label: r => text(r.containerNumber) || text(r.jobNumber), meta: r => joined(r.jobNumber, r.route), target: id => url('/trips?tripId=', id), roles: ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'] },
  { section: 'Trucks', path: '/admin/doc-review/trucks', key: 'trucks', icon: 'truck', params: { tab: 'all' }, id: r => text(r.id), label: r => text(r.plateNumber), meta: r => text(r.truckerName), target: id => url('/fleet/detail?id=', id) },
  { section: 'Drivers', path: '/admin/users/drivers', key: 'users', icon: 'user-round', id: r => text(r.id), label: r => text(r.name) || joined(r.firstName, r.lastName), meta: r => joined(r.license?.number, r.linkedCompany?.name), target: id => url('/drivers/detail?id=', id) },
  { section: 'Truck Companies', path: '/admin/users/truckers', key: 'users', icon: 'building-2', params: { truckerType: 'COMPANY' }, id: r => text(r.id), label: r => text(r.name), meta: r => text(r.rcNumber), target: id => url('/companies/detail?id=', id) },
  { section: 'Forwarders', path: '/admin/users/forwarders', key: 'users', icon: 'users-round', id: r => text(r.id), label: r => text(r.name), meta: r => text(r.type), target: id => url('/forwarders/detail?id=', id) },
  { section: 'Payouts', path: '/admin/payout-requests', key: 'requests', icon: 'banknote', id: r => ['user_withdrawal', 'admin_payout'].includes(r.source) ? text(r.id) : null, label: r => text(r.reference), meta: r => text(r.beneficiary?.name), target: (id, r) => `${url('/payouts/detail?id=', id)}&source=${encodeURIComponent(r.source)}` },
];

const globalSearchApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getAdminWorkspaceSearch: builder.query({
      async queryFn({ owner, role, search }, api, _options, baseQuery) {
        const current = () => !api.signal.aborted && !!api.getState().auth.accessToken && api.getState().auth.admin?.id === owner && api.getState().auth.admin?.role === role;
        if (!current() || !text(search)) return { error: { status: 'CUSTOM_ERROR', error: 'Search is unavailable. Please try again.' } };
        const allowed = definitions.filter(def => !def.roles || def.roles.includes(role));
        const responses = await Promise.allSettled(allowed.map(def => baseQuery({ url: def.path, params: { ...def.params, search: search.trim(), page: 1, limit: 4 } })));
        if (!current()) return { error: { status: 'CUSTOM_ERROR', error: 'Your session changed. Please try again.' } };
        let unavailable = false;
        const groups = [];
        for (let index = 0; index < allowed.length; index++) {
          const def = allowed[index], settled = responses[index];
          if (settled.status !== 'fulfilled' || settled.value.error) { unavailable = true; continue; }
          const response = settled.value;
          const data = unwrapApiResponseData(response.data), rows = data?.[def.key];
          if (!Array.isArray(rows)) { unavailable = true; continue; }
          const items = rows.flatMap(row => {
            if (!row || typeof row !== 'object' || Array.isArray(row)) { unavailable = true; return []; }
            const id = def.id(row);
            if (!id) { unavailable = true; return []; }
            return [{ id, section: def.section, key: `${def.section}:${id}`, icon: def.icon, label: def.label(row) || id, meta: def.meta(row), tag: text(row.statusLabel) || text(row.displayStatus) || text(row.status), to: def.target(id, row) }];
          });
          if (items.length) groups.push({ section: def.section, total: Number.isSafeInteger(data?.pagination?.total) ? data.pagination.total : null, items });
        }
        return { data: { groups, unavailable } };
      },
      keepUnusedDataFor: 0,
    }),
  }),
});
export const { useGetAdminWorkspaceSearchQuery } = globalSearchApi;
