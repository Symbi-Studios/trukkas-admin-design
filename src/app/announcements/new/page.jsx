import { AnnouncementForm } from '../../../screens/AnnouncementForm.jsx';
import { Suspense } from 'react';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';
export default function NewAnnouncementPage(){ return <Suspense fallback={<DriverDetailLoading />}><AnnouncementForm/></Suspense>; }
