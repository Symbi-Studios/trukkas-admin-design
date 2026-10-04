import { Suspense } from 'react';
import { PayoutDetail } from '../../../screens/PayoutDetail.jsx';

export const metadata = { title: 'Payout Details', description: 'Detailed view of this payout.' };

export default function PayoutDetailPage() {
  return <Suspense fallback={null}><PayoutDetail /></Suspense>;
}
