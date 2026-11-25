'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import { Badge, Button, Icon, Skeleton } from '../../ds.js';
import { Link, useNavigate } from '../../router.js';
import { useGetAdminKnowledgeArticleDirectoryQuery, useGetAdminKnowledgeStatsQuery } from '../../store/features/knowledgeBase/knowledgeBaseApi.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { HelpCenterHeader } from './HelpCenterHeader.jsx';
import { HELP_TOPICS, STATUS_TONE, articleEditUrl, audienceLabel, isKnownTopic } from './helpCenter.js';
import styles from './Help.module.css';

const STATUSES = [{ value: null, label: 'All' }, { value: 'Published', label: 'Published' }, { value: 'Draft', label: 'Drafts' }, { value: 'Archived', label: 'Archived' }];
const EMPTY = [];

/** /knowledge-base: the help articles the apps show as guides, grouped by the apps' seven topics. */
export function HelpArticles() {
  const navigate = useNavigate();
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const directory = useGetAdminKnowledgeArticleDirectoryQuery({}, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const stats = useGetAdminKnowledgeStatsQuery(undefined, { skip: !authenticated });
  const [topic, setTopic] = React.useState(null);
  const [status, setStatus] = React.useState(null);
  const [q, setQ] = React.useState('');
  const rows = authenticated && !directory.error ? directory.currentData || EMPTY : EMPTY;
  const loading = directory.isLoading || (directory.isFetching && !directory.currentData);
  const term = q.trim().toLowerCase();
  const byStatus = rows.filter((row) => !status || row.status === status);
  const visible = byStatus.filter((row) => (!topic || (topic === 'other' ? !isKnownTopic(row.category) : row.category === topic))
    && (!term || [row.title, row.summary, row.category].some((v) => v.toLowerCase().includes(term))));
  const other = byStatus.filter((row) => !isKnownTopic(row.category)).length;
  const published = rows.filter((r) => r.status === 'Published').length, drafts = rows.filter((r) => r.status === 'Draft').length;
  const helpful = stats.currentData?.cards?.helpfulPercentage?.value;
  const n = (v) => (loading ? <Skeleton as="span" width={18} height={12} /> : v);

  return (
    <div className={styles.page}>
      <HelpCenterHeader tab="articles"
        stats={<>
          <span><strong>{n(published)}</strong> published</span>
          <span><strong>{n(drafts)}</strong> drafts</span>
          <span><strong>{typeof stats.currentData?.cards?.views?.value === 'number' ? stats.currentData.cards.views.value.toLocaleString('en-NG') : '—'}</strong> views this month</span>
          <span><strong>{typeof helpful === 'number' ? `${Math.round(helpful)}%` : '—'}</strong> found helpful</span>
        </>}
        actions={<Button icon="plus" onClick={() => navigate('/knowledge-base/new')}>New article</Button>} />

      <section className={styles.frame} aria-label="Articles">
        <div className={styles.tools}>
          <label className={styles.search}>
            <Icon name="search" size={14} aria-hidden="true" />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search articles…" aria-label="Search articles" />
          </label>
          <div className={styles.segmented} role="group" aria-label="Status">
            {STATUSES.map((s) => <button key={s.label} type="button" aria-pressed={status === s.value} onClick={() => setStatus(s.value)}>{s.label}</button>)}
          </div>
        </div>
        <div className={styles.topics} role="group" aria-label="Topic">
          <button type="button" className={styles.chip} aria-pressed={!topic} onClick={() => setTopic(null)}>All topics</button>
          {HELP_TOPICS.map((t) => (
            <button key={t.slug} type="button" className={styles.chip} aria-pressed={topic === t.value} onClick={() => setTopic(topic === t.value ? null : t.value)}>
              {t.value}{!loading && <span className={styles.chipCount}>{byStatus.filter((r) => r.category === t.value).length}</span>}
            </button>
          ))}
          {other > 0 && <button type="button" className={styles.chip} aria-pressed={topic === 'other'} onClick={() => setTopic(topic === 'other' ? null : 'other')}>Needs a topic<span className={styles.chipCount}>{other}</span></button>}
        </div>

        {loading ? (
          <div aria-busy="true">{Array.from({ length: 5 }, (_, i) => <div key={i} className={styles.skeletonRow}><Skeleton width="40%" height={12} /><Skeleton width="65%" height={11} /></div>)}</div>
        ) : directory.error ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true"><Icon name="cloud-off" size={18} /></span>
            <strong>Couldn’t load articles</strong><span>{getApiErrorMessage(directory.error)}</span>
            <Button variant="outline" size="sm" onClick={() => directory.refetch()}>Try again</Button>
          </div>
        ) : !visible.length ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true"><Icon name={rows.length ? 'search-x' : 'book-open'} size={18} /></span>
            <strong>{rows.length ? 'No matching articles' : 'No articles yet'}</strong>
            <span>{rows.length ? 'Try another topic, status or search.' : 'Articles you publish show up as guides under Help in the apps, filed under the topic you pick.'}</span>
            {!rows.length && <Button size="sm" icon="plus" onClick={() => navigate('/knowledge-base/new')}>Write the first article</Button>}
          </div>
        ) : (
          <>
            <div className={styles.colHead} aria-hidden="true"><span>Article</span><span>Topic</span><span>Audience</span><span>Status</span><span>Views</span><span>Helpful</span><span>Updated</span></div>
            <ul className={styles.rows}>
              {visible.map((row) => (
                <li key={row.id}>
                  <Link to={articleEditUrl(row.id)} className={styles.row}>
                    <span className={styles.title}><strong>{row.featured ? '★ ' : ''}{row.title}</strong><span>{row.summary}</span></span>
                    <span className={`${styles.cell} ${isKnownTopic(row.category) ? '' : styles.warn}`} title={isKnownTopic(row.category) ? undefined : 'Not one of the app topics, so it may not show where you expect'}>{row.category}</span>
                    <span className={styles.cell}>{audienceLabel(row.visibilityCode)}</span>
                    <span><Badge tone={STATUS_TONE[row.status] || 'neutral'} dot>{row.status}</Badge></span>
                    <span className={styles.num}>{row.views == null ? '—' : row.views.toLocaleString('en-NG')}</span>
                    <span className={styles.num}>{row.helpful == null ? '—' : `${Math.round(row.helpful)}%`}</span>
                    <span className={styles.num} style={{ color: 'var(--tk-ink-400)', fontWeight: 400 }}>{row.updated}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
