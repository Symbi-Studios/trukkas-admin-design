import { CompanyDetail } from '../../../screens/CompanyDetail.jsx';

export async function generateMetadata({ params }) {
  const { companyId } = await params;
  return {
    title: companyId,
    description: 'Review this truck company, fleet, drivers, and verification status.',
    openGraph: { title: companyId, description: 'Trukkas truck company profile.', images: [] },
    twitter: { title: companyId, description: 'Trukkas truck company profile.', images: [] },
  };
}

export default function CompanyDetailPage() {
  return <CompanyDetail />;
}
