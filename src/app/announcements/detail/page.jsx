import { Suspense } from 'react';
import { AnnouncementDetail } from '../../../screens/AnnouncementDetail.jsx';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';

export const metadata = { title: 'Announcement Details' };
export default function AnnouncementDetailPage() {
  return <Suspense fallback={<DriverDetailLoading label="Loading announcement…" />}><AnnouncementDetail /></Suspense>;
}
