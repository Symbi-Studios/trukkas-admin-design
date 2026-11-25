import { Suspense } from 'react';
import { ArticleEditor } from '../../../screens/help/ArticleEditor.jsx';

export default function EditKnowledgeArticlePage() {
  return <Suspense fallback={null}><ArticleEditor /></Suspense>;
}
