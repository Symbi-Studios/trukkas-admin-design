import { Suspense } from 'react';
import { FeedbackDetail } from '../../../screens/FeedbackDetail.jsx';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';

export const metadata = { title: 'Feedback Details' };
export default function FeedbackDetailPage() {
  return <Suspense fallback={<DriverDetailLoading />}><FeedbackDetail /></Suspense>;
}
