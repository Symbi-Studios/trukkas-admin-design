import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

// Ports & terminals setup for Settings. No prices here: terminal handling fees and
// per-port rates live in Finance › Pricing (Agent Brain, section 07).

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
const count = (value) => Number.isSafeInteger(number(value)) && number(value) >= 0 ? number(value) : null;
const bool = (value) => typeof value === 'boolean' ? value : null;
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });

function dateLabel(value) {
  const parsed = text(value) ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

function adaptPort(dto) {
  const counts = dto?._count && typeof dto._count === 'object' ? dto._count : {};
  return {
    id: dto.id,
    name: text(dto.name) || '—',
    state: text(dto.state),
    isActive: bool(dto.isActive),
    terminalCount: count(counts.terminals),
    jobCount: count(counts.jobs),
    created: dateLabel(dto.createdAt),
    updated: dateLabel(dto.updatedAt),
  };
}

function adaptTerminal(dto) {
  return {
    id: dto.id,
    portId: text(dto.portId),
    name: text(dto.name) || '—',
    latitude: number(dto.latitude),
    longitude: number(dto.longitude),
    isActive: bool(dto.isActive),
  };
}

function coordinate(value, limit) {
  const parsed = number(value);
  return parsed != null && Math.abs(parsed) <= limit ? parsed : null;
}

/** Validates one terminal row from the form and returns the request fields. */
export function terminalFields({ name, latitude, longitude, isActive = true }) {
  const lat = coordinate(latitude, 90), lng = coordinate(longitude, 180);
  if (!text(name)) throw new Error('Give every terminal a name.');
  if (lat == null || lng == null) throw new Error('Enter a valid latitude (−90 to 90) and longitude (−180 to 180) for every terminal.');
  return { name: name.trim(), latitude: lat, longitude: lng, isActive: Boolean(isActive) };
}

export const portsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminPorts'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminPorts: builder.query({
      query: () => ({ url: '/admin/reference/ports' }),
      transformResponse: (response) => {
        const ports = unwrapApiResponseData(response)?.ports;
        if (!Array.isArray(ports) || ports.some((port) => !text(port?.id))) throw new Error('The ports list could not be loaded. Please refresh.');
        return ports.map(adaptPort).sort((a, b) => a.name.localeCompare(b.name));
      },
      providesTags: ['AdminPorts'],
    }),
    getAdminPortTerminals: builder.query({
      query: (portId) => ({ url: `/admin/reference/ports/${encodeURIComponent(portId)}/terminals` }),
      transformResponse: (response, _meta, portId) => {
        const dto = unwrapApiResponseData(response);
        if (!Array.isArray(dto?.terminals) || dto.terminals.some((row) => !text(row?.id) || (row.portId && row.portId !== portId))) throw new Error('The terminals for this port could not be loaded. Please refresh.');
        return dto.terminals.map(adaptTerminal).sort((a, b) => a.name.localeCompare(b.name));
      },
      providesTags: ['AdminPorts'],
    }),
    getAdminPortStates: builder.query({
      query: () => ({ url: '/admin/pricing/states' }),
      transformResponse: (response) => {
        const dto = unwrapApiResponseData(response);
        // Live response: data is [{ name: "Abia" }, …]; plain strings are accepted too.
        const list = Array.isArray(dto) ? dto : Array.isArray(dto?.data) ? dto.data : dto?.states;
        const rows = list?.map((row) => text(row) || text(row?.name));
        if (!Array.isArray(rows) || !rows.length || rows.some((row) => !row)) throw new Error('The list of states could not be loaded.');
        return rows.map((value) => ({ value, label: value }));
      },
    }),
    createAdminPort: builder.mutation({
      queryFn: async ({ name, state, terminals }, _api, _options, baseQuery) => {
        let body;
        try {
          if (!text(name)) throw new Error('Enter a port name.');
          if (!Array.isArray(terminals) || !terminals.length) throw new Error('Add at least one terminal.');
          body = { name: name.trim(), ...(text(state) ? { state: state.trim() } : {}), terminals: terminals.map(terminalFields) };
        } catch (error) { return failure(error.message); }
        // PROPOSED: not in the live API yet. See "Backend request: per-port pricing".
        // The live POST takes name and state only; `terminals` (at least one) is proposed (a2).
        const result = await baseQuery({ url: '/admin/reference/ports', method: 'POST', body });
        return result.error ? result : { data: unwrapApiResponseData(result.data) };
      },
      invalidatesTags: ['AdminPorts', 'AdminTerminalRates'],
    }),
    updateAdminPort: builder.mutation({
      queryFn: async ({ id, ...changes }, _api, _options, baseQuery) => {
        if (!text(id)) return failure('This port could not be identified. Refresh and try again.');
        const body = {};
        if ('name' in changes) { if (!text(changes.name)) return failure('Enter a port name.'); body.name = changes.name.trim(); }
        if ('state' in changes && text(changes.state)) body.state = changes.state.trim();
        if ('isActive' in changes) body.isActive = Boolean(changes.isActive);
        const result = await baseQuery({ url: `/admin/reference/ports/${encodeURIComponent(id)}`, method: 'PATCH', body });
        return result.error ? result : { data: unwrapApiResponseData(result.data) };
      },
      invalidatesTags: ['AdminPorts', 'AdminTerminalRates'],
    }),
    deleteAdminPort: builder.mutation({
      queryFn: async ({ id }, _api, _options, baseQuery) => {
        if (!text(id)) return failure('This port could not be identified. Refresh and try again.');
        // PROPOSED: not in the live API yet. See "Backend request: per-port pricing".
        const result = await baseQuery({ url: `/admin/reference/ports/${encodeURIComponent(id)}`, method: 'DELETE' });
        return result.error ? result : { data: { id, deleted: true } };
      },
      invalidatesTags: ['AdminPorts', 'AdminTerminalRates'],
    }),
    createAdminTerminal: builder.mutation({
      queryFn: async ({ portId, ...fields }, _api, _options, baseQuery) => {
        let body;
        try { body = terminalFields(fields); } catch (error) { return failure(error.message); }
        if (!text(portId)) return failure('Choose the port this terminal belongs to.');
        // PROPOSED: not in the live API yet. See "Backend request: per-port pricing".
        // The live POST takes `name` only; latitude, longitude and isActive on create are proposed (a5).
        const result = await baseQuery({ url: `/admin/reference/ports/${encodeURIComponent(portId)}/terminals`, method: 'POST', body });
        return result.error ? result : { data: unwrapApiResponseData(result.data) };
      },
      invalidatesTags: ['AdminPorts', 'AdminTerminalRates'],
    }),
    updateAdminTerminal: builder.mutation({
      queryFn: async ({ id, ...changes }, _api, _options, baseQuery) => {
        if (!text(id)) return failure('This terminal could not be identified. Refresh and try again.');
        let body = {};
        if ('isActive' in changes && Object.keys(changes).length === 1) body = { isActive: Boolean(changes.isActive) };
        else { try { body = terminalFields(changes); } catch (error) { return failure(error.message); } }
        const result = await baseQuery({ url: `/admin/reference/terminals/${encodeURIComponent(id)}`, method: 'PATCH', body });
        return result.error ? result : { data: unwrapApiResponseData(result.data) };
      },
      invalidatesTags: ['AdminPorts', 'AdminTerminalRates'],
    }),
  }),
});

export const {
  useGetAdminPortsQuery, useGetAdminPortTerminalsQuery, useGetAdminPortStatesQuery,
  useCreateAdminPortMutation, useUpdateAdminPortMutation, useDeleteAdminPortMutation,
  useCreateAdminTerminalMutation, useUpdateAdminTerminalMutation,
} = portsApi;
