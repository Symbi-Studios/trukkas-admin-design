import { ForwarderDetail } from '../../../screens/ForwarderDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('forwarderId'); }

export async function generateMetadata({ params }) {
  const { forwarderId } = await params;
  return {
    title: forwarderId,
    description: 'Review this forwarder profile, verification, and financial standing.',
    openGraph: { title: forwarderId, description: 'Trukkas forwarder profile.', images: [] },
    twitter: { title: forwarderId, description: 'Trukkas forwarder profile.', images: [] },
  };
}

export default function ForwarderDetailPage() {
  return <ForwarderDetail />;
}
