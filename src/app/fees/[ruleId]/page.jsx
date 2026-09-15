import { FeeRuleDetail } from '../../../screens/FeeRuleDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('ruleId'); }

export async function generateMetadata({ params }) {
  const { ruleId } = await params;
  return {
    title: ruleId,
    description: 'Detailed information about this fee rule and how it is applied.',
    openGraph: { title: ruleId, description: 'Trukkas fee rule detail.', images: [] },
    twitter: { title: ruleId, description: 'Trukkas fee rule detail.', images: [] },
  };
}

export default function FeeRuleDetailPage() {
  return <FeeRuleDetail />;
}
