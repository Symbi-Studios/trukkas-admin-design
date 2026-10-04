import { AnnouncementForm } from '../../../../screens/AnnouncementForm.jsx';
import { Suspense } from 'react';
import { staticParamsFor } from '../../../../staticParams.js';
import { DriverDetailLoading } from '../../../../screens/DriversLoading.jsx';
export function generateStaticParams(){ return staticParamsFor('announcementId'); }
export default function EditAnnouncementPage(){ return <Suspense fallback={<DriverDetailLoading />}><AnnouncementForm editing/></Suspense>; }
