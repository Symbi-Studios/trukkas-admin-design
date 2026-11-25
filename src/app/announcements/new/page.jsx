import { AnnouncementComposer } from '../../../screens/announcements/AnnouncementComposer.jsx';
import { Suspense } from 'react';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';
export default function NewAnnouncementPage(){ return <Suspense fallback={<DriverDetailLoading label="Loading announcement…" />}><AnnouncementComposer /></Suspense>; }
