import { DocumentDetail } from '../../../screens/DocumentDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('documentId'); }
export default function DocumentDetailPage(){ return <DocumentDetail/>; }
