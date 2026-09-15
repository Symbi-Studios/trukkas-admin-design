import { PayoutDetail } from '../../../screens/PayoutDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('payoutId'); }

export async function generateMetadata({ params }) {
  const { payoutId } = await params;
  return {
    title: payoutId,
    description: 'Detailed view of this payout.',
    openGraph: { title: payoutId, description: 'Trukkas payout detail.', images: [] },
    twitter: { title: payoutId, description: 'Trukkas payout detail.', images: [] },
  };
}

export default function PayoutDetailPage() {
  return <PayoutDetail />;
}
