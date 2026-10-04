import { AnnouncementDetail } from '../../../screens/AnnouncementDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
import { Suspense } from 'react';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';
export function generateStaticParams(){ return staticParamsFor('announcementId'); }
export default function AnnouncementDetailPage(){ return <Suspense fallback={<DriverDetailLoading />}><AnnouncementDetail /></Suspense>; }
