import { Suspense } from 'react';
import { MaintenanceDetail } from '../../../screens/MaintenanceDetail.jsx';

export default function MaintenanceDetailPage() {
  return <Suspense fallback={null}><MaintenanceDetail /></Suspense>;
}
