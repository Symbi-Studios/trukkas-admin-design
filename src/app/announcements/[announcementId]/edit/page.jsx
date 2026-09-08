import { AnnouncementForm } from '../../../../screens/AnnouncementForm.jsx';
import { Suspense } from 'react';
export default function EditAnnouncementPage(){ return <Suspense fallback={null}><AnnouncementForm editing/></Suspense>; }
