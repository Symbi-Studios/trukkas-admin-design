import { Suspense } from 'react';
import { EscrowHoldDetail } from '../../../screens/EscrowHoldDetail.jsx';

export const metadata = { title: 'Escrow Hold Details', description: 'Detailed view of this escrow hold.' };

export default function EscrowDetailPage() {
  return <Suspense fallback={null}><EscrowHoldDetail /></Suspense>;
}
