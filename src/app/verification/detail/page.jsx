import { Suspense } from 'react';
import { VerificationReview } from '../../../screens/verification/VerificationReview.jsx';

export const metadata = { title: 'Verification', description: 'Review and verify submitted documents and entity information.' };

export default function VerificationDetailPage() {
  return <Suspense fallback={null}><VerificationReview /></Suspense>;
}
