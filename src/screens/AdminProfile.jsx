'use client';

import { useMemo, useState } from 'react';
import {
  Avatar, Badge, Button, Card, Icon, LabelValue, PageHeader, ProgressBar,
  SectionCard, Switch, Tabs, TextField, Timeline,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { changeUserPassword, updateUserProfile } from '../mock/api.js';
import { userActivityFor } from '../mock/fixtures/users.js';
import './AdminProfile.css';

function Notice({ children }) {
  if (!children) return null;
  return (
    <div className="tk-profile-notice" role="status">
      <Icon name="circle-check" size={17} />
      <span>{children}</span>
    </div>
  );
}

function OverviewTab({ user, notify }) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone,
    location: user.location,
  });
  const [saving, setSaving] = useState(false);

  function field(key) {
    return {
      value: form[key],
      onChange: (event) => setForm((current) => ({ ...current, [key]: event.target.value })),
    };
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    await updateUserProfile(user.id, form);
    setSaving(false);
    notify('Personal information updated.');
  }

  return (
    <div className="tk-profile-columns">
      <SectionCard title="Personal information" description="Update the details attached to your administrator account." icon="user-round">
        <form onSubmit={saveProfile} className="tk-profile-form">
          <TextField label="Full name" required {...field('name')} />
          <TextField label="Work email" required type="email" {...field('email')} />
          <TextField label="Phone number" type="tel" {...field('phone')} />
          <TextField label="Location" {...field('location')} />
          <div className="tk-profile-form-actions">
            <Button type="submit" icon="save" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </form>
      </SectionCard>

      <div className="tk-profile-stack">
        <SectionCard title="Role & access" description="Your access is managed by the platform owner." icon="shield-check">
          <div className="tk-profile-role-heading">
            <span className="tk-profile-icon-tile"><Icon name="key-round" size={20} /></span>
            <div>
              <Badge tone="purple">{user.role}</Badge>
              <p className="tk-profile-role-copy">Full administrative access across the Trukkas platform.</p>
            </div>
          </div>
          <LabelValue label="Department" value={user.department} />
          <LabelValue label="Entity" value={user.entity} />
          <LabelValue label="Access scope" value={user.permissionsCaption} />
          <LabelValue label="Account status" value={<Badge dot tone="success">{user.status}</Badge>} />
        </SectionCard>

        <SectionCard title="Account details" icon="fingerprint">
          <LabelValue label="Admin ID" value={<span className="tk-mono">{user.id}</span>} />
          <LabelValue label="Member since" value={user.joinedOn} />
          <LabelValue label="Last active" value={user.lastActive} />
        </SectionCard>
      </div>
    </div>
  );
}

function SecurityTab({ user, notify }) {
  const [twoFactor, setTwoFactor] = useState(user.twoFactor);
  const [loginNotifications, setLoginNotifications] = useState(user.loginNotifications);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');

  async function toggleSetting(key, value) {
    if (key === 'twoFactor') setTwoFactor(value);
    else setLoginNotifications(value);
    await updateUserProfile(user.id, { [key]: value });
    notify(key === 'twoFactor' ? `Two-factor authentication ${value ? 'enabled' : 'disabled'}.` : 'Login notification preference updated.');
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (!passwords.current || passwords.next.length < 12) {
      setError('Enter your current password and use at least 12 characters for the new password.');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setError('New passwords do not match.');
      return;
    }
    await changeUserPassword(user.id);
    setPasswords({ current: '', next: '', confirm: '' });
    setError('');
    notify('Password changed successfully.');
  }

  const passwordField = (key) => ({
    value: passwords[key],
    onChange: (event) => setPasswords((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <div className="tk-profile-columns">
      <div className="tk-profile-stack">
        <SectionCard title="Password" description={`Last changed ${user.passwordLastChanged}.`} icon="lock-keyhole">
          <form onSubmit={submitPassword} className="tk-profile-password-form">
            <TextField label="Current password" type="password" autoComplete="current-password" {...passwordField('current')} />
            <div className="tk-profile-form">
              <TextField label="New password" type="password" autoComplete="new-password" hint="At least 12 characters" {...passwordField('next')} />
              <TextField label="Confirm new password" type="password" autoComplete="new-password" {...passwordField('confirm')} />
            </div>
            {error && <p className="tk-profile-error" role="alert">{error}</p>}
            <Button type="submit" icon="key-round">Change password</Button>
          </form>
        </SectionCard>

        <SectionCard title="Sign-in protection" icon="shield-check">
          <div className="tk-profile-switches">
            <Switch checked={twoFactor} onChange={(value) => toggleSetting('twoFactor', value)}
              label="Two-factor authentication" hint="Require a verification code when signing in." />
            <Switch checked={loginNotifications} onChange={(value) => toggleSetting('loginNotifications', value)}
              label="Login notifications" hint="Email me when my account signs in on a new device." />
          </div>
        </SectionCard>
      </div>

      <div className="tk-profile-stack">
        <SectionCard title="Security health" icon="shield">
          <ProgressBar value={user.passwordStrengthPct} color="var(--tk-success)" label="Password strength" caption={user.passwordStrength} />
          <div className="tk-profile-security-list">
            <div><Icon name="circle-check" size={16} /><span>Work email verified</span></div>
            <div><Icon name="circle-check" size={16} /><span>Phone number verified</span></div>
            <div><Icon name="circle-check" size={16} /><span>No failed sign-in attempts</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Current session" description="The device you are using right now." icon="monitor-smartphone">
          <div className="tk-profile-session">
            <span className="tk-profile-icon-tile"><Icon name="laptop" size={20} /></span>
            <div>
              <strong>Chrome on macOS</strong>
              <span>Lagos, Nigeria · 197.210.45.12</span>
              <Badge dot tone="success">Active now</Badge>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function ActivityTab({ user }) {
  const activity = useMemo(() => userActivityFor(user).map((item) => ({
    title: item.text,
    description: `${item.description} · ${item.location} · ${item.ip}`,
    time: item.time,
    icon: item.icon,
    state: item.text === 'Password Changed' ? 'warning' : 'done',
  })), [user]);

  return (
    <div className="tk-profile-activity-layout">
      <SectionCard title="Recent activity" description="A record of your latest actions across Trukkas." icon="history">
        <Timeline items={activity} />
      </SectionCard>
      <SectionCard title="Activity summary" icon="chart-no-axes-column-increasing">
        <div className="tk-profile-stat-grid">
          <div><strong>{user.totalLogins}</strong><span>Total sign-ins</span></div>
          <div><strong>{user.activeSessions}</strong><span>Active session</span></div>
          <div><strong>{user.failedLogins}</strong><span>Failed attempts</span></div>
        </div>
        <p className="tk-profile-muted">Activity is retained for security and audit purposes.</p>
      </SectionCard>
    </div>
  );
}

export function AdminProfile() {
  const users = useCollection('users') || [];
  const user = users.find((row) => row.you) || users[0];
  const [tab, setTab] = useState('overview');
  const [notice, setNotice] = useState('');

  if (!user) return null;

  function notify(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  }

  return (
    <>
      <PageHeader crumbs={['Account', 'My profile']} title="My profile"
        description="Manage your personal details, access, and account security." />
      <Notice>{notice}</Notice>

      <Card className="tk-profile-hero" tone="navy" pad="none">
        <div className="tk-profile-hero-accent" />
        <div className="tk-profile-identity">
          <Avatar name={user.name} size={76} square tone="var(--tk-blue)" style={{ border: '3px solid rgba(255,255,255,.18)' }} />
          <div className="tk-profile-identity-copy">
            <div className="tk-profile-name-line">
              <h2>{user.name}</h2>
              <Badge tone="purple">{user.role}</Badge>
            </div>
            <span>{user.email}</span>
            <div className="tk-profile-meta-line">
              <span><Icon name="building-2" size={14} />{user.entity}</span>
              <span><Icon name="map-pin" size={14} />{user.location}</span>
              <span><span className="tk-profile-online-dot" />Active now</span>
            </div>
          </div>
        </div>
        <div className="tk-profile-hero-stats">
          <div><span>Access</span><strong>Full platform</strong></div>
          <div><span>2FA</span><strong>{user.twoFactor ? 'Protected' : 'Not enabled'}</strong></div>
          <div><span>Last sign-in</span><strong>Today, 10:24 AM</strong></div>
        </div>
      </Card>

      <Card pad="none">
        <Tabs value={tab} onChange={setTab} style={{ padding: '0 var(--tk-card-pad)' }} items={[
          { value: 'overview', label: 'Profile details' },
          { value: 'security', label: 'Security' },
          { value: 'activity', label: 'Recent activity' },
        ]} />
      </Card>

      {tab === 'overview' && <OverviewTab user={user} notify={notify} />}
      {tab === 'security' && <SecurityTab user={user} notify={notify} />}
      {tab === 'activity' && <ActivityTab user={user} />}
    </>
  );
}
