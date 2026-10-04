import { Suspense } from 'react';
import { SettlementDetail } from '../../../screens/SettlementDetail.jsx';

export const metadata = { title:'Settlement Details', description:'Detailed view of this settlement.' };

export default function SettlementDetailPage() {
  return <Suspense fallback={null}><SettlementDetail /></Suspense>;
}
