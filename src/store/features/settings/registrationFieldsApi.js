import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { adaptRegistrationField, adaptRegistrationFields, adaptRegistrationMeta, adaptRegistrationSummary, encodeRegistrationField, registrationEntity } from './registrationFieldsContracts.js';

const root = '/admin/settings/registration-fields';
const failure = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
const fieldTag = ({ owner, entity }) => ({ type: 'AdminRegistrationFields', id: `${owner}:${entity}` });
const summaryTag = ({ owner }) => ({ type: 'AdminRegistrationFields', id: `${owner}:summary` });
function guard(api, owner, write = false) {
  const actor = api.getState().auth.admin;
  if (!actor?.id || actor.id !== owner || !api.getState().auth.accessToken) throw new Error('Please sign in again before using Settings.');
  if (write && actor.role !== 'SUPER_ADMIN') throw new Error('Only Super Admins can change registration fields.');
  return () => {
    if (api.signal.aborted || api.getState().auth.admin !== actor || !api.getState().auth.accessToken) throw new Error('The admin session changed. Reload before continuing.');
  };
}
const read = (path, adapt) => async (args, api, _options, baseQuery) => {
  try {
    const check = guard(api, args.owner);
    if (args.entity && !registrationEntity(args.entity)) throw new Error('Choose a registration form.');
    const result = await baseQuery(root + path(args));
    check();
    return result.error ? result : { data: adapt(result.data, args.entity) };
  } catch (error) { return failure(error.message); }
};
const write = (operation) => async (args, api, _options, baseQuery) => {
  try {
    const check = guard(api, args.owner, true);
    if (!registrationEntity(args.entity)) throw new Error('Choose a registration form.');
    const path = `${root}/${args.entity}`;
    const id = typeof args.id === 'string' && args.id.trim() ? encodeURIComponent(args.id) : null;
    if (['update', 'delete', 'duplicate'].includes(operation) && !id) throw new Error('A real field ID is required.');
    let request;
    if (operation === 'create' || operation === 'update') {
      const body = encodeRegistrationField(args.draft, operation === 'update' ? args.original : null);
      if (operation === 'update' && args.original?.id !== args.id) throw new Error('The field changed. Reload before saving.');
      request = { url: operation === 'create' ? path : `${path}/${id}`, method: operation === 'create' ? 'POST' : 'PATCH', body };
    } else if (operation === 'delete') request = { url: `${path}/${id}`, method: 'DELETE' };
    else if (operation === 'duplicate') request = { url: `${path}/${id}/duplicate`, method: 'POST' };
    else {
      if (!Array.isArray(args.fieldIds) || !args.fieldIds.length || args.fieldIds.some((v) => typeof v !== 'string' || !v.trim()) || new Set(args.fieldIds).size !== args.fieldIds.length) throw new Error('Confirmed field IDs are required.');
      if (operation === 'reorder') request = { url: `${path}/order`, method: 'PUT', body: { fieldIds: args.fieldIds } };
      else {
        const changes = Object.fromEntries(Object.entries(args.changes || {}).filter(([key, value]) => ['required', 'enabled'].includes(key) && typeof value === 'boolean'));
        if (!Object.keys(changes).length) throw new Error('Choose a supported bulk change.');
        request = { url: `${path}/bulk`, method: 'PATCH', body: { fieldIds: args.fieldIds, changes } };
      }
    }
    const result = await baseQuery(request);
    check();
    if (result.error) return result;
    const dto = unwrapApiResponseData(result.data);
    if (operation === 'delete') {
      if (dto?.id !== args.id || dto?.deleted !== true) throw new Error('The delete was sent, but its result was not confirmed. Reload before trying again.');
      return { data: dto };
    }
    if (operation === 'reorder' || operation === 'bulk') {
      const fields = adaptRegistrationFields(result.data, args.entity);
      if (operation === 'reorder' && (fields.length !== args.fieldIds.length || fields.some((f, index) => f.id !== args.fieldIds[index] || f.order !== index + 1))) throw new Error('The reorder was sent, but its result was not confirmed. Reload before trying again.');
      if (operation === 'bulk' && (!Array.isArray(dto.skipped) || fields.length + dto.skipped.length !== args.fieldIds.length || fields.some((f) => !args.fieldIds.includes(f.id) || Object.entries(request.body.changes).some(([key, value]) => f[key] !== value)))) throw new Error('The bulk update was sent, but its result was not confirmed. Reload before trying again.');
      if (operation === 'bulk' && (new Set(dto.skipped).size !== dto.skipped.length || dto.skipped.some(id => typeof id !== 'string' || !args.fieldIds.includes(id) || fields.some(field => field.id === id)))) throw new Error('The bulk update was sent, but the skipped field IDs could not be confirmed. Reload before trying again.');
      return { data: { fields, skipped: dto.skipped || [] } };
    }
    const field = adaptRegistrationField(result.data, args.entity);
    if ((operation === 'update' && field.id !== args.id) || !field.updatedAt) throw new Error('The update was sent, but its result was not confirmed. Reload before trying again.');
    if (operation === 'duplicate' && field.id === args.id) throw new Error('The duplicate was sent, but the API did not confirm a new field. Reload before trying again.');
    if (['create', 'update'].includes(operation) && Object.entries(request.body).some(([key, value]) => key !== 'expectedVersion' && JSON.stringify(field[key]) !== JSON.stringify(value))) throw new Error('The save was sent, but the API did not confirm the requested values. Reload before trying again.');
    return { data: field };
  } catch (error) { return failure(error.message); }
};
const invalidates = (_result, _error, args) => [fieldTag(args), summaryTag(args), 'AdminAuditLogs'];
export const registrationFieldsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminRegistrationFields', 'AdminAuditLogs'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminRegistrationFields: builder.query({ queryFn: read(({ entity }) => `/${entity}`, adaptRegistrationFields), providesTags: (_r, _e, args) => [fieldTag(args)] }),
    getAdminRegistrationSummary: builder.query({ queryFn: read(() => '/summary', adaptRegistrationSummary), providesTags: (_r, _e, args) => [summaryTag(args)] }),
    getAdminRegistrationMeta: builder.query({ queryFn: read(() => '/meta', adaptRegistrationMeta) }),
    createAdminRegistrationField: builder.mutation({ queryFn: write('create'), invalidatesTags: invalidates }),
    updateAdminRegistrationField: builder.mutation({ queryFn: write('update'), invalidatesTags: invalidates }),
    deleteAdminRegistrationField: builder.mutation({ queryFn: write('delete'), invalidatesTags: invalidates }),
    duplicateAdminRegistrationField: builder.mutation({ queryFn: write('duplicate'), invalidatesTags: invalidates }),
    reorderAdminRegistrationFields: builder.mutation({ queryFn: write('reorder'), invalidatesTags: invalidates }),
    bulkUpdateAdminRegistrationFields: builder.mutation({ queryFn: write('bulk'), invalidatesTags: invalidates }),
  }),
});
export const { useGetAdminRegistrationFieldsQuery, useGetAdminRegistrationSummaryQuery, useGetAdminRegistrationMetaQuery, useCreateAdminRegistrationFieldMutation, useUpdateAdminRegistrationFieldMutation, useDeleteAdminRegistrationFieldMutation, useDuplicateAdminRegistrationFieldMutation, useReorderAdminRegistrationFieldsMutation, useBulkUpdateAdminRegistrationFieldsMutation } = registrationFieldsApi;
