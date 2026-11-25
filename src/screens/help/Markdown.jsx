'use client';

import React from 'react';

// A small Markdown renderer for article previews: headings, paragraphs, lists, bold, italic,
// inline code, code blocks, links and quotes. It builds React elements, so no HTML is injected.
function inline(text, keyBase) {
  const out = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0, match, i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0], key = `${keyBase}-${i++}`;
    if (token.startsWith('**') || token.startsWith('__')) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith('[')) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const safe = /^(https?:|mailto:|\/)/i.test(href) ? href : null;
      out.push(safe ? <a key={key} href={safe} target="_blank" rel="noopener noreferrer">{label}</a> : label);
    } else out.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }) {
  const blocks = [];
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    if (line.startsWith('```')) {
      const code = []; i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i += 1; blocks.push(<pre key={key++}><code>{code.join('\n')}</code></pre>); continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) { const Tag = `h${Math.min(4, heading[1].length + 1)}`; blocks.push(<Tag key={key++}>{inline(heading[2], key)}</Tag>); i += 1; continue; }
    if (/^\s*([-*])\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line), items = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[i])) items.push(lines[i++].replace(/^\s*(?:[-*]|\d+[.)])\s+/, ''));
      const List = ordered ? 'ol' : 'ul';
      blocks.push(<List key={key++}>{items.map((item, n) => <li key={n}>{inline(item, `${key}-${n}`)}</li>)}</List>); continue;
    }
    if (line.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key++}>{inline(quote.join(' '), key)}</blockquote>); continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={key++}>{para.flatMap((text, n) => (n ? [<br key={`b${n}`} />, ...inline(text, `${key}-${n}`)] : inline(text, `${key}-${n}`)))}</p>);
  }
  return <div className={className}>{blocks}</div>;
}
