import { Suspense } from 'react';
import { UserDetail } from '../../../screens/UserDetail.jsx';
import { DriverDetailLoading } from '../../../screens/DriversLoading.jsx';

export const metadata = { title: 'User Profile', description: 'Review this user profile, role and account status.' };
export default function UserDetailPage() {
  return <Suspense fallback={<DriverDetailLoading />}><UserDetail /></Suspense>;
}
