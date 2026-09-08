import { TriangulationDetail } from '../../../screens/TriangulationDetail.jsx';

export async function generateMetadata({ params }) {
  const { matchId } = await params;
  return {
    title: matchId,
    description: 'Review this container triangulation match.',
    openGraph: { title: matchId, description: 'Trukkas container triangulation match.', images: [] },
    twitter: { title: matchId, description: 'Trukkas container triangulation match.', images: [] },
  };
}

export default function TriangulationDetailPage() {
  return <TriangulationDetail />;
}
