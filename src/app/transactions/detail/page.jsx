import { Suspense } from 'react';
import { TransactionDetail } from '../../../screens/TransactionDetail.jsx';

export const metadata = { title: 'Transaction Details', description: 'Detailed view of this transaction.' };

export default function TransactionDetailPage() {
  return <Suspense fallback={null}><TransactionDetail /></Suspense>;
}
