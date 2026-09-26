import { Suspense } from 'react';
import { AdminJobDetail } from '../../../screens/AdminJobDetail.jsx';

export const metadata = {
  title: 'Job Details',
  description: 'Review a job, its route, assignments, documents, and timeline.',
};

export default function AdminJobDetailPage() {
  return <Suspense fallback={null}><AdminJobDetail /></Suspense>;
}
