import { Suspense } from 'react';
import { DocumentDetail } from '../../../screens/DocumentDetail.jsx';

export const metadata = {
  title: 'Document Details',
  description: 'Review an uploaded job document.',
};

export default function DocumentDetailPage() {
  return <Suspense fallback={null}><DocumentDetail /></Suspense>;
}
