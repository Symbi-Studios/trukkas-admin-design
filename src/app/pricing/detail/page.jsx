import { Suspense } from 'react';
import { PricingDetail } from '../../../screens/PricingDetail.jsx';

export const metadata = { title: 'Pricing Details', description: 'Detailed view of this service pricing entry.' };

export default function PricingDetailPage() {
  return <Suspense fallback={null}><PricingDetail /></Suspense>;
}
