'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Banner, Button, LabelValue, Modal, Skeleton, TextField } from '../ds.js';
import { useGetAdminTwoFactorQuery, useChangeAdminTwoFactorMutation } from '../store/features/settings/twoFactorApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

export function SettingsTwoFactorDialog({ admin, onClose }) {
  const activeAdmin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const allowed = activeAdmin === admin && authenticated;
  const query = useGetAdminTwoFactorQuery({ owner: admin.id }, { skip: !allowed, refetchOnMountOrArgChange: true });
  const [change] = useChangeAdminTwoFactorMutation();
  const [step, setStep] = useState('status'), [setup, setSetup] = useState(null), [codes, setCodes] = useState(null);
  const [proofAction, setProofAction] = useState(null), [backup, setBackup] = useState(false);
  const [code, setCode] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(null), [busy, setBusy] = useState(false);
  const pending = useRef(false), mounted = useRef(false), currentAdmin = useRef(activeAdmin);
  currentAdmin.current = activeAdmin;
  const status = query.error ? null : query.currentData;
  const formId = useId();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  function close(acknowledged = false) {
    if (pending.current || step === 'codes' && !acknowledged) return;
    setSetup(null); setCodes(null); setCode(''); setPassword(''); onClose();
  }
  async function perform(operation) {
    if (pending.current || !allowed) return;
    pending.current = true; setBusy(true); setError(null);
    const task = change({ owner: admin.id, operation,
      ...(operation === 'enable' ? { code } : {}),
      ...(['disable', 'backup-codes'].includes(operation) ? { currentPassword: password, ...(backup ? { backupCode: code } : { code }) } : {}),
    });
    try {
      const result = await task.unwrap();
      if (!mounted.current || currentAdmin.current !== admin) return;
      setCode(''); setPassword('');
      if (operation === 'setup') { setSetup(result); setStep('setup'); }
      else if (operation === 'disable') { setSetup(null); setStep('disabled'); }
      else { setSetup(null); setCodes(result.backupCodes); setStep('codes'); }
    } catch (failure) {
      if (!mounted.current || currentAdmin.current !== admin) return;
      setCode(''); setPassword(''); setError(getApiErrorMessage(failure));
      if (failure?.data?.saveUnconfirmed) { setSetup(null); setStep('uncertain'); }
    } finally {
      // Setup secrets and backup codes belong only to this open dialog. Remove
      // the mutation result immediately, including after an unmount or failure.
      task.reset(); pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function reload() {
    if (pending.current || !allowed) return;
    pending.current = true; setBusy(true); setError(null);
    try { await query.refetch().unwrap(); if (mounted.current && currentAdmin.current === admin) { setSetup(null); setStep('status'); } }
    catch (failure) { if (mounted.current) setError(getApiErrorMessage(failure)); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  function openProof(operation) {
    setCode(''); setPassword(''); setBackup(false); setError(null); setProofAction(operation); setStep('proof');
  }
  const validCode = backup ? Boolean(code.trim()) : /^\d{6}$/.test(code.trim());
  const ready = allowed && !busy;
  const footer = step === 'codes' ? <Button onClick={() => close(true)}>I have saved these codes</Button> : <>
    <Button variant="outline" disabled={busy} onClick={() => close()}>Close</Button>
    {step === 'setup' && <Button type="submit" form={formId} disabled={!ready || !/^\d{6}$/.test(code.trim())}>{busy ? 'Enabling…' : 'Enable 2FA'}</Button>}
    {step === 'proof' && <Button type="submit" form={formId} variant={proofAction === 'disable' ? 'danger' : 'primary'} disabled={!ready || !password || !validCode}>{busy ? 'Saving…' : proofAction === 'disable' ? 'Turn off 2FA' : 'Create new backup codes'}</Button>}
    {step === 'uncertain' && <Button disabled={!ready} onClick={reload}>Reload status</Button>}
  </>;

  return <Modal open title="Configure 2FA" width={560} onClose={() => close()} footer={footer}>
    <form id={formId} onSubmit={(event) => { event.preventDefault(); if (!ready) return; if (step === 'setup' && /^\d{6}$/.test(code.trim())) void perform('enable'); if (step === 'proof' && password && validCode) void perform(proofAction); }} style={{ display: 'grid', gap: 16 }}>
      {error && <Banner tone="danger">{error}</Banner>}
      {step === 'status' && (query.isLoading || query.isFetching && !query.currentData ? <Skeleton height={180} /> : query.error ? <>
        <Banner tone="danger">{getApiErrorMessage(query.error)}</Banner><Button variant="outline" disabled={!ready} onClick={reload}>Try again</Button>
      </> : status ? <>
        <LabelValue label="Two-factor authentication" value={status.enabled ? 'On' : 'Off'} />
        <LabelValue label="Method" value={status.method === 'TOTP' ? 'Authenticator app' : '—'} />
        {status.enabled && <LabelValue label="Backup codes remaining" value={status.backupCodesRemaining ?? '—'} />}
        {!status.available ? <Banner tone="info">Two-factor setup is unavailable for this account.</Banner> : status.enabled ? <>
          <Button variant="outline" disabled={!ready || query.isFetching} onClick={() => openProof('backup-codes')}>Create new backup codes</Button>
          <Button variant="danger" disabled={!ready || query.isFetching} onClick={() => openProof('disable')}>Turn off 2FA</Button>
        </> : <>
          <p className="tk-meta">Use an authenticator app to add a verification code to your admin sign-in.</p>
          <Button disabled={!ready || query.isFetching} onClick={() => perform('setup')}>{busy ? 'Preparing…' : 'Set up authenticator'}</Button>
        </>}
      </> : '—')}
      {step === 'setup' && setup && <>
        <p className="tk-meta">Add this key manually in your authenticator app, then enter its six-digit code.</p>
        <LabelValue label="Issuer" value={setup.issuer} /><LabelValue label="Account" value={setup.account} />
        <TextField label="Authenticator key" value={setup.secret} readOnly autoComplete="off" spellCheck={false} />
        <TextField label="Authenticator code" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" inputMode="numeric" maxLength={6} disabled={busy} autoFocus />
        <p className="tk-meta">Two-factor authentication stays off until your code is accepted.</p>
      </>}
      {step === 'proof' && <>
        <p className="tk-meta">{proofAction === 'disable' ? 'Confirm your password and an authenticator or backup code to turn off 2FA.' : 'New backup codes replace every old backup code. Confirm your password and an authenticator or backup code.'}</p>
        <TextField label="Current password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={busy} autoFocus />
        <TextField label={backup ? 'Backup code' : 'Authenticator code'} value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" inputMode={backup ? 'text' : 'numeric'} maxLength={backup ? undefined : 6} disabled={busy} spellCheck={false} />
        <Button variant="ghost" disabled={busy} onClick={() => { setBackup(!backup); setCode(''); }}>{backup ? 'Use authenticator code' : 'Use a backup code'}</Button>
      </>}
      {step === 'codes' && codes && <>
        <Banner tone="success">Two-factor authentication is on.</Banner>
        <p className="tk-meta">Save these ten backup codes somewhere secure before closing. Each code works once. They cannot be shown again.</p>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: '500 14px/24px var(--tk-font-mono)' }}>{codes.join('\n')}</pre>
      </>}
      {step === 'disabled' && <Banner tone="success">Two-factor authentication is off.</Banner>}
      {step === 'uncertain' && <p className="tk-meta">Reload the saved status before taking another action. If 2FA is on and you did not receive backup codes, create a new set after confirming your password and authenticator code.</p>}
    </form>
  </Modal>;
}
