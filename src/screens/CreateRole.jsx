'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  PageHeader, Button, SectionCard, TextField, Select, Textarea, ColorSwatchPicker, ChoiceCard,
  Switch, SearchField, PermissionRow, Banner,
} from '../ds.js';
import { ROLE_MODULE_MATRIX, ROLE_SCOPES } from '../store/features/roles/rolesConfig.js';
import { useGetAdminPermissionsQuery } from '../store/features/roles/rolesApi.js';
import { useRoleOperations } from '../store/features/roles/useRoleOperations.js';
import { buildRoleConfiguration, buildRoleAccess, catalogForRow, permissionsForConfiguration } from '../store/features/roles/roleContracts.js';
import { RolePermissionDialog } from './RoleDialogs.jsx';

const ROLE_TYPES = ['System', 'Custom'];
const ICONS = ['Shield', 'Shield Check', 'Users', 'Key', 'Eye', 'Wallet', 'User'];

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
  const operations = useRoleOperations();
  const { owner, authenticated, saving } = operations;
  const catalogQuery = useGetAdminPermissionsQuery({ owner }, { skip: !authenticated });
  const catalog = authenticated && !catalogQuery.isError ? catalogQuery.currentData : undefined;
  const [permissionKeys, setPermissionKeys] = useState({});
  const [permissionDialog, setPermissionDialog] = useState(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => { setName(''); setDescription(''); setRoleType(''); setStatus('Active'); setColor('#0241E8'); setIcon('Shield'); setScope('org'); setManageUsers(true); setRequire2fa(false); setLevels(initialLevels()); setPermissionKeys({}); setPermQ(''); setPermissionDialog(null); setPreview(null); }, [owner]);
  const values = { name, description, roleType, status, color, icon, scope, manageUsers, require2fa, levels, permissionKeys };
  function chooseLevel(key, level) {
    if (saving) return;
    if (level === 'custom') {
      if (!catalog) { window.alert('Wait for the permission catalogue to load.'); return; }
      const modules = catalogForRow(catalog, key);
      if (!modules.length) { window.alert('This module is unavailable in the permission catalogue.'); return; }
      setPermissionDialog({ key, modules });
    } else setLevels((current) => ({ ...current, [key]: level }));
  }
  async function save() {
    try { buildRoleConfiguration(values, catalog); } catch (error) { window.alert(error.message); return; }
    const saved = await operations.performWithAlert({ action: 'create', values, catalog });
    if (saved) navigate('/roles');
  }
  function showPreview() {
    try { setPreview(permissionsForConfiguration({ moduleAccess: buildRoleAccess(values, catalog) }, catalog)); }
    catch (error) { window.alert(error.message); }
  }

  const visibleModules = useMemo(() => (
    !permQ ? ROLE_MODULE_MATRIX : ROLE_MODULE_MATRIX.filter((m) => m.label.toLowerCase().includes(permQ.toLowerCase()))
  ), [permQ]);

  function setAll(level) {
    if (!saving) setLevels(Object.fromEntries(ROLE_MODULE_MATRIX.map((m) => [m.key, level])));
  }

  return (
    <>
      <PageHeader crumbs={['Administration', 'Roles & Permissions', 'Create New Role']} title="Create New Role"
        description="Define role details and set permissions to control access across the platform."
        actions={<>
          <Button variant="outline" disabled={saving} onClick={() => navigate('/roles')}>Cancel</Button>
          <Button icon="shield" disabled={!operations.canManage || saving || catalogQuery.isFetching || !catalog || !name.trim() || !roleType} onClick={save}>{saving ? 'Creating…' : 'Create Role'}</Button>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Role Information">
            <div style={{ display: 'grid', gap: 14 }}>
              <TextField label="Role Name" required placeholder="e.g. Operations Manager" value={name} disabled={saving}
                onChange={(e) => setName(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Select label="Role Type" required placeholder="Select role type" options={ROLE_TYPES} value={roleType} disabled={saving}
                  onChange={(e) => setRoleType(e.target.value)} />
                <Select label="Status" required options={['Active', 'Inactive']} value={status} disabled={saving}
                  leadingDot={status === 'Active' ? 'var(--tk-success)' : 'var(--tk-ink-300)'}
                  onChange={(e) => setStatus(e.target.value)} />
              </div>
              <Textarea label="Description" placeholder="Describe the purpose and scope of this role…" maxLength={500}
                value={description} disabled={saving} onChange={(e) => setDescription(e.target.value)} />

              <div>
                <span style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>Role Color &amp; Icon</span>
                <div className="tk-meta" style={{ marginBottom: 8 }}>Choose a color and icon to visually identify this role.</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
                  <ColorSwatchPicker value={color} onChange={(value) => { if (!saving) setColor(value); }} />
                  <Select label="Icon" style={{ minWidth: 160 }} options={ICONS} value={icon} disabled={saving}
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
                  description={s.description} onSelect={() => { if (!saving) setScope(s.key); }} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Additional Settings">
            <div style={{ display: 'grid', gap: 16 }}>
              <Switch checked={manageUsers} disabled={saving} onChange={(value) => { if (!saving) setManageUsers(value); }} label="Allow this role to manage users"
                hint="Can create, edit and deactivate user accounts." />
              <Switch checked={require2fa} disabled={saving} onChange={(value) => { if (!saving) setRequire2fa(value); }} label="Require 2FA for users with this role"
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
                  <PermissionRow key={m.key} icon={m.icon} module={m.label} actions={m.actions ? (catalogForRow(catalog, m.key).length ? String(catalogForRow(catalog, m.key).reduce((count, source) => count + source.actions.length, 0)) : '—') : undefined}
                    value={levels[m.key]} onChange={(v) => chooseLevel(m.key, v)} />
                ))}
              </div>
            </div>

            <Banner tone="info" title="Full Access grants all current permissions in a module."
              action={<Button variant="outline" size="sm" icon="eye" disabled={!catalog || catalogQuery.isFetching || saving} onClick={showPreview}>Preview Permissions</Button>}>
              Custom Access allows you to select specific actions.
            </Banner>
          </div>
        </SectionCard>
      </div>
      {permissionDialog && <RolePermissionDialog key={owner + ":" + permissionDialog.key} title="Custom Access" modules={permissionDialog.modules} selectedKeys={permissionKeys[permissionDialog.key]} onClose={() => setPermissionDialog(null)} onApply={(keys) => { setPermissionKeys((current) => ({ ...current, [permissionDialog.key]: keys })); setLevels((current) => ({ ...current, [permissionDialog.key]: 'custom' })); setPermissionDialog(null); }} />}
      {preview && <RolePermissionDialog title="Preview Permissions" modules={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
