import { MaintenanceDetail } from '../../../screens/MaintenanceDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('maintenanceId'); }
export default function MaintenanceDetailPage(){ return <MaintenanceDetail/>; }
