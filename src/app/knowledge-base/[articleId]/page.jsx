import { Suspense } from 'react';
import { KnowledgeArticleDetail } from '../../../screens/KnowledgeArticleDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('articleId'); }
export default function KnowledgeArticlePage(){ return <Suspense fallback={null}><KnowledgeArticleDetail/></Suspense>; }
