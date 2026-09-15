import { FeedbackDetail } from '../../../screens/FeedbackDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('feedbackId'); }
export default function FeedbackDetailPage(){ return <FeedbackDetail/>; }
