'use client';

import { useMemo, useState } from 'react';
import { Banner, Button, Checkbox, ColorSwatchPicker, Modal, Select, Skeleton, TextField, Textarea } from '../ds.js';
import { useGetAdminRoleQuery, grantedRoleKeys } from '../store/features/roles/rolesApi.js';
import { ROLE_ICON_VALUES, roleEditorValues } from '../store/features/roles/roleContracts.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

export function RolePermissionDialog({ title, modules, selectedKeys, onApply, onClose, loading = false }) {
  const [keys, setKeys] = useState(selectedKeys || []);
  const editable = Boolean(onApply);
  return <Modal open title={title} width={600} onClose={onClose} footer={editable ? <>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button disabled={!keys.length || loading} onClick={() => onApply(keys)}>Apply</Button>
  </> : <Button variant="outline" onClick={onClose}>Close</Button>}>
    <div style={{ display: 'grid', gap: 16 }}>
      {loading ? <Skeleton height={100} /> : modules.map((module) => <div key={module.key} style={{ display: 'grid', gap: 10 }}>
        <strong>{module.name}</strong>
        {module.actions.map((action) => <div key={action.key} style={{ display: 'grid', gap: 2 }}>
          {editable ? <Checkbox label={action.name} checked={keys.includes(action.key)} onChange={(checked) => setKeys((current) => checked ? [...current, action.key] : current.filter((key) => key !== action.key))} />
            : <span>{action.name} · {Object.hasOwn(action, 'granted') ? action.granted === true ? 'Granted' : action.granted === false ? 'Not granted' : '—' : action.key}</span>}
          <span className="tk-meta">{action.description}</span>
        </div>)}
      </div>)}
    </div>
  </Modal>;
}

function RoleEditForm({ role: loadedRole, catalog, operations, onClose, onSaved }) {
  const [role] = useState(loadedRole);
  const editor = roleEditorValues(role);
  const iconNames = Object.keys(ROLE_ICON_VALUES);
  const originalIcon = editor.icon;
  const originalKeys = useMemo(() => grantedRoleKeys(role, catalog), [role, catalog]);
  const [name, setName] = useState(editor.name);
  const [description, setDescription] = useState(editor.description);
  const [status, setStatus] = useState(role.statusCode === 'ACTIVE' ? 'Active' : role.statusCode === 'INACTIVE' ? 'Inactive' : '');
  const [color, setColor] = useState(editor.color);
  const [icon, setIcon] = useState(originalIcon);
  const [keys, setKeys] = useState(originalKeys || []);
  const [permissionsChanged, setPermissionsChanged] = useState(false);
  const [error, setError] = useState(null);
  const editingDisabled = operations.saving || !operations.canManage;
  const changes = {};
  if (name !== editor.name) changes.name = name.trim();
  if (description !== editor.description) changes.description = description;
  if (status && status !== (role.statusCode === 'ACTIVE' ? 'Active' : role.statusCode === 'INACTIVE' ? 'Inactive' : '')) changes.isActive = status === 'Active';
  if (color !== editor.color) changes.color = color;
  if (icon !== originalIcon && ROLE_ICON_VALUES[icon]) changes.icon = ROLE_ICON_VALUES[icon];
  if (permissionsChanged) changes.permissionKeys = keys;
  const valid = Boolean(role.version && Object.keys(changes).length && name.trim());
  async function save() {
    if (!valid || operations.saving) return;
    setError(null);
    try {
      const saved = await operations.perform({ action: 'edit', id: role.id, expectedVersion: role.version, changes, catalog });
      if (saved) { onSaved(saved); onClose(); }
    } catch (error) { setError(error instanceof Error ? error.message : getApiErrorMessage(error)); }
  }
  return <Modal open title="Edit Role" description={role.name} width={640} onClose={() => { if (!operations.saving) onClose(); }} footer={<>
    <Button variant="outline" disabled={operations.saving} onClick={onClose}>Cancel</Button>
    <Button disabled={!valid || operations.saving || !operations.canManage} onClick={save}>Save</Button>
  </>}>
    <div style={{ display: 'grid', gap: 16 }}>
      {error && <Banner tone="danger" title="Unable to save">{error}</Banner>}
      {!role.version && <Banner tone="warning" title="Version unavailable">Refresh the role before saving.</Banner>}
      {role.isSystem === true && <Banner tone="warning" title="System role">Permission changes affect every company using this role.</Banner>}
      <TextField label="Role Name" required placeholder="—" value={name} disabled={role.isSystem !== false || editingDisabled} onChange={(event) => setName(event.target.value)} />
      <Textarea label="Description" maxLength={500} value={description} disabled={editingDisabled} onChange={(event) => setDescription(event.target.value)} />
      <Select label="Status" placeholder="Select status" options={['Active', 'Inactive']} value={status} disabled={editingDisabled} onChange={(event) => setStatus(event.target.value)} />
      <ColorSwatchPicker value={color} onChange={(value) => { if (!editingDisabled) setColor(value); }} />
      <Select label="Icon" placeholder="Select icon" options={iconNames} value={icon} disabled={editingDisabled} onChange={(event) => setIcon(event.target.value)} />
      {!originalKeys ? <Banner tone="warning" title="Permissions unavailable">The full permission matrix is required before editing permissions.</Banner> : catalog.modules.map((module) => <div key={module.key} style={{ display: 'grid', gap: 10 }}>
        <strong>{module.name}</strong>
        {module.actions.map((action) => <Checkbox key={action.key} label={action.name} checked={keys.includes(action.key)} disabled={editingDisabled} onChange={(checked) => {
          setPermissionsChanged(true); setKeys((current) => checked ? [...current, action.key] : current.filter((key) => key !== action.key));
        }} />)}
      </div>)}
    </div>
  </Modal>;
}

export function RoleEditDialog({ id, catalog, operations, onClose, onSaved }) {
  const query = useGetAdminRoleQuery({ id, owner: operations.owner }, { skip: !operations.authenticated, refetchOnMountOrArgChange: true });
  const role = !query.isError && operations.authenticated ? query.currentData : null;
  if (!role || !catalog) return <Modal open title="Edit Role" onClose={onClose} footer={<Button variant="outline" onClick={onClose}>Cancel</Button>}>
    {query.isFetching ? <Skeleton height={120} /> : <Banner tone="danger" title="Unable to load role">{query.error ? getApiErrorMessage(query.error) : 'The role and permission catalogue must load before editing.'}</Banner>}
  </Modal>;
  return <RoleEditForm key={operations.owner + ':' + role.id} role={role} catalog={catalog} operations={operations} onClose={onClose} onSaved={onSaved} />;
}
