import { DocumentDetail } from '../../../screens/DocumentDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
import { Suspense } from 'react';
export function generateStaticParams(){ return staticParamsFor('documentId'); }
export default function DocumentDetailPage(){ return <Suspense fallback={null}><DocumentDetail/></Suspense>; }
