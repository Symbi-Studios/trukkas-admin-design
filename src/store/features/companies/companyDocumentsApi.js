import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { companyDocumentPreviewBlob } from './companyDocumentPreview.js';
import { companyDate } from './companiesApi.js';
const text = v => typeof v === 'string' && v.trim() ? v.trim() : null;
const label = v => text(v)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';
const fail = (error, saveUnconfirmed = false) => ({ error: { status: 'CUSTOM_ERROR', error, saveUnconfirmed } });
const path = id => '/admin/users/' + encodeURIComponent(id) + '/company-documents';
function fileUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } }
export function adaptCompanyDocumentList(response) {
  const dto = unwrapApiResponseData(response);
  if (!Array.isArray(dto?.documents)) throw new Error('The company response is missing its documents.');
  const seen = new Set();
  const documents = dto.documents.map(row => {
    const id = text(row?.id), type = text(row?.type), key = id || type;
    if (!key || seen.has(key)) throw new Error('The company documents have missing or duplicate identifiers.');
    seen.add(key);
    return { id, rowKey: key, type, name: text(row.label) || label(type), statusCode: text(row.status), status: label(row.status), url: fileUrl(row.url),
      fileName: text(row.fileName) || '—', documentNumber: text(row.documentNumber) || '—', uploadedAtRaw: text(row.uploadedAt), uploadedAt: companyDate(row.uploadedAt),
      uploadedBy: text(row.uploadedBy?.name) || '—', date: companyDate(row.reviewedAt), reviewedBy: text(row.reviewedBy?.name) || '—', rejectionReason: text(row.rejectionReason), expiresAt: companyDate(row.expiresAt), expiry: label(row.expiryStatus) };
  });
  return { documents, total: Number.isSafeInteger(dto.summary?.total) && dto.summary.total >= 0 ? dto.summary.total : null };
}
// Storage URLs are already supplied by the API. Fetch without admin bearer
// tokens or cookies, and do not send signed URLs through the API logger.
const storageQuery = fetchBaseQuery({ credentials: 'omit', referrerPolicy: 'no-referrer' });
const previews = new Map();
const previewKey = ({ owner, companyId, id, url }) => JSON.stringify([owner, companyId, id, url]);
function previewResource(args) {
  const key = previewKey(args);
  if (!previews.has(key)) previews.set(key, { closed: false, urls: new Set() });
  return previews.get(key);
}
const reviewRoles = new Set(['SUPER_ADMIN', 'OPS_ADMIN']);
const tags = ['AdminCompanyDocuments', 'AdminCompanies', 'AdminVerificationDirectory', 'AdminVerificationDetail', 'AdminVerificationHistory', 'AdminAuditLogs'];
export const companyDocumentsApi = baseApi.enhanceEndpoints({ addTagTypes: tags }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: builder => ({
    getAdminCompanyDocuments: builder.query({
      async queryFn({ id, owner }, api, _options, baseQuery) {
        const current = () => !api.signal.aborted && owner && api.getState().auth.accessToken && api.getState().auth.admin?.id === owner;
        if (!text(id) || !current()) return fail('Sign in and select a company.');
        const result = await baseQuery({ url: path(id) });
        if (!current()) return fail('Your session changed. Reopen the company.');
        if (result.error) return result;
        try { return { data: adaptCompanyDocumentList(result.data) }; } catch (error) { return fail(error.message); }
      }, providesTags: ['AdminCompanyDocuments', 'AdminCompanies'],
    }),
    getAdminCompanyDocumentPreview: builder.query({
      keepUnusedDataFor: 0,
      async queryFn(args, api, options) {
        const { owner, companyId, id, url } = args;
        const resource = previewResource(args);
        const current = () => !resource.closed && !api.signal.aborted && owner && api.getState().auth.accessToken && api.getState().auth.admin?.id === owner;
        if (!text(companyId) || !fileUrl(url) || !current()) return fail('Sign in and reopen the document.');
        const result = await storageQuery({ url, responseHandler: response => response.ok ? response.blob() : null }, api, options);
        if (!current()) return fail('Your session changed. Reopen the document.');
        if (result.error) return fail(result.error.status === 'FETCH_ERROR'
          ? 'The document could not be loaded for preview. Check the connection and whether the file host allows cross-origin reads from this admin site.'
          : 'The document could not be loaded for preview (HTTP ' + (result.error.originalStatus || result.error.status) + '). Reopen the document to refresh its file link.');
        try {
          const blob = await companyDocumentPreviewBlob(result.data);
          if (!current()) return fail('Your session changed. Reopen the document.');
          const previewUrl = URL.createObjectURL(blob);
          resource.urls.add(previewUrl);
          return { data: { url: previewUrl } };
        } catch (error) { return fail(error.message); }
      },
      async onCacheEntryAdded(args, { cacheEntryRemoved }) {
        const resource = previewResource(args);
        await cacheEntryRemoved;
        resource.closed = true;
        for (const url of resource.urls) URL.revokeObjectURL(url);
        if (previews.get(previewKey(args)) === resource) previews.delete(previewKey(args));
      },
    }),
    reviewAdminCompanyDocument: builder.mutation({
      async queryFn({ companyId, document, decision, reason, owner, role }, api, _options, baseQuery) {
        const current = () => !api.signal.aborted && owner && api.getState().auth.accessToken && api.getState().auth.admin?.id === owner && api.getState().auth.admin?.role === role;
        if (!text(companyId) || !text(document?.id) || !['approve', 'reject'].includes(decision) || !reviewRoles.has(role) || !current()) return fail('Your account cannot review this company document.');
        if (decision === 'reject' && (!text(reason) || reason.trim().length > 500)) return fail('Enter a rejection reason of up to 500 characters.');
        const before = await baseQuery({ url: path(companyId) });
        if (!current()) return fail('Your session changed. Reopen the company.');
        if (before.error) return before;
        let fresh;
        try { fresh = adaptCompanyDocumentList(before.data).documents.find(row => row.id === document.id); } catch (error) { return fail(error.message); }
        if (!fresh?.url || fresh.url !== document.url || fresh.type !== document.type || fresh.uploadedAtRaw !== document.uploadedAtRaw || fresh.statusCode !== document.statusCode
          || !(decision === 'approve' ? ['PENDING', 'REJECTED'] : ['PENDING', 'APPROVED']).includes(fresh.statusCode)) return fail('This document changed or is no longer reviewable. Reload it before reviewing.');
        const result = await baseQuery({ url: '/admin/company-documents/' + encodeURIComponent(document.id) + '/' + decision, method: 'POST', ...(decision === 'reject' ? { body: { reason: reason.trim() } } : {}) });
        const unconfirmed = () => fail('The review was sent but could not be confirmed. Close and refresh before trying again.', true);
        if (!current()) return unconfirmed();
        if (result.error) return { error: { ...result.error, saveUnconfirmed: ['FETCH_ERROR', 'TIMEOUT_ERROR', 'PARSING_ERROR'].includes(result.error.status) || Number(result.error.status) >= 500 } };
        const saved = unwrapApiResponseData(result.data)?.document, status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
        if (saved?.id !== document.id || saved.type !== fresh.type || saved.status !== status || fileUrl(saved.url) !== fresh.url || saved.uploadedAt !== fresh.uploadedAtRaw
          || saved.reviewedBy?.id !== owner || companyDate(saved.reviewedAt) === '—' || decision === 'reject' && saved.rejectionReason !== reason.trim()) return unconfirmed();
        const after = await baseQuery({ url: path(companyId) });
        if (!current() || after.error) return unconfirmed();
        try {
          const confirmed = adaptCompanyDocumentList(after.data).documents.find(row => row.id === document.id);
          return confirmed?.statusCode === status && confirmed.url === fresh.url && confirmed.uploadedAtRaw === fresh.uploadedAtRaw && (decision !== 'reject' || confirmed.rejectionReason === reason.trim()) ? { data: confirmed } : unconfirmed();
        } catch { return unconfirmed(); }
      }, invalidatesTags: tags,
    }),
  }),
});
export const { useGetAdminCompanyDocumentPreviewQuery, useGetAdminCompanyDocumentsQuery, useReviewAdminCompanyDocumentMutation } = companyDocumentsApi;
