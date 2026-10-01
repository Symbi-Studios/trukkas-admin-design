import { Suspense } from 'react';
import { AdminFleetTruckDetail } from '../../../screens/AdminFleetTruckDetail.jsx';

export const metadata = { title: 'Truck Details', description: 'Review truck registration, vehicle information and photos.' };

export default function AdminFleetTruckDetailPage() {
  return <Suspense fallback={null}><AdminFleetTruckDetail /></Suspense>;
}
