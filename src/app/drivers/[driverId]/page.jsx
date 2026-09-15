import { DriverDetail } from '../../../screens/DriverDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('driverId'); }

export async function generateMetadata({ params }) {
  const { driverId } = await params;
  return {
    title: driverId,
    description: 'Review this driver profile, assignment, and compliance information.',
    openGraph: { title: driverId, description: 'Trukkas driver profile.', images: [] },
    twitter: { title: driverId, description: 'Trukkas driver profile.', images: [] },
  };
}

export default function DriverDetailPage() {
  return <DriverDetail />;
}
