'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Banner, Button, Card, DropdownMenu, Icon, Switch } from '../../ds.js';
import { Link, useNavigate, useParams } from '../../router.js';
import {
  useCreateAdminKnowledgeArticleMutation, useGetAdminKnowledgeArticleDetailQuery, useUpdateAdminKnowledgeArticleMutation,
} from '../../store/features/knowledgeBase/knowledgeBaseApi.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { showToast } from '../../components/ActionToast.jsx';
import { DriverDetailLoading } from '../DriversLoading.jsx';
import { Markdown } from './Markdown.jsx';
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

/** Write or edit a help article, with a live preview of how the apps show it. */
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
      <div>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link to="/knowledge-base">Help center</Link><Icon name="chevron-right" size={12} aria-hidden="true" /><span>{article ? 'Edit article' : 'New article'}</span>
        </nav>
        <div className={styles.editorHead} style={{ marginTop: 6 }}>
          <h1 className="tk-display" style={{ margin: 0 }}>{article ? form.title || 'Untitled article' : 'New article'}</h1>
          {article && <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--tk-ink-400)', font: '400 13px/18px var(--tk-font-sans)' }}>
            <Badge tone={STATUS_TONE[article.status] || 'neutral'} dot>{article.status}</Badge>
            {article.views != null && <span>{article.views.toLocaleString('en-NG')} views</span>}
            {article.helpful != null && <span>· {Math.round(article.helpful)}% found it helpful</span>}
          </span>}
        </div>
      </div>

      {error && <Banner inline tone="danger" title="Couldn’t save the article">{error}</Banner>}

      <div className={styles.editor}>
        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', minWidth: 0 }}>
          <section className={styles.card}>
            <div className={styles.cardBody}>
              <label className={styles.field}>
                <span className={styles.labelRow}><span className={styles.label}>Title</span><span className={styles.counter}>{form.title.length}/150</span></span>
                <input className={`${styles.input} ${styles.titleInput}`} value={form.title} maxLength={150} disabled={saving} placeholder="How to add a truck to your fleet"
                  onChange={(event) => set('title', event.target.value)} autoFocus={!id} />
              </label>
              <label className={styles.field}>
                <span className={styles.labelRow}><span className={styles.label}>Summary (optional)</span><span className={styles.counter}>{form.summary.length}/500</span></span>
                <textarea className={styles.textarea} rows={2} maxLength={500} value={form.summary} disabled={saving} placeholder="One or two sentences shown in the list of guides."
                  onChange={(event) => set('summary', event.target.value)} />
                <p className={styles.hint}>Left empty, the apps show the first 160 characters of the article.</p>
              </label>
              <div className={styles.row2}>
                <label className={styles.field}>
                  <span className={styles.label}>Topic</span>
                  <select className={styles.select} value={form.category} disabled={saving} onChange={(event) => set('category', event.target.value)}>
                    <option value="" disabled>Choose a topic</option>
                    {HELP_TOPICS.map((t) => <option key={t.slug} value={t.value}>{t.value}</option>)}
                    {!topicKnown && <option value={form.category}>{form.category} (old category)</option>}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Who can read it</span>
                  <select className={styles.select} value={form.visibility} disabled={saving} onChange={(event) => set('visibility', event.target.value)}>
                    {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </label>
              </div>
              {!topicKnown && <p className={styles.hint} style={{ color: 'var(--tk-warning-ink)' }}>“{form.category}” isn’t one of the app topics. Pick one so it shows in the right place.</p>}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><h2>Article</h2><span>Markdown · {readMinutes(form.body)} min read</span></div>
            <div className={styles.cardBody}>
              <textarea className={`${styles.textarea} ${styles.body}`} value={form.body} disabled={saving} aria-label="Article body"
                placeholder={'## Before you start\nYou need an approved company account.\n\n## Steps\n1. Open **Fleet** and choose **Add vehicle**.\n2. Enter the plate number and upload the documents.\n3. Submit for review.'}
                onChange={(event) => set('body', event.target.value)} />
              <p className={styles.hint}>Use <code>##</code> for headings, <code>**bold**</code>, <code>1.</code> or <code>-</code> for lists and <code>[text](https://…)</code> for links.</p>
              {article?.guide && <p className={styles.hint}><Icon name="info" size={12} aria-hidden="true" /> This article also has a step-by-step guide layout. It isn’t edited here and is kept as it is.</p>}
            </div>
          </section>

          <section className={styles.card}>
            <div className={`${styles.cardBody} ${styles.toggles}`}>
              <Switch checked={form.featured} disabled={saving} onChange={(v) => set('featured', v)} label="Feature it" hint="Featured articles appear first and on the Support home." />
              <Switch checked={form.feedback} disabled={saving} onChange={(v) => set('feedback', v)} label="Ask “Was this helpful?”" hint="Readers can vote, and you’ll see the helpful rate here." />
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

        <aside className={styles.previewWrap}>
          <section className={styles.card} aria-label="Preview">
            <div className={styles.cardHead}><h2>Preview</h2><span>As a guide in the apps</span></div>
            <div className={styles.preview}>
              <div className={styles.previewMeta}>
                <span>{[form.category, `${readMinutes(form.body)} min read`, audienceLabel(form.visibility)].filter(Boolean).join(' · ')}</span>
              </div>
              <h1 className={styles.previewTitle}>{form.title || 'Article title'}</h1>
              {form.summary.trim() && <p className={styles.previewSummary}>{form.summary}</p>}
              {form.body.trim() ? <Markdown source={form.body} className={styles.md} /> : <p className={styles.hint}>Start writing to see the preview.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
