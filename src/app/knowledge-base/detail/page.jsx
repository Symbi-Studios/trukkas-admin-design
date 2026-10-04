import { Suspense } from 'react';
import { KnowledgeArticleDetail } from '../../../screens/KnowledgeArticleDetail.jsx';

export default function KnowledgeArticleDetailPage() {
  return <Suspense fallback={null}><KnowledgeArticleDetail /></Suspense>;
}
