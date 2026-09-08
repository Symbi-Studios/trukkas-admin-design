import { UserDetail } from '../../../screens/UserDetail.jsx';

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
  return <UserDetail />;
}
