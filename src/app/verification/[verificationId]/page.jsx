import { Suspense } from 'react';
import { VerificationReview } from '../../../screens/verification/VerificationReview.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('verificationId'); }

export async function generateMetadata({ params }) {
  const { verificationId } = await params;
  return {
    title: verificationId,
    description: 'Review and verify submitted documents and entity information.',
    openGraph: { title: verificationId, description: 'Trukkas verification detail.', images: [] },
    twitter: { title: verificationId, description: 'Trukkas verification detail.', images: [] },
  };
}

export default function VerificationDetailPage() {
  return <Suspense fallback={null}><VerificationReview /></Suspense>;
}
