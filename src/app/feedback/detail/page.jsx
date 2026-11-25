import { Suspense } from 'react';
import { FeedbackPage } from '../../../screens/feedback/FeedbackPage.jsx';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';

export const metadata = { title: 'Feedback' };
export default function FeedbackDetailPage() {
  return <Suspense fallback={<DriverDetailLoading label="Loading feedback…" />}><FeedbackPage /></Suspense>;
}
