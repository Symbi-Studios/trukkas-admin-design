'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import { PageHeader, Button, StatCard, Card, SectionCard, Tabs, Checkbox, Switch, Icon, IconButton, DropdownMenu, Pagination, Modal } from '../ds.js';
import {
  useGetAdminNotificationsQuery,
  useMarkAdminNotificationsReadMutation,
  useMarkAllAdminNotificationsReadMutation,
} from '../store/features/notifications/notificationsApi.js';
import './Notifications.css';

const TABS = ['All', 'Unread', 'Priority', 'System', 'Jobs & Trips', 'Fleet', 'Finance', 'Ratings', 'Maintenance'];
const settingLabels = {
  email: ['mail', 'Email Notifications', 'Receive notifications via email'],
  push: ['bell', 'Push Notifications', 'Receive push notifications'],
  sms: ['message-square', 'SMS Notifications', 'Receive SMS notifications'],
  quiet: ['moon', 'Quiet Hours', '10:00 PM - 7:00 AM'],
};

function errorMessage(error) {
  const message = error?.data?.message || error?.data?.error || error?.message || error?.error;
  return Array.isArray(message) ? message.join(', ') : typeof message === 'string' && message.trim()
    ? message : 'Could not load notifications. Please try again.';
}

function FilterTitle({ children }) { return <h4 className="notify-filter-title">{children}</h4>; }

export function NotificationCenter() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [statuses, setStatuses] = useState(['Unread']);
  const [category, setCategory] = useState('All Categories');
  const [range, setRange] = useState('All Time');
  const [sort, setSort] = useState('Latest First');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menu, setMenu] = useState(null);
  const [selected, setSelected] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ email: true, push: true, sms: false, quiet: false });
  const [toast, setToast] = useState('');

  const apiTab = tab === 'Priority' ? 'alerts'
    : tab === 'Jobs & Trips' || category === 'Jobs & Trips' ? 'jobs'
      : tab === 'Finance' || category === 'Finance' ? 'payments'
        : tab === 'Unread' || (statuses.length === 1 && statuses[0] === 'Unread') ? 'unread' : 'all';
  const { currentData: data, isLoading, isFetching, error, refetch } = useGetAdminNotificationsQuery(
    { page, limit: pageSize, tab: apiTab },
    { refetchOnMountOrArgChange: true },
  );
  const [markRead, { isLoading: markingRead }] = useMarkAdminNotificationsReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllAdminNotificationsReadMutation();
  const rows = data?.rows || [];
  const showingLoading = isLoading || (isFetching && !data);

  useEffect(() => {
    const search = (event) => { setQ(event.detail); setPage(1); };
    window.addEventListener('trukkas:global-search', search);
    return () => window.removeEventListener('trukkas:global-search', search);
  }, []);

  const filtered = useMemo(() => {
    const list = rows.filter((row) =>
      (!q || [row.title, row.message, row.category, row.id].some((text) => text.toLowerCase().includes(q.toLowerCase())))
      && (!statuses.length || statuses.includes(row.read ? 'Read' : 'Unread'))
      && (category === 'All Categories' || row.category === category)
      && (range === 'All Time' || range === 'Today' && row.dateGroup === 'Today'
        || range === 'This Week' && ['Today', 'This Week'].includes(row.dateGroup)
        || range === 'This Month' && row.dateGroup !== 'Older')
      && (tab === 'All' || tab === 'Unread' && !row.read || tab === 'Priority'
        || !['All', 'Unread', 'Priority'].includes(tab) && row.category === tab),
    );
    return sort === 'Oldest First' ? [...list].reverse() : list;
  }, [rows, q, statuses, category, range, tab, sort]);

  const localFilter = Boolean(q || (category !== 'All Categories' && !['Jobs & Trips', 'Finance'].includes(category))
    || range !== 'All Time' || (statuses.length === 1 && (statuses[0] === 'Read' || apiTab !== 'unread'))
    || !['All', 'Unread', 'Priority', 'Jobs & Trips', 'Finance'].includes(tab));
  const pageCount = Math.max(1, data?.pagination.totalPages || 1);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  }
  function toggle(list, setter, item) {
    setter(list.includes(item) ? list.filter((value) => value !== item) : [...list, item]);
    setPage(1);
  }
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

  return <div className="notify-page">
    <PageHeader title="Notification Center" description="Stay updated with important alerts and activities across the Trukkas platform." actions={<>
      <Button variant="outline" icon="check" onClick={markAll} disabled={markingAll || !data?.unreadCount}>Mark all as read</Button>
      <Button variant="outline" icon="settings" onClick={() => setSettingsOpen(true)}>Notification Settings</Button>
    </>} />
    <div className="notify-layout">
      <main className="notify-main">
        <div className="notify-stats">
          <StatCard icon="bell" label="All Notifications" value={data?.unreadCount ?? '—'} caption="Total unread" />
          <StatCard icon="triangle-alert" tint="red" label="High Priority" value="—" caption="Requires attention" />
          <StatCard icon="clock-3" tint="amber" label="Due Today" value="—" caption="Actions due today" />
          <StatCard icon="circle-check" tint="green" label="This Week" value="—" caption="Upcoming & recent" />
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
              <div className="notify-copy"><span><strong>{row.title}</strong></span><p>{row.message}</p></div>
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
        <SectionCard title="Filters" action={<button className="notify-link" onClick={() => { setStatuses([]); setCategory('All Categories'); setRange('All Time'); setTab('All'); setPage(1); }}>Clear all</button>}>
          <FilterTitle>Status</FilterTitle><div className="notify-checks">{['Unread', 'Read'].map((value) => <Checkbox key={value} label={value} checked={statuses.includes(value)} onChange={() => toggle(statuses, setStatuses, value)} />)}</div>
          <FilterTitle>Priority</FilterTitle><div className="notify-checks">{['High', 'Medium', 'Low'].map((value) => <Checkbox key={value} label={value} checked={false} disabled />)}</div>
          <FilterTitle>Category</FilterTitle><select className="notify-select" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>{['All Categories', 'Maintenance', 'Jobs & Trips', 'Fleet', 'Finance', 'System', 'Ratings'].map((value) => <option key={value}>{value}</option>)}</select>
          <FilterTitle>Date Range</FilterTitle><select className="notify-select" value={range} onChange={(event) => { setRange(event.target.value); setPage(1); }}>{['All Time', 'Today', 'This Week', 'This Month'].map((value) => <option key={value}>{value}</option>)}</select>
        </SectionCard>
        <SectionCard title="Notification Settings">{Object.entries(settingLabels).map(([key, value]) => <button className="notify-setting" key={key} onClick={() => setSettings({ ...settings, [key]: !settings[key] })}><Icon name={value[0]} size={15} /><span><strong>{value[1]}</strong><small>{value[2]}</small></span><b className={settings[key] ? 'on' : ''}>{settings[key] ? 'On' : 'Off'}</b><Icon name="chevron-right" size={13} /></button>)}</SectionCard>
        <SectionCard title="Need Help?"><p className="notify-help">If you’re not receiving important notifications, check your notification settings or contact support.</p><Button variant="outline" icon="headphones" onClick={() => navigate('/tickets')}>Contact Support</Button></SectionCard>
      </aside>
    </div>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title || 'Notification'} description={selected?.time || ''} footer={<Button variant="outline" onClick={() => setSelected(null)}>Close</Button>}>
      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selected?.message}</p>
    </Modal>
    <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Notification Settings" description="Choose how and when you receive notifications." footer={<><Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button><Button onClick={() => { setSettingsOpen(false); notify('Notification settings saved'); }}>Save Settings</Button></>}>
      <div className="notify-modal-settings">{Object.entries({ email: 'Email Notifications', push: 'Push Notifications', sms: 'SMS Notifications', quiet: 'Quiet Hours' }).map(([key, label]) => <Switch key={key} label={label} checked={settings[key]} onChange={(value) => setSettings({ ...settings, [key]: value })} />)}</div>
    </Modal>
    {toast && <div className="notify-toast">{toast}</div>}
  </div>;
}
