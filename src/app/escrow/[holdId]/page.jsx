import { EscrowHoldDetail } from '../../../screens/EscrowHoldDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('holdId'); }

export async function generateMetadata({ params }) {
  const { holdId } = await params;
  return {
    title: holdId,
    description: 'Detailed view of this escrow hold.',
    openGraph: { title: holdId, description: 'Trukkas escrow hold detail.', images: [] },
    twitter: { title: holdId, description: 'Trukkas escrow hold detail.', images: [] },
  };
}

export default function EscrowHoldDetailPage() {
  return <EscrowHoldDetail />;
}
