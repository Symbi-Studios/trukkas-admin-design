import { AnnouncementForm } from '../../../../screens/AnnouncementForm.jsx';
import { Suspense } from 'react';
import { staticParamsFor } from '../../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('announcementId'); }
export default function EditAnnouncementPage(){ return <Suspense fallback={null}><AnnouncementForm editing/></Suspense>; }
