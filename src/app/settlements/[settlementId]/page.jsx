import { SettlementDetail } from '../../../screens/SettlementDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('settlementId'); }

export async function generateMetadata({ params }) {
  const { settlementId } = await params;
  return {
    title: settlementId,
    description: 'Detailed view of this settlement.',
    openGraph: { title: settlementId, description: 'Trukkas settlement detail.', images: [] },
    twitter: { title: settlementId, description: 'Trukkas settlement detail.', images: [] },
  };
}

export default function SettlementDetailPage() {
  return <SettlementDetail />;
}
