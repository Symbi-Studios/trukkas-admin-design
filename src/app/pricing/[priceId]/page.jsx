import { PricingDetail } from '../../../screens/PricingDetail.jsx';

export async function generateMetadata({ params }) {
  const { priceId } = await params;
  return {
    title: priceId,
    description: 'Detailed view of this service pricing entry.',
    openGraph: { title: priceId, description: 'Trukkas service pricing detail.', images: [] },
    twitter: { title: priceId, description: 'Trukkas service pricing detail.', images: [] },
  };
}

export default function PricingDetailPage() {
  return <PricingDetail />;
}
