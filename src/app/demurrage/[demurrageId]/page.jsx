import { DemurrageDetail } from '../../../screens/DemurrageDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('demurrageId'); }
export default function DemurrageDetailPage(){ return <DemurrageDetail/>; }
