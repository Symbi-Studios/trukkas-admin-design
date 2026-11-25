import { Suspense } from 'react';
import { AnnouncementComposer } from '../../../screens/announcements/AnnouncementComposer.jsx';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';

export const metadata = { title: 'Edit Announcement' };
export default function EditAnnouncementPage() {
  return <Suspense fallback={<DriverDetailLoading label="Loading announcement…" />}><AnnouncementComposer editing /></Suspense>;
}
