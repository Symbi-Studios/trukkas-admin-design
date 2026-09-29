'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import { PageHeader, Button, StatCard, Card, SectionCard, Tabs, Checkbox, Switch, Icon, IconButton, DropdownMenu, Pagination, Modal, Badge } from '../ds.js';
import {
  useGetAdminNotificationsQuery,
  useMarkAdminNotificationsReadMutation,
  useMarkAllAdminNotificationsReadMutation,
  useGetAdminNotificationSettingsQuery,
  useUpdateAdminNotificationSettingsMutation,
} from '../store/features/notifications/notificationsApi.js';
import './Notifications.css';

const TABS = ['All', 'Unread', 'Priority', 'System', 'Jobs & Trips', 'Fleet', 'Finance', 'Ratings', 'Maintenance'];
const TAB_API_VALUE = {
  All: 'all', Unread: 'unread', Priority: 'priority', System: 'system',
  'Jobs & Trips': 'jobs-trips', Fleet: 'fleet', Finance: 'finance', Ratings: 'ratings', Maintenance: 'maintenance',
};
const CATEGORY_API_VALUE = {
  'Jobs & Trips': 'jobs-trips', Fleet: 'fleet', Finance: 'finance', System: 'system', Ratings: 'ratings', Maintenance: 'maintenance',
};
const SETTING_API_FIELD = { email: 'emailEnabled', push: 'pushEnabled', sms: 'smsEnabled', quiet: 'quietHoursEnabled' };
const settingLabels = {
  email: ['mail', 'Email Notifications', 'Receive notifications via email'],
  push: ['bell', 'Push Notifications', 'Receive push notifications'],
  sms: ['message-square', 'SMS Notifications', 'Receive SMS notifications'],
  quiet: ['moon', 'Quiet Hours', ''],
};

function errorMessage(error, fallback = 'Could not load notifications. Please try again.') {
  const message = error?.data?.message || error?.data?.error || error?.message || error?.error;
  return Array.isArray(message) ? message.join(', ') : typeof message === 'string' && message.trim()
    ? message : fallback;
}

function formatClock(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return value || '—';
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? 'AM' : 'PM'}`;
}

function FilterTitle({ children }) { return <h4 className="notify-filter-title">{children}</h4>; }

export function NotificationCenter() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [statuses, setStatuses] = useState(['Unread']);
  const [priorities, setPriorities] = useState([]);
  const [category, setCategory] = useState('All Categories');
  const [range, setRange] = useState('All Time');
  const [sort, setSort] = useState('Latest First');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menu, setMenu] = useState(null);
  const [selected, setSelected] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [toast, setToast] = useState('');

  const categoryApiTab = CATEGORY_API_VALUE[category];
  const categoryIsServerFiltered = tab === 'All' && Boolean(categoryApiTab);
  const priorityIsServerFiltered = tab === 'Priority'
    || (tab === 'All' && !categoryApiTab && priorities.length === 1 && priorities[0] === 'High');
  const statusIsServerFiltered = (tab === 'Unread' || (tab === 'All' && !categoryApiTab && !priorityIsServerFiltered
    && statuses.length === 1 && statuses[0] === 'Unread'));
  const apiTab = tab !== 'All' ? TAB_API_VALUE[tab]
    : categoryApiTab || (priorityIsServerFiltered ? 'priority' : statusIsServerFiltered ? 'unread' : 'all');
  const { currentData: data, isLoading, isFetching, error, refetch } = useGetAdminNotificationsQuery(
    { page, limit: pageSize, tab: apiTab },
    { refetchOnMountOrArgChange: true },
  );
  const [markRead, { isLoading: markingRead }] = useMarkAdminNotificationsReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllAdminNotificationsReadMutation();
  const {
    currentData: settingsData,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useGetAdminNotificationSettingsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [updateSettings, { isLoading: updatingSettings }] = useUpdateAdminNotificationSettingsMutation();
  const rows = data?.rows || [];
  const showingLoading = isLoading || (isFetching && !data);
  const settingsBusy = settingsLoading || updatingSettings;
  const quietHoursValid = !settingsDraft?.quiet
    || [settingsDraft.quietHoursStart, settingsDraft.quietHoursEnd].every((value) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value));

  useEffect(() => {
    if (!settingsData) return;
    setSettings(settingsData);
    setSettingsDraft((draft) => settingsOpen && draft ? draft : settingsData);
  }, [settingsData, settingsOpen]);

  useEffect(() => {
    const search = (event) => { setQ(event.detail); setPage(1); };
    window.addEventListener('trukkas:global-search', search);
    return () => window.removeEventListener('trukkas:global-search', search);
  }, []);

  const filtered = useMemo(() => {
    const list = rows.filter((row) =>
      (!q || [row.title, row.message, row.category, row.id, row.actorName || ''].some((text) => text.toLowerCase().includes(q.toLowerCase())))
      && (!statuses.length || statuses.includes(row.read ? 'Read' : 'Unread'))
      && (!priorities.length || priorities.includes(row.priority))
      && (category === 'All Categories' || row.category === category)
      && (range === 'All Time' || range === 'Today' && row.dateGroup === 'Today'
        || range === 'This Week' && ['Today', 'This Week'].includes(row.dateGroup)
        || range === 'This Month' && row.dateGroup !== 'Older')
      && (tab === 'All' || tab === 'Unread' && !row.read || tab === 'Priority' && row.priority === 'High'
        || !['All', 'Unread', 'Priority'].includes(tab) && row.category === tab),
    );
    return sort === 'Oldest First' ? [...list].reverse() : list;
  }, [rows, q, statuses, priorities, category, range, tab, sort]);

  const localStatusFilter = statuses.length === 1 && !(statusIsServerFiltered && statuses[0] === 'Unread');
  const localPriorityFilter = priorities.length > 0 && !priorityIsServerFiltered;
  const localCategoryFilter = category !== 'All Categories' && !categoryIsServerFiltered;
  const localFilter = Boolean(q || localCategoryFilter || localPriorityFilter || range !== 'All Time' || localStatusFilter);
  const pageCount = Math.max(1, data?.pagination.totalPages || 1);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  }
  function toggle(list, setter, item) {
    setter(list.includes(item) ? list.filter((value) => value !== item) : [...list, item]);
    setPage(1);
  }
  function openSettings() {
    if (settings) setSettingsDraft(settings);
    setSettingsOpen(true);
  }
  async function toggleSavedSetting(key) {
    if (!settings || settingsBusy) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSettingsDraft(next);
    try {
      const updated = await updateSettings({ [SETTING_API_FIELD[key]]: next[key] }).unwrap();
      setSettings(updated);
      setSettingsDraft(updated);
      notify('Notification settings updated');
    } catch (requestError) {
      setSettings(settings);
      setSettingsDraft(settings);
      notify(errorMessage(requestError, 'Could not update notification settings. Please try again.'));
    }
  }
  async function saveSettings() {
    if (!settings || !settingsDraft || settingsBusy || !quietHoursValid) return;
    const patch = Object.fromEntries(Object.entries(SETTING_API_FIELD)
      .filter(([key]) => settingsDraft[key] !== settings[key])
      .map(([key, field]) => [field, settingsDraft[key]]));
    if (settingsDraft.quietHoursStart !== settings.quietHoursStart) patch.quietHoursStart = settingsDraft.quietHoursStart;
    if (settingsDraft.quietHoursEnd !== settings.quietHoursEnd) patch.quietHoursEnd = settingsDraft.quietHoursEnd;
    if (!Object.keys(patch).length) {
      setSettingsOpen(false);
      return;
    }
    try {
      const updated = await updateSettings(patch).unwrap();
      setSettings(updated);
      setSettingsDraft(updated);
      setSettingsOpen(false);
      notify('Notification settings saved');
    } catch (requestError) {
      notify(errorMessage(requestError, 'Could not save notification settings. Please try again.'));
    }
  }
  const settingsChanged = Boolean(settings && settingsDraft
    && (Object.keys(SETTING_API_FIELD).some((key) => settingsDraft[key] !== settings[key])
      || settingsDraft.quietHoursStart !== settings.quietHoursStart
      || settingsDraft.quietHoursEnd !== settings.quietHoursEnd));
  async function markOne(row) {
    if (row.read || markingRead) return;
    try {
      await markRead([row.id]).unwrap();
      notify('Notification marked as read');
    } catch (requestError) { notify(errorMessage(requestError)); }
  }
  function open(row) {
    setMenu(null);
    setSelected(row);
    if (!row.read) void markOne(row);
  }
  async function markAll() {
    if (markingAll) return;
    try {
      await markAllRead().unwrap();
      notify('All notifications marked as read');
    } catch (requestError) { notify(errorMessage(requestError)); }
  }
  const hasUnreadNotifications = Number(data?.summary?.allUnread) > 0 || Number(data?.unreadCount) > 0;

  return <div className="notify-page">
    <PageHeader title="Notification Center" description="Stay updated with important alerts and activities across the Trukkas platform." actions={<>
      <Button variant="outline" icon="check" onClick={markAll} disabled={markingAll || !hasUnreadNotifications}>Mark all as read</Button>
      <Button variant="outline" icon="settings" onClick={openSettings}>Notification Settings</Button>
    </>} />
    <div className="notify-layout">
      <main className="notify-main">
        <div className="notify-stats">
          <StatCard icon="bell" label="All Notifications" value={data?.summary?.allUnread ?? data?.unreadCount ?? '—'} caption="Total unread" />
          <StatCard icon="triangle-alert" tint="red" label="High Priority" value={data?.summary?.highPriority ?? '—'} caption="Requires attention" />
          <StatCard icon="clock-3" tint="amber" label="Due Today" value={data?.summary?.dueToday ?? '—'} caption="Actions due today" />
          <StatCard icon="circle-check" tint="green" label="This Week" value={data?.summary?.thisWeek ?? '—'} caption="Upcoming & recent" />
        </div>
        <Card pad="none">
          <Tabs value={tab} onChange={(value) => { setTab(value); setPage(1); }} items={TABS} style={{ padding: '0 16px' }} />
          <div className="notify-list-head">
            <strong>{range === 'Today' ? 'Today' : 'Notifications'}</strong><span />
            <select value={sort} onChange={(event) => setSort(event.target.value)}><option>Latest First</option><option>Oldest First</option></select>
            <IconButton icon="list" tone="outline" onClick={() => notify('List view active')} />
          </div>
          <div className="notify-list">
            {showingLoading && <div className="notify-empty"><Icon name="bell" size={28} /><strong>Loading notifications…</strong></div>}
            {error && <div className="notify-empty"><Icon name="triangle-alert" size={28} /><strong>{errorMessage(error)}</strong><Button variant="outline" onClick={refetch}>Try again</Button></div>}
            {!error && !showingLoading && filtered.map((row) => <div className={'notify-row ' + (!row.read ? 'unread' : '')} key={row.id} onClick={() => open(row)}>
              {!row.read && <i className="notify-dot" />}
              <span className={'notify-icon ' + row.tone}><Icon name={row.icon} size={20} /></span>
              <div className="notify-copy"><span><strong>{row.title}</strong>{row.priority && <Badge tone={row.priority === 'High' ? 'danger' : row.priority === 'Medium' ? 'warning' : 'neutral'} style={{ height: 20, fontSize: 10 }}>{row.priority}</Badge>}</span><p>{row.message}</p></div>
              <time>{row.time}</time>
              <span className="notify-menu"><IconButton icon="ellipsis-vertical" tone="outline" onClick={(event) => { event.stopPropagation(); setMenu(menu === row.id ? null : row.id); }} />
                {menu === row.id && <span className="notify-dropdown" onClick={(event) => event.stopPropagation()}><DropdownMenu width={190} items={[
                  ...(!row.read ? [{ label: 'Mark as read', icon: 'mail-check', onClick: () => { setMenu(null); void markOne(row); } }] : []),
                  { label: 'View notification', icon: 'eye', onClick: () => open(row) },
                ]} /></span>}
              </span>
            </div>)}
            {!error && !showingLoading && !filtered.length && <div className="notify-empty"><Icon name="bell-off" size={28} /><strong>No notifications found</strong><span>{localFilter ? 'No matches on this page. Try another page or change the filters.' : 'Try changing the selected filters or search.'}</span></div>}
          </div>
          {data && <Pagination page={page} pageCount={pageCount} pageSize={pageSize} total={localFilter ? undefined : data.pagination.total} onPage={(value) => setPage(Math.max(1, Math.min(value, pageCount)))} onPageSize={(value) => { setPageSize(value); setPage(1); }} />}
        </Card>
      </main>
      <aside className="notify-rail">
        <SectionCard title="Filters" action={<button className="notify-link" onClick={() => { setStatuses([]); setPriorities([]); setCategory('All Categories'); setRange('All Time'); setTab('All'); setPage(1); }}>Clear all</button>}>
          <FilterTitle>Status</FilterTitle><div className="notify-checks">{['Unread', 'Read'].map((value) => <Checkbox key={value} label={value} checked={statuses.includes(value)} onChange={() => toggle(statuses, setStatuses, value)} />)}</div>
          <FilterTitle>Priority</FilterTitle><div className="notify-checks">{['High', 'Medium', 'Low'].map((value) => <Checkbox key={value} label={value} checked={priorities.includes(value)} onChange={() => toggle(priorities, setPriorities, value)} />)}</div>
          <FilterTitle>Category</FilterTitle><select className="notify-select" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>{['All Categories', 'Maintenance', 'Jobs & Trips', 'Fleet', 'Finance', 'System', 'Ratings'].map((value) => <option key={value}>{value}</option>)}</select>
          <FilterTitle>Date Range</FilterTitle><select className="notify-select" value={range} onChange={(event) => { setRange(event.target.value); setPage(1); }}>{['All Time', 'Today', 'This Week', 'This Month'].map((value) => <option key={value}>{value}</option>)}</select>
        </SectionCard>
        <SectionCard title="Notification Settings">
          {settingsError && <div className="notify-settings-error" role="alert">{errorMessage(settingsError, 'Could not load notification settings.')} <button className="notify-link" onClick={refetchSettings}>Try again</button></div>}
          {settingsLoading && !settings && <div className="notify-settings-state">Loading notification settings…</div>}
          {Object.entries(settingLabels).map(([key, value]) => {
            const hint = key === 'quiet' && settings
              ? `${formatClock(settings.quietHoursStart)} - ${formatClock(settings.quietHoursEnd)}` : value[2];
            return <button className="notify-setting" key={key} disabled={!settings || settingsBusy} onClick={() => void toggleSavedSetting(key)}>
              <Icon name={value[0]} size={15} />
              <span><strong>{value[1]}</strong><small>{hint || ' '}</small></span>
              <b className={settings?.[key] ? 'on' : ''}>{settings ? settings[key] ? 'On' : 'Off' : '—'}</b>
              <Icon name="chevron-right" size={13} />
            </button>;
          })}
        </SectionCard>
        <SectionCard title="Need Help?"><p className="notify-help">If you’re not receiving important notifications, check your notification settings or contact support.</p><Button variant="outline" icon="headphones" onClick={() => navigate('/tickets')}>Contact Support</Button></SectionCard>
      </aside>
    </div>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title || 'Notification'} description={selected?.time || ''} footer={<Button variant="outline" onClick={() => setSelected(null)}>Close</Button>}>
      {selected?.priority && <Badge tone={selected.priority === 'High' ? 'danger' : selected.priority === 'Medium' ? 'warning' : 'neutral'}>{selected.priority} Priority</Badge>}
      {selected?.actorName && <p className="notify-detail-actor">From {selected.actorName}</p>}
      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selected?.message}</p>
    </Modal>
    <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Notification Settings" description="Choose how and when you receive notifications." footer={<><Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button><Button disabled={!settings || !settingsDraft || settingsBusy || !settingsChanged || !quietHoursValid} onClick={() => void saveSettings()}>{settingsBusy ? 'Saving…' : 'Save Settings'}</Button></>}>
      {settingsError && <div className="notify-settings-error" role="alert">{errorMessage(settingsError, 'Could not load notification settings.')} <button className="notify-link" onClick={refetchSettings}>Try again</button></div>}
      {settingsLoading && !settings && <div className="notify-settings-state">Loading notification settings…</div>}
      {settings && settingsDraft && <div className="notify-modal-settings">
        {Object.entries({ email: 'Email Notifications', push: 'Push Notifications', sms: 'SMS Notifications', quiet: 'Quiet Hours' }).map(([key, label]) => <Switch key={key} label={label} checked={settingsDraft[key]} disabled={settingsBusy} hint={key === 'quiet' ? `${formatClock(settingsDraft.quietHoursStart)} - ${formatClock(settingsDraft.quietHoursEnd)}` : undefined} onChange={(value) => setSettingsDraft({ ...settingsDraft, [key]: value })} />)}
        {settingsDraft.quiet && <div className="notify-quiet-hours">
          <label>Starts at<input type="time" value={settingsDraft.quietHoursStart} disabled={settingsBusy} onChange={(event) => setSettingsDraft({ ...settingsDraft, quietHoursStart: event.target.value })} /></label>
          <label>Ends at<input type="time" value={settingsDraft.quietHoursEnd} disabled={settingsBusy} onChange={(event) => setSettingsDraft({ ...settingsDraft, quietHoursEnd: event.target.value })} /></label>
        </div>}
        {settingsDraft.quiet && !quietHoursValid && <div className="notify-settings-error" role="alert">Enter both quiet-hour times in 24-hour HH:mm format.</div>}
      </div>}
    </Modal>
    {toast && <div className="notify-toast">{toast}</div>}
  </div>;
}
