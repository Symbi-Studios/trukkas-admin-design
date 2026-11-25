'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Banner, Button, Card, DropdownMenu, Icon, Select, Switch } from '../../ds.js';
import { Link, useNavigate, useParams } from '../../router.js';
import {
  useCreateAdminKnowledgeArticleMutation, useGetAdminKnowledgeArticleDetailQuery, useUpdateAdminKnowledgeArticleMutation,
} from '../../store/features/knowledgeBase/knowledgeBaseApi.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { showToast } from '../../components/ActionToast.jsx';
import { DriverDetailLoading } from '../DriversLoading.jsx';
import { RichTextEditor } from './RichTextEditor.jsx';
import { AUDIENCES, HELP_TOPICS, STATUS_TONE, articleEditUrl, audienceLabel, isKnownTopic } from './helpCenter.js';
import styles from './Help.module.css';

const EMPTY = { title: '', summary: '', category: '', visibility: 'ALL', featured: false, feedback: true, body: '' };
const readMinutes = (text) => Math.max(1, Math.round((text.trim().split(/\s+/).filter(Boolean).length || 0) / 200));

function fromArticle(a) {
  return {
    title: a.core.title || '', summary: a.summaryIsGenerated ? '' : a.core.summary || '', category: a.core.category || '',
    visibility: a.visibilityCode || 'ALL', featured: a.featured === true, feedback: a.feedback !== false, body: a.core.body || '',
  };
}

/** Write or edit a help article in a rich-text editor; it's saved as the Markdown the apps render. */
export function ArticleEditor() {
  const navigate = useNavigate();
  const params = useParams();
  const search = useSearchParams();
  const id = search.get('articleId') || params.articleId || null;
  const detail = useGetAdminKnowledgeArticleDetailQuery(id, { skip: !id, refetchOnMountOrArgChange: true });
  const article = id && !detail.error ? detail.currentData : null;
  const [create, createState] = useCreateAdminKnowledgeArticleMutation();
  const [update, updateState] = useUpdateAdminKnowledgeArticleMutation();
  const [form, setForm] = React.useState(EMPTY);
  const [loadedVersion, setLoadedVersion] = React.useState(null);
  const [error, setError] = React.useState('');
  const [menu, setMenu] = React.useState(false);
  const menuRef = React.useRef(null);
  const saving = createState.isLoading || updateState.isLoading;

  React.useEffect(() => {
    if (article && loadedVersion !== article.version) { setForm(fromArticle(article)); setLoadedVersion(article.version); }
  }, [article, loadedVersion]);
  React.useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenu(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const original = article ? fromArticle(article) : null;
  const changes = original ? Object.fromEntries(Object.entries(form).filter(([key, value]) => value !== original[key])) : form;
  const dirty = !original || Object.keys(changes).length > 0;
  const status = article?.statusCode || null;
  const missing = [!form.title.trim() && 'Add a title', !form.category && 'Pick a topic', !form.body.trim() && 'Write the article'].filter(Boolean);

  async function save(nextStatus) {
    if (saving) return;
    setError('');
    const toWire = (values) => {
      const out = {};
      if ('title' in values) out.title = values.title.trim();
      if ('summary' in values) out.summary = values.summary.trim();
      if ('category' in values) out.category = values.category;
      if ('visibility' in values) out.visibility = values.visibility;
      if ('featured' in values) out.featured = values.featured;
      if ('feedback' in values) out.feedback = values.feedback;
      if ('body' in values) out.body = values.body;
      return out;
    };
    try {
      if (!article) {
        const fields = { ...toWire(form), status: nextStatus };
        if (!fields.summary) delete fields.summary;
        const saved = await create(fields).unwrap();
        showToast(nextStatus === 'PUBLISHED' ? 'Article published' : 'Draft saved');
        navigate(articleEditUrl(saved.id), { replace: true });
      } else {
        const fields = toWire(changes);
        if (nextStatus && nextStatus !== status) fields.status = nextStatus;
        if (!Object.keys(fields).length) return;
        await update({ id: article.id, changes: fields, expectedVersion: article.version }).unwrap();
        showToast(nextStatus === 'PUBLISHED' && status !== 'PUBLISHED' ? 'Article published' : nextStatus === 'DRAFT' && status === 'PUBLISHED' ? 'Moved to drafts' : nextStatus === 'ARCHIVED' ? 'Article archived' : 'Changes saved');
      }
    } catch (failure) { setError(getApiErrorMessage(failure)); }
  }

  if (id && (detail.isLoading || (detail.isFetching && !detail.currentData))) return <DriverDetailLoading label="Loading article…" />;
  if (id && !article) {
    return <Card><div className={styles.empty}><strong>{detail.error ? 'Couldn’t load this article' : 'Article not found'}</strong>
      <span>{detail.error ? getApiErrorMessage(detail.error) : 'It may have been deleted.'}</span>
      <Button variant="outline" size="sm" icon="arrow-left" onClick={() => navigate('/knowledge-base')}>Back to help center</Button></div></Card>;
  }

  const topicKnown = !form.category || isKnownTopic(form.category);
  const footerText = missing.length ? missing.join(' · ')
    : status === 'PUBLISHED' ? (dirty ? 'Changes go live as soon as you save.' : 'Live in the apps.')
      : status === 'ARCHIVED' ? 'Archived. Readers can’t see it.' : `Publishing shows it to ${audienceLabel(form.visibility).toLowerCase()} under ${form.category}.`;

  return (
    <div className={styles.page}>
      <div className={styles.editorHead}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link to="/knowledge-base">Help center</Link><Icon name="chevron-right" size={12} aria-hidden="true" /><span>{article ? 'Edit article' : 'New article'}</span>
        </nav>
        {article && <span className={styles.statusLine}>
          <Badge tone={STATUS_TONE[article.status] || 'neutral'} dot>{article.status}</Badge>
          {article.views != null && <span>{article.views.toLocaleString('en-NG')} views</span>}
          {article.helpful != null && <span>{Math.round(article.helpful)}% found it helpful</span>}
        </span>}
      </div>

      {error && <Banner inline tone="danger" title="Couldn’t save the article">{error}</Banner>}

      <div className={styles.editor}>
        <div className={styles.doc}>
          <section className={styles.card}>
            <div className={styles.docBody}>
              <textarea className={styles.docTitle} rows={1} value={form.title} maxLength={150} disabled={saving} placeholder="Article title" aria-label="Title"
                onChange={(event) => set('title', event.target.value.replace(/\n/g, ' '))} autoFocus={!id}
                onInput={(event) => { event.currentTarget.style.height = 'auto'; event.currentTarget.style.height = event.currentTarget.scrollHeight + 'px'; }} />
              <RichTextEditor value={form.body} resetKey={loadedVersion || 'new'} disabled={saving} onChange={(body) => set('body', body)}
                placeholder="Start writing. Use the toolbar for headings, lists and links." />
              {article?.guide && <p className={styles.hint}><Icon name="info" size={12} aria-hidden="true" /> This article also has a step-by-step guide layout. It isn’t edited here and is kept as it is.</p>}
            </div>
          </section>

          <div className={styles.footer}>
            <p>{footerText}</p>
            <div className={styles.actions}>
              {article && (
                <span ref={menuRef} className={styles.menuAnchor}>
                  <Button variant="ghost" icon="ellipsis" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} disabled={saving} onClick={() => setMenu(!menu)} />
                  {menu && <DropdownMenu width={210} style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', zIndex: 'var(--tk-z-dropdown)' }} items={[
                    status === 'PUBLISHED' && { label: 'Move to drafts', icon: 'eye-off', onClick: () => { setMenu(false); save('DRAFT'); } },
                    status !== 'ARCHIVED' && { label: 'Archive', icon: 'archive', tone: 'danger', onClick: () => { setMenu(false); save('ARCHIVED'); } },
                    status === 'ARCHIVED' && { label: 'Restore as draft', icon: 'rotate-ccw', onClick: () => { setMenu(false); save('DRAFT'); } },
                  ].filter(Boolean)} />}
                </span>
              )}
              {status !== 'PUBLISHED' && <Button variant="outline" disabled={saving || !form.title.trim() || !form.category || !form.body.trim() || (article && !dirty)} onClick={() => save('DRAFT')}>Save draft</Button>}
              {status === 'PUBLISHED'
                ? <Button loading={saving} disabled={saving || !dirty || missing.length > 0} onClick={() => save('PUBLISHED')}>Save changes</Button>
                : <Button icon="send" loading={saving} disabled={saving || missing.length > 0} onClick={() => save('PUBLISHED')}>Publish</Button>}
            </div>
          </div>
        </div>

        <aside className={styles.settings}>
          <section className={styles.card} aria-label="Article settings">
            <div className={styles.cardBody}>
              <Select label="Topic" placeholder="Choose a topic" value={form.category} disabled={saving}
                options={[...HELP_TOPICS.map((t) => ({ value: t.value, label: t.value })), ...(!topicKnown ? [{ value: form.category, label: `${form.category} (old category)` }] : [])]}
                onChange={(event) => set('category', event.target.value)} />
              {!topicKnown && <p className={styles.hint} style={{ color: 'var(--tk-warning-ink)', marginTop: -8 }}>Not one of the app topics. Pick one so it shows in the right place.</p>}
              <Select label="Who can read it" value={form.visibility} disabled={saving} options={AUDIENCES} onChange={(event) => set('visibility', event.target.value)} />
              <label className={styles.field}>
                <span className={styles.labelRow}><span className={styles.label}>Summary</span><span className={styles.counter}>{form.summary.length}/500</span></span>
                <textarea className={styles.textarea} rows={3} maxLength={500} value={form.summary} disabled={saving} placeholder="Shown in the list of guides. Optional."
                  onChange={(event) => set('summary', event.target.value)} />
                <p className={styles.hint}>Left empty, the apps use the first 160 characters.</p>
              </label>
            </div>
          </section>
          <section className={styles.card}>
            <div className={`${styles.cardBody} ${styles.toggles}`}>
              <Switch checked={form.featured} disabled={saving} onChange={(v) => set('featured', v)} label="Feature it" hint="Shown first and on the Support home." />
              <Switch checked={form.feedback} disabled={saving} onChange={(v) => set('feedback', v)} label="Ask “Was this helpful?”" hint="Readers can vote; you see the rate here." />
            </div>
          </section>
          <p className={styles.hint} style={{ padding: '0 4px' }}>{readMinutes(form.body)} min read · {audienceLabel(form.visibility)}{form.category ? ` · ${form.category}` : ''}</p>
        </aside>
      </div>
    </div>
  );
}
