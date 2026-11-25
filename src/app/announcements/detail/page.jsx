import { Suspense } from 'react';
import { AnnouncementView } from '../../../screens/announcements/AnnouncementView.jsx';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';

export const metadata = { title: 'Announcement Details' };
export default function AnnouncementDetailPage() {
  return <Suspense fallback={<DriverDetailLoading label="Loading announcement…" />}><AnnouncementView /></Suspense>;
}
