import { Suspense } from 'react';
import { KnowledgeArticleForm } from '../../../screens/KnowledgeArticleForm.jsx';

export default function EditKnowledgeArticlePage() {
  return <Suspense fallback={null}><KnowledgeArticleForm editing /></Suspense>;
}
