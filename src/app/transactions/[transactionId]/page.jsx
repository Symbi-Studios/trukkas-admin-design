import { TransactionDetail } from '../../../screens/TransactionDetail.jsx';

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
