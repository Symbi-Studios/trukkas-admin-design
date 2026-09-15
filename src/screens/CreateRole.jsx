'use client';

import { useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  PageHeader, Button, SectionCard, TextField, Select, Textarea, ColorSwatchPicker, ChoiceCard,
  Switch, SearchField, PermissionRow, Banner,
} from '../ds.js';
import { ROLE_MODULE_MATRIX, ROLE_SCOPES } from '../mock/fixtures/roles.js';
import { createRole } from '../mock/api.js';

const ROLE_TYPES = ['System', 'Custom'];
const ICONS = ['Shield', 'Shield Check', 'Users', 'Key', 'Eye', 'Wallet', 'User'];
const ICON_NAME = { Shield: 'shield', 'Shield Check': 'shield-check', Users: 'users-round', Key: 'key-round', Eye: 'eye', Wallet: 'wallet', User: 'user' };

function initialLevels() {
  return Object.fromEntries(ROLE_MODULE_MATRIX.map((m) => [m.key, m.level]));
}

export function CreateRole() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [roleType, setRoleType] = useState('');
  const [status, setStatus] = useState('Active');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#0241E8');
  const [icon, setIcon] = useState('Shield');
  const [scope, setScope] = useState('org');
  const [manageUsers, setManageUsers] = useState(true);
  const [require2fa, setRequire2fa] = useState(false);
  const [levels, setLevels] = useState(initialLevels);
  const [permQ, setPermQ] = useState('');
  const [saving, setSaving] = useState(false);

  const visibleModules = useMemo(() => (
    !permQ ? ROLE_MODULE_MATRIX : ROLE_MODULE_MATRIX.filter((m) => m.label.toLowerCase().includes(permQ.toLowerCase()))
  ), [permQ]);

  const grantedCount = Object.values(levels).filter((l) => l !== 'none').length;

  function setAll(level) {
    setLevels(Object.fromEntries(ROLE_MODULE_MATRIX.map((m) => [m.key, level])));
  }

  async function handleCreate() {
    setSaving(true);
    await createRole({
      name, type: roleType || 'Custom', status, description, color, icon: ICON_NAME[icon],
      permissionsCount: grantedCount,
    });
    setSaving(false);
    navigate('/roles');
  }

  return (
    <>
      <PageHeader crumbs={['Administration', 'Roles & Permissions', 'Create New Role']} title="Create New Role"
        description="Define role details and set permissions to control access across the platform."
        actions={<>
          <Button variant="outline" onClick={() => navigate('/roles')}>Cancel</Button>
          <Button icon="shield" disabled={saving || !name || !roleType}
            onClick={handleCreate}>{saving ? 'Creating…' : 'Create Role'}</Button>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Role Information">
            <div style={{ display: 'grid', gap: 14 }}>
              <TextField label="Role Name" required placeholder="e.g. Operations Manager" value={name}
                onChange={(e) => setName(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Select label="Role Type" required placeholder="Select role type" options={ROLE_TYPES} value={roleType}
                  onChange={(e) => setRoleType(e.target.value)} />
                <Select label="Status" required options={['Active', 'Inactive']} value={status}
                  leadingDot={status === 'Active' ? 'var(--tk-success)' : 'var(--tk-ink-300)'}
                  onChange={(e) => setStatus(e.target.value)} />
              </div>
              <Textarea label="Description" placeholder="Describe the purpose and scope of this role…" maxLength={500}
                value={description} onChange={(e) => setDescription(e.target.value)} />

              <div>
                <span style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>Role Color &amp; Icon</span>
                <div className="tk-meta" style={{ marginBottom: 8 }}>Choose a color and icon to visually identify this role.</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
                  <ColorSwatchPicker value={color} onChange={setColor} />
                  <Select label="Icon" style={{ minWidth: 160 }} options={ICONS} value={icon}
                    onChange={(e) => setIcon(e.target.value)} />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Role Scope">
            <span className="tk-meta" style={{ marginTop: -8, marginBottom: 10, display: 'block' }}>Define the data scope this role can access.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {ROLE_SCOPES.map((s) => (
                <ChoiceCard key={s.key} selected={scope === s.key} icon={s.icon} title={s.title}
                  description={s.description} onSelect={() => setScope(s.key)} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Additional Settings">
            <div style={{ display: 'grid', gap: 16 }}>
              <Switch checked={manageUsers} onChange={setManageUsers} label="Allow this role to manage users"
                hint="Can create, edit and deactivate user accounts." />
              <Switch checked={require2fa} onChange={setRequire2fa} label="Require 2FA for users with this role"
                hint="Enforce two-factor authentication for added security." />
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Permissions"
          action={<span style={{ display: 'flex', gap: 14 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setAll('full'); }}>Select All</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setAll('none'); }}>Deselect All</a>
          </span>}>
          <div style={{ display: 'grid', gap: 14 }}>
            <span className="tk-meta" style={{ marginTop: -8 }}>Select the modules and actions this role can access.</span>
            <SearchField placeholder="Search modules or permissions…" value={permQ}
              onChange={(e) => setPermQ(e.target.value)} />

            <div className="tk-mobile-scroll" style={{ border: '1px solid var(--tk-line)', borderRadius: 'var(--tk-r-lg)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 130px)', alignItems: 'center',
                           padding: '10px 16px', borderBottom: '1px solid var(--tk-line)', background: 'var(--tk-surface-sunk)' }}>
                <span style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>Module</span>
                <span style={{ textAlign: 'center' }}>
                  <div style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>Full Access</div>
                  <div className="tk-meta">All permissions</div>
                </span>
                <span style={{ textAlign: 'center' }}>
                  <div style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>Custom Access</div>
                  <div className="tk-meta">Select actions</div>
                </span>
                <span style={{ textAlign: 'center' }}>
                  <div style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>No Access</div>
                  <div className="tk-meta">No permissions</div>
                </span>
              </div>
              <div className="tk-scroll" style={{ maxHeight: 460, overflowY: 'auto' }}>
                {visibleModules.map((m) => (
                  <PermissionRow key={m.key} icon={m.icon} module={m.label} actions={m.actions}
                    value={levels[m.key]} onChange={(v) => setLevels((cur) => ({ ...cur, [m.key]: v }))} />
                ))}
              </div>
            </div>

            <Banner tone="info" title="Full Access grants all current and future permissions in a module."
              action={<Button variant="outline" size="sm" icon="eye">Preview Permissions</Button>}>
              Custom Access allows you to select specific actions.
            </Banner>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
