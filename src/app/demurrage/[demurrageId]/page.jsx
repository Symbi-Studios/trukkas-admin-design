import { Suspense } from 'react';
import { DemurrageDetail } from '../../../screens/DemurrageDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('demurrageId'); }
export default function DemurrageDetailPage(){ return <Suspense fallback={null}><DemurrageDetail/></Suspense>; }
