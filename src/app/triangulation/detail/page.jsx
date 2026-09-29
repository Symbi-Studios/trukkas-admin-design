import { Suspense } from 'react';
import { TriangulationApiDetail } from '../../../screens/TriangulationApiDetail.jsx';

export const metadata = {
  title: 'Triangulation Opportunity',
  description: 'Review a triangulation match.',
};

export default function TriangulationOpportunityPage() {
  return <Suspense fallback={null}><TriangulationApiDetail /></Suspense>;
}
