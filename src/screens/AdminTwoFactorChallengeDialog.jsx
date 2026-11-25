'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Banner, Button, Modal, TextField } from '../ds.js';
import { verifyTwoFactorAction } from '../lib/auth/actions';
import { setCredentials } from '../store/features/auth/authSlice.js';

export function AdminTwoFactorChallengeDialog({ challenge, onClose, onComplete }) {
  const dispatch = useDispatch();
  const [backup, setBackup] = useState(false), [code, setCode] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const [expired, setExpired] = useState(() => Date.parse(challenge.expiresAt) <= Date.now());
  const [locked, setLocked] = useState(false);
  const pending = useRef(false), mounted = useRef(false);
  const formId = useId();
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(challenge.expiresAt) - Date.now()));
    return () => { mounted.current = false; clearTimeout(timer); };
  }, [challenge.expiresAt]);
  const valid = !expired && !locked && (backup ? Boolean(code.trim()) : /^\d{6}$/.test(code.trim()));
  async function submit(event) {
    event.preventDefault();
    if (pending.current || !valid) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      // runs on the Next.js server: on success the tokens go into httpOnly cookies
      const result = await verifyTwoFactorAction({ challengeId: challenge.challengeId, ...(backup ? { backupCode: code } : { code }) });
      if (!mounted.current) return;
      if (result.ok && !result.twoFactorRequired) {
        dispatch(setCredentials({ admin: result.admin }));
        setCode(''); onComplete();
        return;
      }
      setCode('');
      const failure = result.ok ? { status: 502, message: 'The sign-in could not be completed. Try again.' } : result.error;
      setError(failure.message);
      if (failure.status === 401) setExpired(true);
      if ([failure.code, failure.message].filter(Boolean).join(' ').includes('TWO_FACTOR_LOCKED')) setLocked(true);
    } catch {
      if (mounted.current) { setCode(''); setError('Something went wrong. Please try again.'); }
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
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