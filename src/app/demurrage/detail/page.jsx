import { Suspense } from 'react';
import { DemurrageDetail } from '../../../screens/DemurrageDetail.jsx';

export const metadata = { title: 'Demurrage Details', description: 'Detailed view of this demurrage charge.' };

export default function DemurrageDetailPage() {
  return <Suspense fallback={null}><DemurrageDetail /></Suspense>;
}
