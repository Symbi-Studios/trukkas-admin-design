import { AnnouncementDetail } from '../../../screens/AnnouncementDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('announcementId'); }
export default function AnnouncementDetailPage(){ return <AnnouncementDetail/>; }
