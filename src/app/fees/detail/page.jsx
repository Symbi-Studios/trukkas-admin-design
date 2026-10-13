import { Suspense } from 'react';
import { FeeRuleDetail } from '../../../screens/FeeRuleDetail.jsx';

export const metadata = { title: 'View Fee Rule', description: 'Detailed information about this fee rule and how it is applied.' };

export default function FeeDetailPage() {
  return <Suspense fallback={null}><FeeRuleDetail /></Suspense>;
}
