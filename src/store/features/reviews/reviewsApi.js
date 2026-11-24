import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

// Trip ratings that forwarders and truckers leave for each other after a job.
// Backed by GET /admin/feedback (not the Support › Feedback inbox, which is /admin/support/feedback).

export const REVIEWS_PAGE_SIZE = 10;
export const REVIEW_ROLES = { FORWARDER: 'Forwarder', TRUCKER: 'Trucker', DRIVER: 'Driver' };

const record = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
const score = (value) => (Number.isInteger(value) && value >= 1 && value <= 5 ? value : null);

function person(value) {
  const dto = record(value);
  const name = text([text(dto.firstName), text(dto.lastName)].filter(Boolean).join(' ')) ?? text(dto.businessName) ?? text(dto.name);
  const role = text(dto.role);
  return { id: text(dto.id), name: name ?? '—', role: REVIEW_ROLES[role] ?? (role ? role.charAt(0) + role.slice(1).toLowerCase() : null), roleCode: role, email: text(dto.email) };
}

function timestamp(value) {
  const date = text(value) ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}
const lagos = (options) => new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', ...options });

const stamp = (date) => (date ? `${lagos({ day: 'numeric', month: 'short', year: 'numeric' }).format(date)} · ${lagos({ hour: '2-digit', minute: '2-digit' }).format(date)}` : null);
// Sub-scores are only collected on some flows; a review without them leaves all three null.
export const REVIEW_ASPECTS = [
  ['punctuality', 'Punctuality', 'clock'],
  ['communication', 'Communication', 'message-circle'],
  ['professionalism', 'Professionalism', 'briefcase'],
];

function adaptReview(row) {
  const dto = record(row), job = record(dto.job), created = timestamp(dto.createdAt), replied = timestamp(dto.repliedAt);
  const tags = [dto.selectedTags, dto.tags].find(Array.isArray) ?? [];
  const aspects = REVIEW_ASPECTS.map(([key, label, icon]) => ({ key, label, icon, score: number(dto[key]) != null && dto[key] >= 1 && dto[key] <= 5 ? dto[key] : null }));
  return {
    tags: [...new Set(tags.map(text).filter(Boolean))],
    aspects: aspects.some((aspect) => aspect.score != null) ? aspects : null,
    reply: text(dto.reply) ? { text: text(dto.reply), at: stamp(replied) } : null,
    submittedAt: stamp(created),
    id: dto.id,
    score: score(dto.score),
    comment: text(dto.comment),
    archived: dto.isArchived === true,
    unread: dto.adminRead === false,
    rater: person(dto.rater),
    ratee: person(dto.ratee),
    jobId: text(job.id) ?? text(dto.jobId),
    jobNumber: text(job.jobNumber),
    date: created ? lagos({ day: 'numeric', month: 'short', year: 'numeric' }).format(created) : '—',
    time: created ? lagos({ hour: '2-digit', minute: '2-digit' }).format(created) : '—',
  };
}

function adaptStats(value) {
  const stats = record(value);
  return {
    averageRating: number(stats.averageRating),
    total: count(stats.totalResponses),
    newThisWeek: count(stats.weeklyNewResponses),
    unread: count(stats.unread),
  };
}

function listParams({ tab = 'feedback', star, userType, rateeRole, rateeId, search, page = 1, limit = REVIEWS_PAGE_SIZE } = {}) {
  return Object.fromEntries(Object.entries({ tab, star, userType, rateeRole, rateeId, search: text(search), page, limit }).filter(([, value]) => value != null && value !== '' && value !== 'All'));
}

function adaptPage(response) {
  const dto = record(unwrapApiResponseData(response)), pagination = record(dto.pagination);
  if (!Array.isArray(dto.ratings)) return { error: { status: 'CUSTOM_ERROR', error: 'The response is missing the review list.' } };
  return {
    data: {
      stats: adaptStats(dto.stats),
      rows: dto.ratings.filter((row) => text(row?.id)).map(adaptReview),
      total: count(pagination.total),
      pages: count(pagination.totalPages),
    },
  };
}

export const reviewsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminReviews'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminReviews: builder.query({
      async queryFn(args, _api, _options, baseQuery) {
        const result = await baseQuery({ url: '/admin/feedback', params: listParams(args) });
        return result.error ? { error: result.error } : adaptPage(result.data);
      },
      providesTags: ['AdminReviews'],
    }),
    // Page-wide stats plus the count at each star level. The API has no distribution
    // field, so each level is a one-row filtered request that reads pagination.total.
    getAdminReviewSummary: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const [overall, ...levels] = await Promise.all([
          baseQuery({ url: '/admin/feedback', params: { limit: 1 } }),
          ...[5, 4, 3, 2, 1].map((star) => baseQuery({ url: '/admin/feedback', params: { star, limit: 1 } })),
        ]);
        if (overall.error) return { error: overall.error };
        const stats = adaptStats(record(unwrapApiResponseData(overall.data)).stats);
        const distribution = [5, 4, 3, 2, 1].map((star, index) => ({
          star,
          count: levels[index].error ? null : count(record(record(unwrapApiResponseData(levels[index].data)).pagination).total),
        }));
        return { data: { ...stats, distribution: distribution.every((row) => row.count != null) ? distribution : null } };
      },
      providesTags: ['AdminReviews'],
    }),
    toggleAdminReviewArchive: builder.mutation({
      query: (id) => ({ url: `/admin/feedback/${encodeURIComponent(id)}/archive`, method: 'POST' }),
      invalidatesTags: ['AdminReviews'],
    }),
    deleteAdminReview: builder.mutation({
      query: (id) => ({ url: `/admin/feedback/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: ['AdminReviews'],
    }),
  }),
});

export const {
  useGetAdminReviewsQuery,
  useGetAdminReviewSummaryQuery,
  useToggleAdminReviewArchiveMutation,
  useDeleteAdminReviewMutation,
} = reviewsApi;
