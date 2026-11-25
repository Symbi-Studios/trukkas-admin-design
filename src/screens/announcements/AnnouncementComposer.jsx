'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Avatar, Banner, Button, Card, Icon, Modal, Skeleton, Switch } from '../../ds.js';
import { Link, useNavigate, useParams } from '../../router.js';
import {
  announcementDetailUrl, useGetAdminAnnouncementOptionsQuery, useGetAdminAnnouncementQuery, useGetAdminAnnouncementUsersQuery,
} from '../../store/features/announcements/announcementsApi.js';
import { useAnnouncementOperations } from '../../store/features/announcements/useAnnouncementOperations.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { showToast } from '../../components/ActionToast.jsx';
import { DriverDetailLoading } from '../DriversLoading.jsx';
import { AUDIENCE_MODES, CHANNEL_META, PRIORITIES, ROLE_LABEL, TYPES, audienceSentence, channelList } from './announcementView.js';
import styles from './Announcements.module.css';

const EMPTY = {
  title: '', message: '', type: 'Notice', audience: 'All Users', targeting: { roleIds: [], moduleIds: [], userIds: [] },
  channels: ['in-app'], priority: 'Normal', pinned: false, acknowledgement: false,
  schedule: 'Publish Now', scheduleDate: '', scheduleTime: '', expiry: '',
};
const TITLE_MAX = 150, MESSAGE_MAX = 5000;

function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return debounced;
}

function Segmented({ value, options, onChange, disabled, label }) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => {
        const id = typeof option === 'string' ? option : option.value;
        return (
          <button key={id} type="button" aria-pressed={value === id} disabled={disabled} onClick={() => onChange(id)}>
            {typeof option === 'string' ? option : option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Search app users by name, business or email and collect them as chips. */
function PeoplePicker({ owner, selected, people, onAdd, onRemove, disabled, max }) {
  const [term, setTerm] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const search = useDebounced(term.trim());
  const query = useGetAdminAnnouncementUsersQuery({ owner, search, page: 1 }, { skip: search.length < 2 });
  const results = search.length >= 2 ? query.currentData?.users || [] : [];
  const full = max != null && selected.length >= max;
  React.useEffect(() => setActive(0), [search]);
  const pick = (user) => { if (!user || selected.includes(user.id) || full) return; onAdd(user); setTerm(''); };
  return (
    <div className={styles.field}>
      <div className={styles.picker}>
        <input className={styles.input} value={term} disabled={disabled || full} placeholder={full ? `Limit of ${max} reached` : 'Search by name, business or email'}
          role="combobox" aria-expanded={open && search.length >= 2} aria-controls="announcement-people" aria-label="Find people"
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(event) => { setTerm(event.target.value); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); return; }
            if (!results.length) return;
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            if (event.key === 'Enter') { event.preventDefault(); pick(results[active]); }
          }} />
        {open && search.length >= 2 && (
          <ul id="announcement-people" role="listbox" className={styles.results}>
            {query.isFetching && !results.length ? <li className={styles.resultsHint}>Searching…</li>
              : query.error ? <li className={styles.resultsHint}>{getApiErrorMessage(query.error)}</li>
                : !results.length ? <li className={styles.resultsHint}>No app user matches “{search}”.</li>
                  : results.map((user, index) => {
                    const added = selected.includes(user.id);
                    return (
                      <li key={user.id} role="option" aria-selected={index === active} aria-disabled={added} data-active={index === active || undefined}
                        onMouseEnter={() => setActive(index)} onMouseDown={(event) => { event.preventDefault(); pick(user); }}>
                        <Avatar name={user.label} size={26} />
                        <span>
                          <strong>{user.label}{added ? ' · added' : ''}</strong>
                          <small>{[ROLE_LABEL[user.role] || user.role, user.person !== user.label ? user.person : null, user.email].filter(Boolean).join(' · ')}</small>
                        </span>
                      </li>
                    );
                  })}
          </ul>
        )}
      </div>
      {selected.length > 0 && (
        <div className={styles.people} aria-label="Selected people">
          {selected.map((id) => (
            <span key={id} className={styles.person}>
              <Avatar name={people[id]?.label || '?'} size={20} />
              {people[id]?.label || 'Selected user'}
              <button type="button" aria-label={`Remove ${people[id]?.label || 'user'}`} disabled={disabled} onClick={() => onRemove(id)}><Icon name="x" size={11} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      )}
      <p className={styles.hint}>{selected.length ? `${selected.length} ${selected.length === 1 ? 'person' : 'people'} selected.` : 'Add the people who should get this.'}{max ? ` Up to ${max.toLocaleString('en-NG')}.` : ''}</p>
    </div>
  );
}

function Preview({ form, channel, onChannel }) {
  const title = form.title.trim() || 'Announcement title';
  const message = form.message.trim() || 'Your message appears here. Keep it short and say what the reader needs to do.';
  const urgent = ['High', 'Urgent'].includes(form.priority);
  const tabs = form.channels.length ? form.channels : ['in-app'];
  const show = tabs.includes(channel) ? channel : tabs[0];
  return (
    <section className={styles.card} aria-label="Preview">
      <div className={styles.cardHead}><h2>Preview</h2><span>How it looks in the apps</span></div>
      <div className={styles.previewTabs} role="tablist" aria-label="Preview channel">
        {tabs.map((c) => <button key={c} type="button" role="tab" aria-selected={show === c} onClick={() => onChannel(c)}>{CHANNEL_META[c].label.replace(' notification', '')}</button>)}
      </div>
      {show === 'push' && (
        <div className={styles.stage} data-kind="push">
          <div className={styles.lock}><strong>9:41</strong><span>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' })}</span></div>
          <div className={styles.notif}>
            <span className={`${styles.notifIcon} ${styles.appIcon}`} aria-hidden="true">T</span>
            <span>
              <span className={styles.notifTop}><strong>{title}</strong><small>now</small></span>
              <p className={`${styles.notifBody} ${styles.clamp2}`}>{message}</p>
            </span>
          </div>
        </div>
      )}
      {show === 'in-app' && (
        <div className={styles.stage}>
          {(form.pinned || form.acknowledgement || urgent) && <>
            <span className={styles.stageLabel}>Banner on the home screen</span>
            <div className={styles.banner} data-tone={form.priority === 'Urgent' ? 'urgent' : undefined}>
              <span className={styles.bannerTop}><Icon name={form.priority === 'Urgent' ? 'triangle-alert' : 'megaphone'} size={12} aria-hidden="true" />{form.type}</span>
              <strong>{title}</strong>
              <p className={styles.clamp4}>{message}</p>
              {form.acknowledgement && <span className={styles.ackButton}>I’ve read this</span>}
            </div>
          </>}
          <span className={styles.stageLabel}>Notification centre</span>
          <div className={styles.notif}>
            <span className={styles.notifIcon} aria-hidden="true"><Icon name="megaphone" size={16} /></span>
            <span>
              <span className={styles.notifTop}><strong>{title}</strong><small>Just now</small></span>
              <p className={`${styles.notifBody} ${styles.clamp2}`}>{message}</p>
            </span>
          </div>
        </div>
      )}
      {show === 'email' && (
        <div className={styles.stage}>
          <div className={styles.email}>
            <div className={styles.emailHead}><span><strong>Trukkas</strong> &lt;notifications&gt;</span><span>Subject: <strong>{title}</strong></span></div>
            <div className={styles.emailBody}><b>Trukkas</b><h3>{title}</h3><p>{message}</p></div>
          </div>
        </div>
      )}
      <p className={styles.previewNote}>The phone apps draw these themselves, so spacing can differ slightly.</p>
    </section>
  );
}

export function AnnouncementComposer({ editing = false }) {
  const navigate = useNavigate();
  const params = useParams();
  const search = useSearchParams();
  const draftId = search.get('draftId');
  const copyId = search.get('copy');
  const id = editing ? search.get('announcementId') || params.announcementId : draftId || copyId;
  const operations = useAnnouncementOperations();
  const { owner, authenticated } = operations;
  const options = useGetAdminAnnouncementOptionsQuery({ owner }, { skip: !authenticated });
  const sourceQuery = useGetAdminAnnouncementQuery({ id, owner }, { skip: !id || !authenticated, refetchOnMountOrArgChange: true });
  const source = id && !sourceQuery.error ? sourceQuery.currentData : null;
  const updating = Boolean(editing || draftId);

  const [form, setForm] = React.useState(EMPTY);
  const [loadedFrom, setLoadedFrom] = React.useState(null);
  const [people, setPeople] = React.useState({});
  const [channelsTouched, setChannelsTouched] = React.useState(false);
  const [previewChannel, setPreviewChannel] = React.useState('in-app');
  const [review, setReview] = React.useState(false);
  const [saving, setSaving] = React.useState(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!source || loadedFrom === source.id + source.version) return;
    const copy = !updating;
    setForm({
      ...EMPTY, ...source.form,
      targeting: { roleIds: [], moduleIds: [], userIds: [], ...Object.fromEntries(Object.entries(source.form.targeting || {}).map(([k, v]) => [k, v || []])) },
      channels: source.form.channels?.length ? source.form.channels : ['in-app'],
      type: source.form.type || 'Notice', priority: source.form.priority || 'Normal', audience: source.form.audience || 'All Users',
      pinned: source.form.pinned ?? false, acknowledgement: source.form.acknowledgement ?? false,
      ...(copy ? { title: source.form.title ? `${source.form.title} (copy)` : '', schedule: 'Publish Now', scheduleDate: '', scheduleTime: '', expiry: '' } : {}),
    });
    setChannelsTouched(true);
    setLoadedFrom(source.id + source.version);
  }, [source, loadedFrom, updating]);

  const opts = options.currentData;
  const published = updating && source?.statusCode === 'PUBLISHED';
  const busy = Boolean(saving);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const mode = AUDIENCE_MODES.find((m) => m.name === form.audience) || AUDIENCE_MODES[0];
  const targetIds = mode.key ? form.targeting[mode.key] || [] : [];
  const catalogue = opts?.modes?.find((m) => m.name === mode.name)?.options || [];
  const allowedChannels = opts?.channels || ['in-app', 'push', 'email'];

  function setPriority(priority) {
    setForm((f) => {
      const defaults = opts?.defaultChannels?.[priority.toUpperCase()];
      return { ...f, priority, ...(!channelsTouched && defaults?.length ? { channels: defaults } : {}) };
    });
  }
  function toggleChannel(c) {
    setChannelsTouched(true);
    setForm((f) => ({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : allowedChannels.filter((x) => x === c || f.channels.includes(x)) }));
  }
  function setAudience(name) {
    setForm((f) => ({ ...f, audience: name }));
  }
  function toggleTarget(targetId) {
    setForm((f) => {
      const current = f.targeting[mode.key] || [];
      const next = current.includes(targetId) ? current.filter((x) => x !== targetId) : [...current, targetId];
      return { ...f, targeting: { roleIds: [], moduleIds: [], userIds: [], [mode.key]: next } };
    });
  }

  const titleOver = form.title.length > TITLE_MAX, messageOver = form.message.length > MESSAGE_MAX;
  const scheduled = form.schedule === 'Schedule for Later';
  const problems = [
    !form.title.trim() && 'Add a title',
    !form.message.trim() && 'Add a message',
    (titleOver || messageOver) && 'Shorten the text',
    mode.key && !targetIds.length && (mode.name === 'Custom Users' ? 'Add at least one person' : 'Choose who gets it'),
    !form.channels.length && 'Pick a channel',
    scheduled && (!form.scheduleDate || !form.scheduleTime) && 'Pick a send time',
  ].filter(Boolean);
  const audienceText = audienceSentence(form, opts, people);

  async function save(kind) {
    if (busy) return;
    setError(''); setSaving(kind);
    try {
      const result = await operations.perform({ action: 'save', id: updating ? id : undefined, expectedVersion: source?.version, form, mode: kind });
      if (result) {
        showToast(kind === 'Draft' ? 'Draft saved' : scheduled ? 'Announcement scheduled' : published ? 'Announcement updated' : 'Announcement sent');
        navigate(announcementDetailUrl(result.announcement.id));
      }
    } catch (failure) { setError(getApiErrorMessage(failure)); setReview(false); }
    finally { setSaving(null); }
  }

  if (id && (sourceQuery.isLoading || (sourceQuery.isFetching && !sourceQuery.currentData))) return <DriverDetailLoading label="Loading announcement…" />;
  if (id && !source) {
    return <Card><div className={styles.empty}><strong>{sourceQuery.error ? 'Couldn’t load this announcement' : 'Announcement not found'}</strong>
      <span>{sourceQuery.error ? getApiErrorMessage(sourceQuery.error) : 'It may have been archived.'}</span>
      <Button variant="outline" size="sm" icon="arrow-left" onClick={() => navigate('/announcements')}>Back to announcements</Button></div></Card>;
  }
  if (updating && source && !['DRAFT', 'SCHEDULED', 'PUBLISHED'].includes(source.statusCode)) {
    return <Card><div className={styles.empty}><strong>This announcement can’t be edited</strong><span>It has been {source.st.toLowerCase()}. Duplicate it to send it again.</span>
      <Button variant="outline" size="sm" onClick={() => navigate(announcementDetailUrl(source.id))}>Open announcement</Button></div></Card>;
  }

  const heading = !updating ? 'New announcement' : published ? 'Edit announcement' : source?.statusCode === 'SCHEDULED' ? 'Edit scheduled announcement' : 'Edit draft';
  const sendLabel = published ? 'Save changes' : scheduled ? 'Schedule' : 'Send now';

  return (
    <div className={styles.page}>
      <header>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link to="/announcements">Announcements</Link><Icon name="chevron-right" size={12} aria-hidden="true" /><span>{heading}</span>
        </nav>
        <div className={styles.titleRow}>
          <div>
            <h1 className="tk-display">{heading}</h1>
            <p className={styles.subtitle}>Reach forwarders, truckers and drivers in their apps, on their phones or by email.</p>
          </div>
        </div>
      </header>

      {error && <Banner inline tone="danger" title="That didn’t go through">{error}</Banner>}
      {published && <Banner inline tone="info" title="Already sent">You can fix the wording, type, priority and expiry. To change who gets it or how, duplicate it instead.</Banner>}

      <div className={styles.layout}>
        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', minWidth: 0 }}>
          <section className={styles.card} aria-label="Message">
            <div className={styles.cardHead}><h2>Message</h2></div>
            <div className={styles.cardBody}>
              <label className={styles.field}>
                <span className={styles.labelRow}><span className={styles.label}>Title</span><span className={styles.counter} data-over={titleOver || undefined}>{form.title.length}/{TITLE_MAX}</span></span>
                <input className={`${styles.input} ${styles.titleInput}`} value={form.title} disabled={busy} placeholder="Apapa gate closures this weekend"
                  onChange={(event) => set('title', event.target.value)} autoFocus={!id} />
              </label>
              <label className={styles.field}>
                <span className={styles.labelRow}><span className={styles.label}>Message</span><span className={styles.counter} data-over={messageOver || undefined}>{form.message.length.toLocaleString('en-NG')}/{MESSAGE_MAX.toLocaleString('en-NG')}</span></span>
                <textarea className={styles.textarea} value={form.message} disabled={busy} rows={6}
                  placeholder={'Gates 2 and 3 are closed Saturday 06:00–18:00.\nPlan pickups for Gate 1.'}
                  onChange={(event) => set('message', event.target.value)} />
                <p className={styles.hint}>Plain text. Line breaks are kept. Push shows the first two lines.</p>
              </label>
              <div className={styles.field}>
                <span className={styles.label}>Type</span>
                <Segmented label="Type" value={form.type} options={TYPES} disabled={busy} onChange={(v) => set('type', v)} />
              </div>
            </div>
          </section>

          <section className={styles.card} aria-label="Audience">
            <div className={styles.cardHead}><h2>Who gets it</h2></div>
            <div className={styles.cardBody}>
              <Segmented label="Audience" value={form.audience} disabled={busy || published}
                options={AUDIENCE_MODES.map((m) => ({ value: m.name, label: m.label }))} onChange={setAudience} />
              {mode.name === 'User Roles' || mode.name === 'Users with Access' ? (
                options.isLoading ? <Skeleton height={30} width="70%" /> : catalogue.length ? (
                  <div className={styles.chips} role="group" aria-label={mode.label}>
                    {catalogue.map((item) => (
                      <button key={item.id} type="button" className={styles.chip} aria-pressed={targetIds.includes(item.id)} disabled={busy || published} onClick={() => toggleTarget(item.id)}>
                        {targetIds.includes(item.id) && <Icon name="check" size={12} aria-hidden="true" />}{item.label}
                      </button>
                    ))}
                  </div>
                ) : <p className={styles.hint}>These options couldn’t be loaded. Reload to try again.</p>
              ) : mode.name === 'Custom Users' ? (
                <PeoplePicker owner={owner} selected={targetIds} people={people} disabled={busy || published} max={opts?.limits?.customUsersMax}
                  onAdd={(user) => { setPeople((p) => ({ ...p, [user.id]: user })); setForm((f) => ({ ...f, targeting: { roleIds: [], moduleIds: [], userIds: [...(f.targeting.userIds || []), user.id] } })); }}
                  onRemove={(userId) => setForm((f) => ({ ...f, targeting: { ...f.targeting, userIds: f.targeting.userIds.filter((x) => x !== userId) } }))} />
              ) : null}
              <p className={styles.hint}>
                <strong>{audienceText}.</strong>{' '}
                {mode.name === 'User Roles' ? 'Exporters are forwarders with a verified licence; trucking companies and individual truckers together make up truckers.'
                  : mode.name === 'Users with Access' ? 'Team seats inside trucking companies whose role covers any of these areas.'
                    : mode.name === 'All Users' ? 'Company team members see it in their company’s inbox.' : ''}
                {' '}Recipients are worked out when it’s sent.
              </p>
            </div>
          </section>

          <section className={styles.card} aria-label="Delivery">
            <div className={styles.cardHead}><h2>Delivery</h2></div>
            <div className={styles.cardBody}>
              <div className={styles.field}>
                <span className={styles.label}>Priority</span>
                <Segmented label="Priority" value={form.priority} options={PRIORITIES} disabled={busy} onChange={setPriority} />
                <p className={styles.hint}>High and Urgent add push by default and sort to the top of the notification centre.</p>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Channels</span>
                <div className={styles.channels}>
                  {allowedChannels.map((c) => {
                    const on = form.channels.includes(c);
                    return (
                      <button key={c} type="button" role="checkbox" aria-checked={on} className={styles.channel} disabled={busy || published} onClick={() => toggleChannel(c)}>
                        <span className={styles.channelIcon} aria-hidden="true"><Icon name={CHANNEL_META[c].icon} size={16} /></span>
                        <span><strong>{CHANNEL_META[c].label}</strong><small>{CHANNEL_META[c].hint}</small></span>
                        <span className={styles.check} aria-hidden="true"><Icon name="check" size={12} /></span>
                      </button>
                    );
                  })}
                </div>
                {mode.name === 'Users with Access' && form.channels.includes('push') && (
                  <p className={styles.notice}><Icon name="info" size={13} aria-hidden="true" />Company team seats can’t receive push, so this audience only gets in-app and email.</p>
                )}
              </div>
              <div className={styles.toggles}>
                <Switch checked={form.pinned} disabled={busy} onChange={(v) => set('pinned', v)} label="Pin to the top" hint="Stays as a banner on the home screen until it expires." />
                <Switch checked={form.acknowledgement} disabled={busy} onChange={(v) => set('acknowledgement', v)} label="Ask people to confirm they’ve read it" hint="Adds an “I’ve read this” button and tracks who confirmed." />
              </div>
            </div>
          </section>

          <section className={styles.card} aria-label="Timing">
            <div className={styles.cardHead}><h2>Timing</h2><span>Lagos time (WAT)</span></div>
            <div className={styles.cardBody}>
              <Segmented label="When" value={form.schedule} disabled={busy || published}
                options={[{ value: 'Publish Now', label: 'Send now' }, { value: 'Schedule for Later', label: 'Schedule' }]} onChange={(v) => set('schedule', v)} />
              {scheduled && (
                <div className={styles.row2}>
                  <label className={styles.field}><span className={styles.label}>Date</span>
                    <input type="date" className={styles.input} value={form.scheduleDate} disabled={busy || published} onChange={(event) => set('scheduleDate', event.target.value)} /></label>
                  <label className={styles.field}><span className={styles.label}>Time</span>
                    <input type="time" className={styles.input} value={form.scheduleTime} disabled={busy || published} onChange={(event) => set('scheduleTime', event.target.value)} /></label>
                </div>
              )}
              <label className={styles.field} style={{ maxWidth: 260 }}>
                <span className={styles.label}>Stop showing after (optional)</span>
                <input type="date" className={styles.input} value={form.expiry} disabled={busy} onChange={(event) => set('expiry', event.target.value)} />
                <p className={styles.hint}>{form.expiry ? 'It disappears from banners and the notification centre at the end of that day.' : 'Leave empty to keep it until you unpublish it.'}</p>
              </label>
            </div>
          </section>

          <div className={styles.footer}>
            <p>{problems.length ? problems[0] : <>To <strong>{mode.name === 'Custom Users' ? audienceText : audienceText.charAt(0).toLowerCase() + audienceText.slice(1)}</strong> by {channelList(form.channels).toLowerCase()}</>}</p>
            <div className={styles.actions}>
              <Button variant="ghost" disabled={busy} onClick={() => navigate(id && updating ? announcementDetailUrl(id) : '/announcements')}>Cancel</Button>
              {!published && <Button variant="outline" loading={saving === 'Draft'} disabled={busy || !form.title.trim() || !form.message.trim()} onClick={() => save('Draft')}>Save draft</Button>}
              <Button icon={published ? undefined : scheduled ? 'calendar-clock' : 'send'} disabled={busy || problems.length > 0} onClick={() => setReview(true)}>{published ? 'Save changes' : 'Review'}</Button>
            </div>
          </div>
        </div>

        <aside className={styles.side}>
          <Preview form={form} channel={previewChannel} onChannel={setPreviewChannel} />
        </aside>
      </div>

      <Modal open={review} width={520} title={published ? 'Save changes?' : scheduled ? 'Schedule this announcement?' : 'Send this announcement?'}
        description={published ? 'People who already received it will see the updated wording.' : 'Check who gets it and how. This can’t be unsent, but you can unpublish it later.'}
        onClose={() => { if (!busy) setReview(false); }}
        footer={<>
          <Button variant="outline" disabled={busy} onClick={() => setReview(false)}>Keep editing</Button>
          <Button icon={published ? undefined : scheduled ? 'calendar-clock' : 'send'} loading={busy && saving !== 'Draft'} disabled={busy}
            onClick={() => save(scheduled ? 'Scheduled' : 'Published')}>{sendLabel}</Button>
        </>}>
        <dl className={styles.facts}>
          <div><dt>Title</dt><dd>{form.title}</dd></div>
          <div><dt>To</dt><dd>{audienceText}</dd></div>
          <div><dt>Channels</dt><dd>{channelList(form.channels)}{mode.name === 'Users with Access' && form.channels.includes('push') ? ' (no push for team seats)' : ''}</dd></div>
          <div><dt>Priority</dt><dd>{form.priority}{form.pinned ? ' · pinned' : ''}{form.acknowledgement ? ' · read confirmation' : ''}</dd></div>
          <div><dt>When</dt><dd>{scheduled ? `${form.scheduleDate} at ${form.scheduleTime} (Lagos)` : published ? 'Already sent' : 'Immediately'}</dd></div>
          {form.expiry && <div><dt>Expires</dt><dd>End of {form.expiry}</dd></div>}
        </dl>
        {form.channels.includes('email') && mode.name === 'All Users' && !published && (
          <p className={styles.notice} style={{ marginTop: 14 }}><Icon name="mail" size={13} aria-hidden="true" />This emails every active account. Make sure it’s worth an email.</p>
        )}
      </Modal>
    </div>
  );
}
