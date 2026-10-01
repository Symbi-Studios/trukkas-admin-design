import { Suspense } from 'react';
import { AdminDriverDetail } from '../../../screens/AdminDriverDetail.jsx';

export const metadata = { title: 'Driver Details', description: 'View driver profile and license information.' };

export default function AdminDriverDetailPage() {
  return <Suspense fallback={null}><AdminDriverDetail /></Suspense>;
}
