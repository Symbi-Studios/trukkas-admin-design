import { Suspense } from 'react';
import { AnnouncementForm } from '../../../screens/AnnouncementForm.jsx';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';

export const metadata = { title: 'Edit Announcement' };
export default function EditAnnouncementPage() {
  return <Suspense fallback={<DriverDetailLoading />}><AnnouncementForm editing /></Suspense>;
}
