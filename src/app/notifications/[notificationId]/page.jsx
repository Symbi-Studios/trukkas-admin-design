import { NotificationDetail } from '../../../screens/NotificationDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('notificationId'); }
export default function NotificationDetailPage(){return <NotificationDetail/>}
