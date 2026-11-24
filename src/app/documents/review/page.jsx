import { Suspense } from 'react';
import { DocumentReview } from '../../../screens/DocumentReview.jsx';

export const metadata = {
  title: 'Review Documents',
  description: 'Review a job’s documents container by container.',
};

export default function DocumentReviewPage() {
  return <Suspense fallback={null}><DocumentReview /></Suspense>;
}
