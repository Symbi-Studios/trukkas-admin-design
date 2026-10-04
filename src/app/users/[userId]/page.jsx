import { Suspense } from 'react';
import { UserDetail } from '../../../screens/UserDetail.jsx';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('userId'); }

export async function generateMetadata({ params }) {
  const { userId } = await params;
  return {
    title: userId,
    description: 'Review this user profile, role and account status.',
    openGraph: { title: userId, description: 'Trukkas user profile.', images: [] },
    twitter: { title: userId, description: 'Trukkas user profile.', images: [] },
  };
}

export default function UserDetailPage() {
  return <Suspense fallback={<DriverDetailLoading />}><UserDetail /></Suspense>;
}
