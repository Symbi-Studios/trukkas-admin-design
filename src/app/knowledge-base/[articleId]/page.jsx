import { Suspense } from 'react';
import { ArticleEditor } from '../../../screens/help/ArticleEditor.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('articleId'); }
export default function KnowledgeArticlePage(){ return <Suspense fallback={null}><ArticleEditor /></Suspense>; }
