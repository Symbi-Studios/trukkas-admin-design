'use client';

import { useNavigate } from '../router.js';
import { DocumentProgress } from '../components/DocumentProgress.jsx';
import { Badge, Button, EmptyState, Icon, SectionCard, Skeleton } from '../ds.js';
import { DOC_STATUS, REVIEW_STATUS_META, countDocuments, docLabel, docStatusLabel, docStatusTone, unitNoun } from '@/domain/containerReview';
import type { ApiError } from '@/types/api';
import type { ReviewDocument, ReviewJob } from '@/types/docReview';
import { formatTdoDate, formatWhen } from './DocumentReview';
import './JobContainerDocuments.css';

const STATUS_ICON = { PENDING: 'clock', APPROVED: 'circle-check', REJECTED: 'circle-x', MISSING: 'file-question' } as const;

function docNote(doc: ReviewDocument): string {
  if (doc.status === DOC_STATUS.MISSING) return 'Not uploaded yet';
  if (doc.status === DOC_STATUS.APPROVED) return `Approved ${formatWhen(doc.reviewedAt)}`;
  if (doc.version > 1) return `Resubmitted ${formatWhen(doc.uploadedAt)}`;
  return `Uploaded ${formatWhen(doc.uploadedAt)}`;
}

/** Job Details → Documents tab: read-only overview, grouped by container or rack. */
interface JobContainerDocumentsProps {
  review: ReviewJob | null;
  loading: boolean;
  error: ApiError | null;
  onRetry: () => void;
  jobRef?: string;
}

export function JobContainerDocuments({ review, loading, error, onRetry, jobRef }: JobContainerDocumentsProps) {
  const navigate = useNavigate();
  if (loading && !review) {
    return (
      <section className="jd-tab-stack" aria-busy="true">
        <Skeleton height={86} />
        <div className="jcd-grid">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={190} />)}</div>
      </section>
    );
  }
  if (!review) {
    return <EmptyState icon="file-text" title="Documents couldn’t be loaded" description={error ? (error.message || 'Check your connection and try again.') : 'This job has no documents yet.'} action={error ? <Button variant="outline" onClick={onRetry}>Retry</Button> : null} />;
  }

  const reviewUrl = (docId?: string) => `/documents/review?jobId=${encodeURIComponent(review.id)}${jobRef ? '&ref=' + encodeURIComponent(jobRef) : ''}${docId ? '&doc=' + encodeURIComponent(docId) : ''}`;
  const counts = countDocuments(review.units);
  const meta = REVIEW_STATUS_META[review.reviewStatus];
  const kind = review.unitKind;

  return (
    <section className="jd-tab-stack">
      <div className="jcd-summary">
        <div className="jcd-summary-main">
          <div className="jcd-summary-title">
            <h3>Documents</h3>
            <Badge tone={meta.tone} dot>{meta.label}</Badge>
          </div>
          <p>Each {unitNoun(kind)} needs its own TDO, Gate Pass and Exit Note. The job opens to bids once all {counts.total} are approved.</p>
        </div>
        <div className="jcd-summary-facts">
          <div className="jcd-fact"><span>TDO date</span><strong>{formatTdoDate(review.tdoDate)}</strong></div>
          <div className="jcd-fact jcd-fact-progress"><span>Progress</span><DocumentProgress counts={counts} /></div>
          {review.locked ? (
            <span className="jcd-locked"><Icon name="lock" size={14} />Locked</span>
          ) : (
            <Button icon="file-check-2" variant={counts.pending ? 'primary' : 'outline'} onClick={() => navigate(reviewUrl())}>
              {counts.pending ? `Review documents (${counts.pending} left)` : 'Open review'}
            </Button>
          )}
        </div>
      </div>

      <div className="jcd-grid">
        {review.units.map((unit) => {
          const unitCounts = countDocuments([unit]);
          const done = unitCounts.approved === unitCounts.total;
          return (
            <SectionCard
              key={unit.id}
              pad="none"
              icon={kind === 'rack' ? 'layers' : 'container'}
              title={<span className="jcd-unit-title">{unit.label}</span>}
              action={<span className={'jcd-unit-count' + (done ? ' is-done' : '')}>{done && <Icon name="circle-check" size={14} />}{unitCounts.approved}/{unitCounts.total} approved</span>}
            >
              <ul className="jcd-docs">
                {unit.documents.map((doc) => (
                  <li key={doc.id}>
                    <button type="button" className={'jcd-doc is-' + doc.status.toLowerCase()} onClick={() => navigate(reviewUrl(doc.id))}>
                      <Icon name={STATUS_ICON[doc.status]} size={16} className="jcd-doc-icon" />
                      <span className="jcd-doc-body">
                        <strong>{docLabel(doc.type)}{doc.version > 1 && <small> · v{doc.version}</small>}</strong>
                        {doc.status === DOC_STATUS.REJECTED
                          ? <small className="jcd-reason" title={doc.rejectionReason ?? undefined}>{doc.rejectionReason}</small>
                          : <small>{docNote(doc)}</small>}
                      </span>
                      <Badge tone={docStatusTone(doc.status)}>{docStatusLabel(doc.status)}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          );
        })}
      </div>
    </section>
  );
}