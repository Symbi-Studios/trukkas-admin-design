import { Suspense } from 'react';
import { ForwarderDetail } from '../../../screens/ForwarderDetail.jsx';
import { ForwarderDetailLoading } from '../../../screens/ForwardersLoading.jsx';
export const metadata = { title: 'Forwarder Details', description: 'Review forwarder profile, verification, jobs, and financial standing.' };
export default function ForwarderDetailPage() { return <Suspense fallback={<ForwarderDetailLoading />}><ForwarderDetail /></Suspense>; }
