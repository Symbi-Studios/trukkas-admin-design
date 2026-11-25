'use client';

import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from '../../router.js';
import { Button, PageHeader } from '../../ds.js';
import { useGetAdminFeedbackDetailQuery } from '../../store/features/feedback/feedbackApi.js';
import { FeedbackPane } from './FeedbackPane.jsx';
import { feedbackPageUrl } from './feedbackInbox.js';

/** Full-page feedback (/feedback/detail?feedbackId=…): the inbox pane on its own, for links. */
export function FeedbackPage() {
  const params = useParams(), search = useSearchParams(), navigate = useNavigate();
  const feedbackId = params.feedbackId || search.get('feedbackId') || '';
  const owner = useSelector((state) => state.auth.admin?.id);
  const detail = useGetAdminFeedbackDetailQuery({ owner, id: feedbackId }, { skip: !owner || !feedbackId });
  const title = detail.currentData?.title && detail.currentData.title !== '—' ? detail.currentData.title : 'Feedback';
  return (
    <>
      <PageHeader crumbs={['Support System', { label: 'Feedback', to: '/feedback' }, title]} title={title}
        actions={<Button variant="outline" icon="inbox" onClick={() => navigate(`/feedback?feedback=${encodeURIComponent(feedbackId)}&queue=all`)}>Open in inbox</Button>} />
      <FeedbackPane feedbackId={feedbackId} layout="page" me={owner} onSelect={(id) => navigate(feedbackPageUrl(id))} />
    </>
  );
}
