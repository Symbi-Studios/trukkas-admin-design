'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Banner, Button, Modal, TextField } from '../ds.js';
import { useVerifyAdminTwoFactorMutation } from '../store/features/auth/authApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

export function AdminTwoFactorChallengeDialog({ challenge, onClose, onComplete }) {
  const [verify] = useVerifyAdminTwoFactorMutation();
  const [backup, setBackup] = useState(false), [code, setCode] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const [expired, setExpired] = useState(() => Date.parse(challenge.expiresAt) <= Date.now());
  const [locked, setLocked] = useState(false);
  const pending = useRef(false), mounted = useRef(false), request = useRef(null);
  const formId = useId();
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(challenge.expiresAt) - Date.now()));
    return () => { mounted.current = false; clearTimeout(timer); request.current?.abort(); };
  }, [challenge.expiresAt]);
  const valid = !expired && !locked && (backup ? Boolean(code.trim()) : /^\d{6}$/.test(code.trim()));
  async function submit(event) {
    event.preventDefault();
    if (pending.current || !valid) return;
    pending.current = true; setBusy(true); setError(null);
    const task = verify({ challengeId: challenge.challengeId, ...(backup ? { backupCode: code } : { code }) });
    request.current = task;
    try { await task.unwrap(); if (mounted.current) { setCode(''); onComplete(); } }
    catch (failure) {
      if (!mounted.current) return;
      setCode(''); setError(getApiErrorMessage(failure));
      const status = failure?.status === 'PARSING_ERROR' ? failure.originalStatus : failure?.status;
      if (status === 401) setExpired(true);
      const reason = [failure?.data?.code, failure?.data?.errorCode, failure?.data?.message].filter((value) => typeof value === 'string').join(' ');
      if (reason.includes('TWO_FACTOR_LOCKED')) setLocked(true);
    } finally { task.reset(); request.current = null; pending.current = false; if (mounted.current) setBusy(false); }
  }
  function close() { if (!pending.current) { setCode(''); onClose(); } }
  return <Modal open title="Verify your sign-in" width={480} onClose={close} footer={<>
    <Button variant="outline" disabled={busy} onClick={close}>Back to sign in</Button>
    <Button type="submit" form={formId} disabled={busy || !valid}>{busy ? 'Verifying…' : 'Verify'}</Button>
  </>}>
    <form id={formId} onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      {error && <Banner tone="danger">{error}</Banner>}
      {expired ? <Banner tone="warning">This sign-in challenge has expired. Sign in again to get a new one.</Banner> : locked ? <Banner tone="warning">Two-factor verification is temporarily locked. Try signing in again after the lock period.</Banner> : <>
        <p className="tk-meta">{backup ? 'Enter one of your single-use backup codes.' : 'Enter the six-digit code from your authenticator app.'}</p>
        <TextField label={backup ? 'Backup code' : 'Authenticator code'} name="two-factor-code" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" inputMode={backup ? 'text' : 'numeric'} maxLength={backup ? undefined : 6} disabled={busy} spellCheck={false} autoFocus />
        <Button variant="ghost" disabled={busy || !backup && challenge.backupCodesRemaining === 0} onClick={() => { setBackup(!backup); setCode(''); setError(null); }}>{backup ? 'Use authenticator code' : 'Use a backup code'}</Button>
      </>}
    </form>
  </Modal>;
}
