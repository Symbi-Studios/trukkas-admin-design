'use client';

import React from 'react';
import { Button, DropdownMenu, Icon } from '../../ds.js';
import styles from './SupportInbox.module.css';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILES = 5, MAX_BYTES = 10 * 1024 * 1024;
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Reply / internal-note box pinned under the conversation.
 *  - onSend({ mode: 'reply' | 'note', content, files, then }) resolves true when saved;
 *    `then` is an optional status to set after a reply ('Pending' | 'Resolved').
 *  - ref exposes focus('reply' | 'note') for keyboard shortcuts.
 */
export const TicketComposer = React.forwardRef(function TicketComposer(
  { canReply, canNote = true, disabled, templates = [], onSend, onError, resolved }, ref,
) {
  const [mode, setMode] = React.useState('reply');
  const [drafts, setDrafts] = React.useState({ reply: '', note: '' });
  const [files, setFiles] = React.useState({ reply: [], note: [] });
  const [menu, setMenu] = React.useState(null); // 'send' | 'templates' | null
  const [sending, setSending] = React.useState(false);
  const area = React.useRef(null), picker = React.useRef(null), wrap = React.useRef(null);

  // Default to Reply once we know replying is allowed (the ticket loads after the composer mounts),
  // unless the admin has already picked a tab themselves.
  const chosen = React.useRef(false);
  React.useEffect(() => {
    if (disabled) return; // still loading or saving: don't flip tabs on a guess
    if (!canReply && mode === 'reply') setMode('note');
    else if (canReply && mode === 'note' && !chosen.current) setMode('reply');
  }, [canReply, mode, disabled]);
  const pick = (next) => { chosen.current = true; setMode(next); };
  React.useImperativeHandle(ref, () => ({
    focus(next) {
      if (next === 'reply' && !canReply) return;
      if (next) { chosen.current = true; setMode(next); }
      requestAnimationFrame(() => area.current?.focus());
    },
  }), [canReply]);
  React.useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => { if (!wrap.current?.contains(event.target)) setMenu(null); };
    const escape = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setMenu(null); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape, true); };
  }, [menu]);

  // Grow with the text, up to a cap, then scroll.
  const text = drafts[mode];
  React.useLayoutEffect(() => {
    const el = area.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, [text, mode]);

  const blocked = disabled || sending || (mode === 'reply' ? !canReply : !canNote);
  const ready = !blocked && text.trim().length > 0;

  async function submit(then = null) {
    if (!ready) return;
    setMenu(null); setSending(true);
    const ok = await onSend?.({ mode, content: text.trim(), files: files[mode], then });
    setSending(false);
    if (ok) { setDrafts((d) => ({ ...d, [mode]: '' })); setFiles((f) => ({ ...f, [mode]: [] })); }
  }
  function choose(event) {
    const picked = Array.from(event.target.files || []); event.target.value = '';
    if (!picked.length) return;
    const next = [...files[mode], ...picked];
    if (next.length > MAX_FILES || picked.some((file) => !ACCEPT.includes(file.type) || file.size === 0 || file.size > MAX_BYTES)) {
      onError?.('Attach up to 5 JPEG, PNG, WebP or PDF files, 10 MB each.'); return;
    }
    setFiles((f) => ({ ...f, [mode]: next }));
  }
  function insertTemplate(template) {
    setMenu(null);
    setDrafts((d) => ({ ...d, [mode]: d[mode] ? d[mode].replace(/\s*$/, '\n\n') + template.body : template.body }));
    requestAnimationFrame(() => { const el = area.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  }

  const note = mode === 'note';
  return (
    <div ref={wrap} className={styles.composer} data-note={note || undefined}>
      <div className={styles.composerTabs} role="tablist" aria-label="Message type">
        <button type="button" role="tab" aria-selected={!note} disabled={!canReply || sending} onClick={() => pick('reply')}>Reply</button>
        <button type="button" role="tab" aria-selected={note} disabled={sending} onClick={() => pick('note')}>Internal note</button>
        {!canReply && <span className={styles.composerHint}>Only Finance and Technical admins can reply to payment tickets.</span>}
      </div>
      <textarea
        ref={area}
        className={styles.composerInput}
        aria-label={note ? 'Internal note' : 'Reply to customer'}
        placeholder={note ? 'Add a note only admins can see…' : resolved ? 'Replying reopens the conversation for the customer…' : 'Write a reply…'}
        value={text}
        rows={3}
        disabled={blocked}
        onChange={(event) => setDrafts((d) => ({ ...d, [mode]: event.target.value }))}
        onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); } }}
      />
      {files[mode].length > 0 && (
        <ul className={styles.fileChips} aria-label="Attachments">
          {files[mode].map((file, index) => (
            <li key={file.name + index}>
              <Icon name={file.type === 'application/pdf' ? 'file-text' : 'image'} size={13} aria-hidden="true" />
              <span title={file.name}>{file.name}</span>
              <button type="button" aria-label={`Remove ${file.name}`} disabled={sending}
                onClick={() => setFiles((f) => ({ ...f, [mode]: f[mode].filter((_, i) => i !== index) }))}>
                <Icon name="x" size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.composerBar}>
        <input ref={picker} type="file" hidden multiple accept={ACCEPT.join(',')} onChange={choose} />
        <Button variant="ghost" size="sm" icon="paperclip" disabled={blocked} onClick={() => picker.current?.click()} aria-label="Attach files" />
        <span className={styles.menuAnchor}>
          <Button variant="ghost" size="sm" icon="text-quote" disabled={blocked || !templates.length}
            aria-haspopup="menu" aria-expanded={menu === 'templates'} onClick={() => setMenu(menu === 'templates' ? null : 'templates')}>
            Templates
          </Button>
          {menu === 'templates' && (
            <DropdownMenu width={300} style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, maxHeight: 280, overflowY: 'auto', zIndex: 'var(--tk-z-dropdown)' }}
              items={templates.map((template) => ({ label: template.title, icon: 'text', onClick: () => insertTemplate(template) }))} />
          )}
        </span>
        <span className={styles.composerKbd} aria-hidden="true">{isMac ? '⌘' : 'Ctrl'} ↵ to send</span>
        <span className={styles.menuAnchor} style={{ marginLeft: 'auto' }}>
          <span className={styles.sendGroup}>
            <Button size="sm" loading={sending} disabled={!ready} onClick={() => submit()} variant={note ? 'outline' : 'primary'}>
              {note ? 'Add note' : 'Send'}
            </Button>
            {!note && (
              <Button size="sm" icon="chevron-down" aria-label="More send options" aria-haspopup="menu" aria-expanded={menu === 'send'}
                disabled={!ready} onClick={() => setMenu(menu === 'send' ? null : 'send')} />
            )}
          </span>
          {menu === 'send' && (
            <DropdownMenu width={230} style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, zIndex: 'var(--tk-z-dropdown)' }}
              items={[
                { label: 'Send and wait on customer', icon: 'clock-3', onClick: () => submit('Pending') },
                { label: 'Send and resolve', icon: 'circle-check', onClick: () => submit('Resolved') },
              ]} />
          )}
        </span>
      </div>
    </div>
  );
});
