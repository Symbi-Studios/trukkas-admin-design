import { KnowledgeArticleForm } from '../../../../screens/KnowledgeArticleForm.jsx';
import { staticParamsFor } from '../../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('articleId'); }
export default function EditKnowledgeArticlePage(){ return <KnowledgeArticleForm editing/>; }
