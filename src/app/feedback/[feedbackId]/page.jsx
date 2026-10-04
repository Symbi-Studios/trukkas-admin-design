import { FeedbackDetail } from '../../../screens/FeedbackDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
import { Suspense } from 'react';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';
export function generateStaticParams(){ return staticParamsFor('feedbackId'); }
export default function FeedbackDetailPage(){ return <Suspense fallback={<DriverDetailLoading />}><FeedbackDetail /></Suspense>; }
