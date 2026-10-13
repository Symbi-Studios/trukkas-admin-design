'use client';

import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Modal, Button, TextField, Textarea, Select, DataTable } from '../ds.js';
import { useLazyGetManagedUserProfileQuery, useGetManagedUserRoleChoicesQuery, useRunManagedUserActionMutation, useUpdateManagedUserPermissionsMutation, useSendManagedUserMessageMutation, useImportManagedUsersMutation, useLazyGetManagedUserDownloadQuery, managedUserKey } from '../store/features/users/usersApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { DriverTableLoading } from './DriversLoading.jsx';
const TITLES = {
  lock: 'Lock Account',
  unlock: 'Unlock Account',
  'force-logout': 'Force Logout',
  delete: 'Delete User',
  'password-reset': 'Reset Password',
  permissions: 'Update Permissions',
  EMAIL: 'Send Email',
  SMS: 'Send SMS',
  import: 'Import Users'
};
export function useManagedUserOperations() {
  const admin = useSelector(s => s.auth.admin);
  const [dialog, setDialog] = useState(null);
  const [loadProfile] = useLazyGetManagedUserProfileQuery();
  const [downloadFile] = useLazyGetManagedUserDownloadQuery();
  const busy = useRef(false),
    generation = useRef(0);
  useEffect(() => { generation.current += 1; setDialog(null); }, [admin?.id]);
  async function open(action, target) {
    if (busy.current) return;
    if (action === 'import') {
      setDialog({
        action,
        owner: admin?.id
      });
      return;
    }
    if (!target?.isAccount) {
      window.alert('This record is an invitation, not an account.');
      return;
    }
    if (target.source === 'admin' && admin?.role !== 'SUPER_ADMIN') {
      window.alert('Only Super Admins can manage admin accounts.');
      return;
    }
    if (action === 'delete' && (target.source === 'admin' || admin?.role !== 'SUPER_ADMIN')) {
      window.alert('Only Super Admins can delete platform users. Admin accounts cannot be deleted.');
      return;
    }
    if (target.source === 'admin' && target.backendId === admin?.id && ['lock', 'force-logout'].includes(action)) {
      window.alert('You cannot revoke your own access.');
      return;
    }
    if (action === 'password-reset' && (target.source === 'user' && target.phone === '—' || target.source === 'admin' && target.email === '—')) {
      window.alert('The account needs a delivery address before a reset can be sent.');
      return;
    }
    if (action === 'EMAIL' && target.email === '—') {
      window.alert('This account has no email address.');
      return;
    }
    if (action === 'SMS' && (target.source === 'admin' || target.phone === '—')) {
      window.alert('This account has no SMS phone number.');
      return;
    }
    if (action === 'permissions' && target.source !== 'admin' && target.roleKind !== 'TEAM_ROLE') {
      window.alert('Role assignment applies to company team seats and admin access levels.');
      return;
    }
    busy.current = true;
    const version = ++generation.current;
    try {
      const fresh = await loadProfile({
        id: target.backendId,
        source: target.source,
        owner: admin?.id
      }, false).unwrap();
      if (generation.current === version) setDialog({
        action,
        target: fresh,
        owner: admin?.id
      });
    } catch (error) {
      window.alert(getApiErrorMessage(error));
    } finally {
      busy.current = false;
    }
  }
  function close() {
    generation.current++;
    setDialog(null);
  }
  async function download(kind, target) {
    if (busy.current || !target?.isAccount) return;
    if (admin?.role !== 'SUPER_ADMIN') {
      window.alert('Only Super Admins can download account reports and exports.');
      return;
    }
    busy.current = true;
    try {
      const result = await downloadFile({
        id: target.backendId,
        source: target.source,
        kind,
        owner: admin?.id
      }, false).unwrap();
      const link = document.createElement('a');
      link.href = result.url;
      link.download = result.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(result.url), 1000);
    } catch (error) {
      window.alert(getApiErrorMessage(error));
    } finally {
      busy.current = false;
    }
  }
  return {
    open,
    close,
    download,
    dialog
  };
}
export function UserActionDialogs({
  operations,
  onDeleted
}) {
  return operations.dialog ? <AccountDialog key={operations.dialog.action + ':' + (operations.dialog.target?.id || 'import')} dialog={operations.dialog} onClose={operations.close} onDeleted={onDeleted} /> : null;
}
function AccountDialog({
  dialog,
  onClose,
  onDeleted
}) {
  const {
      action,
      target,
      owner
    } = dialog,
    admin = useSelector(s => s.auth.admin);
  const [reason, setReason] = useState(''),
    [roleId, setRoleId] = useState(''),
    [subject, setSubject] = useState(''),
    [message, setMessage] = useState(''),
    [file, setFile] = useState(null),
    [result, setResult] = useState(null),
    [saving, setSaving] = useState(false);
  const pending = useRef(false),
    request = useRef(null);
  const [runAction] = useRunManagedUserActionMutation(),
    [savePermissions] = useUpdateManagedUserPermissionsMutation(),
    [sendMessage] = useSendManagedUserMessageMutation(),
    [importUsers] = useImportManagedUsersMutation();
  const roleQuery = useGetManagedUserRoleChoicesQuery({
      source: target?.source,
      entityId: target?.entityId,
      owner
    }, {
      skip: action !== 'permissions',
      refetchOnMountOrArgChange: true
    }),
    roles = roleQuery.error ? [] : roleQuery.currentData || [];
  const messageAction = ['EMAIL', 'SMS'].includes(action),
    reasonAction = ['lock', 'unlock', 'force-logout', 'delete'].includes(action);
  function keyFor(body) {
    const signature = JSON.stringify(body);
    if (request.current?.signature !== signature) request.current = {
      signature,
      key: managedUserKey()
    };
    return request.current.key;
  }
  async function submit() {
    if (pending.current || saving || owner !== admin?.id) return;
    pending.current = true;
    setSaving(true);
    try {
      let response;
      if (action === 'import') {
        response = await importUsers({
          file,
          owner
        }).unwrap();
        setResult(response);
        return;
      }
      const base = {
        id: target.backendId,
        source: target.source,
        owner
      };
      if (action === 'permissions') response = await savePermissions({
        ...base,
        roleId,
        expectedVersion: target.version
      }).unwrap();else if (messageAction) {
        const body = {
          ...base,
          channel: action,
          subject,
          message
        };
        response = await sendMessage({
          ...body,
          key: keyFor(body)
        }).unwrap();
      } else {
        const body = {
          ...base,
          action,
          reason,
          expectedVersion: target.version
        };
        response = await runAction({
          ...body,
          key: ['delete', 'password-reset'].includes(action) ? keyFor(body) : undefined
        }).unwrap();
      }
      window.alert(response.message);
      onClose();
      if (action === 'delete') onDeleted?.();
    } catch (error) {
      window.alert(getApiErrorMessage(error));
      if (action === 'import') onClose();
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  const disabled = saving || owner !== admin?.id || result != null || reasonAction && (!reason.trim() || !target?.version) || action === 'permissions' && (!target?.version || !roles.some(r => r.value === roleId) || roleQuery.isFetching) || messageAction && (!message.trim() || action === 'EMAIL' && !subject.trim()) || action === 'import' && !file;
  return <Modal open onClose={() => {
    if (!saving) onClose();
  }} title={TITLES[action]} description={target ? `${target.name} · ${target.email}` : 'Upload a CSV containing accountType, email, name and role. Platform users also require phone.'} footer={<><Button variant="outline" disabled={saving} onClick={onClose}>{result ? 'Close' : 'Cancel'}</Button>{!result && <Button variant={action === 'delete' ? 'danger' : 'primary'} disabled={disabled} onClick={submit}>{saving ? 'Saving…' : action === 'import' ? 'Import Users' : messageAction ? 'Send' : action === 'password-reset' ? 'Send Reset' : 'Confirm'}</Button>}</>}>
    <div style={{
      display: 'grid',
      gap: 14
    }}>
      {reasonAction && <><p className="tk-body">{action === 'delete' ? 'This anonymises personal data and signs the user out. Jobs, transactions and audit records are retained.' : action === 'lock' ? 'This blocks sign-in and ends active sessions.' : action === 'unlock' ? 'This restores access by clearing the account lock.' : 'This ends all active sessions.'}</p><Textarea label="Reason" required value={reason} onChange={e => setReason(e.target.value)} /></>}
      {action === 'password-reset' && <p className="tk-body">{target.source === 'admin' ? 'Send a password reset link to this admin’s email address.' : 'Send a password reset code by SMS to this user’s phone number.'}</p>}
      {action === 'permissions' && (roleQuery.isFetching ? <DriverTableLoading columns={1} label="Loading roles" /> : roleQuery.error ? <p className="tk-body">{getApiErrorMessage(roleQuery.error)}</p> : <Select label="Role" required value={roleId} options={roles} onChange={e => setRoleId(e.target.value)} />)}
      {messageAction && <>{action === 'EMAIL' && <TextField label="Subject" required value={subject} onChange={e => setSubject(e.target.value)} />}<Textarea label="Message" required value={message} onChange={e => setMessage(e.target.value)} /></>}
      {action === 'import' && !result && <TextField label="CSV File" type="file" accept=".csv,text/csv" aria-label="CSV file" disabled={saving} onChange={e => setFile(e.target.files?.[0] || null)} />}
      {result && <><p className="tk-body">{result.processed} processed · {result.created} created · {result.failed} failed</p><DataTable rows={result.rows} rowKey={r => r.row} columns={[{
          key: 'row',
          header: 'Row'
        }, {
          key: 'email',
          header: 'Email',
          render: r => r.email || '—'
        }, {
          key: 'status',
          header: 'Status'
        }, {
          key: 'error',
          header: 'Error',
          render: r => r.error || '—'
        }]} /></>}
    </div>
  </Modal>;
}
