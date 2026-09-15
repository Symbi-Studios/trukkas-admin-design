import { JobDetail } from '../../../screens/JobDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('jobId'); }

export async function generateMetadata({ params }) {
  const { jobId } = await params;
  return {
    title: jobId,
    description: 'Review the job, route segments, approval status, financial summary, and compliance checks.',
    openGraph: { title: jobId, description: 'Trukkas job details and approval status.', images: [] },
    twitter: { title: jobId, description: 'Trukkas job details and approval status.', images: [] },
  };
}

export default function JobDetailPage() {
  return <JobDetail />;
}
