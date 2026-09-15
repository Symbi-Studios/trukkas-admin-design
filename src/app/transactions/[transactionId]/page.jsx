import { TransactionDetail } from '../../../screens/TransactionDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('transactionId'); }

export async function generateMetadata({ params }) {
  const { transactionId } = await params;
  return {
    title: transactionId,
    description: 'Detailed view of this transaction.',
    openGraph: { title: transactionId, description: 'Trukkas transaction detail.', images: [] },
    twitter: { title: transactionId, description: 'Trukkas transaction detail.', images: [] },
  };
}

export default function TransactionDetailPage() {
  return <TransactionDetail />;
}
