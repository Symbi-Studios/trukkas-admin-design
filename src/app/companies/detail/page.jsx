import { Suspense } from 'react';
import { CompanyDetail } from '../../../screens/CompanyDetail.jsx';
import { CompanyDetailLoading } from '../../../screens/CompaniesLoading.jsx';

export const metadata = { title: 'Company Details', description: 'Review company details, fleet, drivers, and verification status.' };

export default function CompanyDetailPage() {
  return <Suspense fallback={<CompanyDetailLoading />}><CompanyDetail /></Suspense>;
}
