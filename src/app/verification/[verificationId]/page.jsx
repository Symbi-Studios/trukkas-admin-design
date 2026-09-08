import { VerificationDetail } from '../../../screens/VerificationDetail.jsx';

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
  return <VerificationDetail />;
}
