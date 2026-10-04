import { Suspense } from 'react';
import { VerificationDetail } from '../../../screens/VerificationDetail.jsx';

export const metadata = { title: 'Verification', description: 'Review and verify submitted documents and entity information.' };

export default function VerificationDetailPage() {
  return <Suspense fallback={null}><VerificationDetail /></Suspense>;
}
