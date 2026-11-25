'use client';

import React from 'react';
import { Icon } from '../../ds.js';
import { htmlToMarkdown, markdownToHtml } from './richText.js';
import styles from './Help.module.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const mod = isMac ? '⌘' : 'Ctrl+';

const BLOCKS = [
  { value: 'p', label: 'Text' },
  { value: 'h2', label: 'Heading' },
  { value: 'h3', label: 'Subheading' },
];

function Tool({ icon, label, active, onClick, shortcut, disabled }) {
  return (
    <button type="button" className={styles.tool} aria-label={label} title={shortcut ? `${label} (${shortcut})` : label} aria-pressed={active}
      disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      <Icon name={icon} size={15} aria-hidden="true" />
    </button>
  );
}

function currentBlock(root) {
  let node = window.getSelection()?.anchorNode;
  while (node && node !== root) {
    if (node.nodeType === 1 && /^(H2|H3|H4|P|BLOCKQUOTE|LI|PRE)$/.test(node.tagName)) return node.tagName.toLowerCase();
    node = node.parentNode;
  }
  return 'p';
}

/**
 * What-you-see-is-what-you-get editor for help articles. The backend stores Markdown (the apps
 * render it), so this edits rich text and hands back Markdown on every change. `resetKey`
 * reloads `value` into the editor (e.g. after loading a saved article).
 */
export function RichTextEditor({ value, onChange, disabled, placeholder, resetKey }) {
  const ref = React.useRef(null);
  const [state, setState] = React.useState({ block: 'p', bold: false, italic: false, ul: false, ol: false, quote: false, link: false });
  const [linking, setLinking] = React.useState(null); // { url, range }
  const [empty, setEmpty] = React.useState(!value?.trim());

  React.useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = markdownToHtml(value) || '<p><br></p>';
    setEmpty(!value?.trim());
    // Only reload when the source document changes, not on every keystroke.
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = React.useCallback(() => {
    const md = htmlToMarkdown(ref.current);
    setEmpty(!md.trim());
    onChange(md);
  }, [onChange]);

  const refresh = React.useCallback(() => {
    const root = ref.current;
    if (!root || !root.contains(window.getSelection()?.anchorNode)) return;
    const block = currentBlock(root);
    let node = window.getSelection()?.anchorNode, link = false;
    while (node && node !== root) { if (node.nodeName === 'A') link = true; node = node.parentNode; }
    setState({
      block, link, quote: block === 'blockquote',
      bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'),
      ul: document.queryCommandState('insertUnorderedList'), ol: document.queryCommandState('insertOrderedList'),
    });
  }, []);

  React.useEffect(() => {
    document.addEventListener('selectionchange', refresh);
    return () => document.removeEventListener('selectionchange', refresh);
  }, [refresh]);

  function run(command, arg) {
    if (disabled) return;
    ref.current.focus();
    document.execCommand('defaultParagraphSeparator', false, 'p');
    document.execCommand(command, false, arg);
    emit(); refresh();
  }
  const toggleBlock = (tag) => run('formatBlock', state.block === tag ? '<p>' : `<${tag}>`);

  function startLink() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !ref.current.contains(selection.anchorNode)) return;
    if (state.link) { run('unlink'); return; }
    setLinking({ url: 'https://', range: selection.getRangeAt(0).cloneRange() });
  }
  function applyLink(event) {
    event.preventDefault();
    const url = linking.url.trim();
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(linking.range);
    if (/^(https?:\/\/.+|mailto:.+|\/.*)$/i.test(url)) {
      if (linking.range.collapsed) run('insertHTML', `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>`);
      else run('createLink', url);
    }
    setLinking(null);
  }


  return (
    <div className={styles.rte} data-disabled={disabled || undefined}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
        <div className={styles.blockPicker} role="group" aria-label="Text style">
          {BLOCKS.map((b) => (
            <button key={b.value} type="button" aria-pressed={state.block === b.value || (b.value === 'p' && !['h2', 'h3'].includes(state.block))}
              disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => run('formatBlock', `<${b.value}>`)}>{b.label}</button>
          ))}
        </div>
        <span className={styles.toolSep} />
        <Tool disabled={disabled} icon="bold" label="Bold" shortcut={`${mod}B`} active={state.bold} onClick={() => run('bold')} />
        <Tool disabled={disabled} icon="italic" label="Italic" shortcut={`${mod}I`} active={state.italic} onClick={() => run('italic')} />
        <Tool disabled={disabled} icon="link" label={state.link ? 'Remove link' : 'Link'} shortcut={`${mod}K`} active={state.link} onClick={startLink} />
        <span className={styles.toolSep} />
        <Tool disabled={disabled} icon="list" label="Bulleted list" active={state.ul} onClick={() => run('insertUnorderedList')} />
        <Tool disabled={disabled} icon="list-ordered" label="Numbered list" active={state.ol} onClick={() => run('insertOrderedList')} />
        <Tool disabled={disabled} icon="text-quote" label="Quote" active={state.quote} onClick={() => toggleBlock('blockquote')} />
        <span className={styles.toolSep} />
        <Tool disabled={disabled} icon="undo-2" label="Undo" shortcut={`${mod}Z`} onClick={() => run('undo')} />
        <Tool disabled={disabled} icon="redo-2" label="Redo" shortcut={isMac ? '⇧⌘Z' : 'Ctrl+Y'} onClick={() => run('redo')} />
      </div>
      {linking && (
        <form className={styles.linkBar} onSubmit={applyLink}>
          <Icon name="link" size={14} aria-hidden="true" />
          <input autoFocus value={linking.url} aria-label="Link address" onChange={(event) => setLinking({ ...linking, url: event.target.value })}
            onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setLinking(null); ref.current.focus(); } }} />
          <button type="submit">Add link</button>
          <button type="button" onClick={() => { setLinking(null); ref.current.focus(); }}>Cancel</button>
        </form>
      )}
      <div className={styles.surface}>
        {empty && <span className={styles.placeholder} aria-hidden="true">{placeholder}</span>}
        <div ref={ref} className={`${styles.content} ${styles.md}`} contentEditable={!disabled} suppressContentEditableWarning
          role="textbox" aria-multiline="true" aria-label="Article body" spellCheck
          onInput={emit}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); startLink(); }
          }}
          onPaste={(event) => {
            // Paste as plain text so formatting from other apps doesn't leak in.
            event.preventDefault();
            document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
          }} />
      </div>
    </div>
  );
}
