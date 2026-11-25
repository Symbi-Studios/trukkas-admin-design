// Converts between the Markdown the backend stores (and the apps render) and the HTML the
// rich-text editor edits. Only the formatting the editor offers is supported: headings,
// paragraphs, bold, italic, inline code, links, bulleted and numbered lists, quotes and code blocks.

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeHref = (href) => (/^(https?:|mailto:|\/)/i.test(href) ? href : null);

function inlineHtml(text) {
  let out = '', last = 0, match;
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  while ((match = pattern.exec(text))) {
    out += escapeHtml(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) out += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
    else if (token.startsWith('`')) out += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
    else if (token.startsWith('[')) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      out += safeHref(href) ? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>` : escapeHtml(label);
    } else out += `<em>${escapeHtml(token.slice(1, -1))}</em>`;
    last = match.index + token.length;
  }
  return out + escapeHtml(text.slice(last));
}

export function markdownToHtml(source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    if (line.startsWith('```')) {
      const code = []; i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i += 1; html.push(`<pre>${escapeHtml(code.join('\n'))}</pre>`); continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) { const level = Math.min(4, Math.max(2, heading[1].length)); html.push(`<h${level}>${inlineHtml(heading[2])}</h${level}>`); i += 1; continue; }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line), items = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[i])) items.push(lines[i++].replace(/^\s*(?:[-*]|\d+[.)])\s+/, ''));
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${items.map((item) => `<li>${inlineHtml(item)}</li>`).join('')}</${tag}>`); continue;
    }
    if (line.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${inlineHtml(quote.join(' '))}</blockquote>`); continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) para.push(lines[i++]);
    html.push(`<p>${para.map(inlineHtml).join('<br>')}</p>`);
  }
  return html.join('');
}

function inlineMarkdown(node) {
  let out = '';
  for (const child of node.childNodes) {
    if (child.nodeType === 3) { out += child.textContent.replace(/ /g, ' '); continue; }
    if (child.nodeType !== 1) continue;
    const tag = child.tagName, inner = inlineMarkdown(child);
    if (tag === 'BR') out += '\n';
    else if (!inner.trim()) out += inner;
    else if (tag === 'STRONG' || tag === 'B') out += wrap(inner, '**');
    else if (tag === 'EM' || tag === 'I') out += wrap(inner, '*');
    else if (tag === 'CODE') out += '`' + child.textContent + '`';
    else if (tag === 'A') { const href = safeHref(child.getAttribute('href') || ''); out += href ? `[${inner.trim()}](${href})` : inner; }
    else if (tag === 'SPAN' && child.style?.fontWeight >= 600) out += wrap(inner, '**');
    else out += inner;
  }
  return out;
}
// Keep spaces outside the markers: "** bold**" is not bold in Markdown.
function wrap(text, mark) {
  const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
  return lead + mark + text.trim() + mark + trail;
}

function listMarkdown(list) {
  const ordered = list.tagName === 'OL';
  return [...list.children].filter((li) => li.tagName === 'LI').map((li, n) => {
    const nested = [...li.children].filter((c) => c.tagName === 'UL' || c.tagName === 'OL');
    const clone = li.cloneNode(true);
    clone.querySelectorAll('ul,ol').forEach((c) => c.remove());
    const line = `${ordered ? `${n + 1}.` : '-'} ${inlineMarkdown(clone).replace(/\n+/g, ' ').trim()}`;
    return [line, ...nested.map((c) => listMarkdown(c).split('\n').map((l) => '   ' + l).join('\n'))].join('\n');
  }).join('\n');
}

const BLOCK_TAGS = /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|PRE)$/;

export function htmlToMarkdown(root) {
  const blocks = [];
  const pushInline = (text) => { const t = text.replace(/[ \t]+\n/g, '\n').trim(); if (t) blocks.push(t); };
  let loose = '';
  const flush = () => { pushInline(loose); loose = ''; };
  for (const node of root.childNodes) {
    if (node.nodeType === 3) { loose += node.textContent; continue; }
    if (node.nodeType !== 1) continue;
    const tag = node.tagName;
    if (['STRONG', 'B', 'EM', 'I', 'A', 'CODE', 'SPAN', 'BR'].includes(tag)) { loose += inlineMarkdown({ childNodes: [node] }); continue; }
    flush();
    if (/^H[1-6]$/.test(tag)) { const t = inlineMarkdown(node).trim(); if (t) blocks.push(`${'#'.repeat(Math.min(4, Math.max(2, Number(tag[1]))))} ${t}`); }
    else if (tag === 'UL' || tag === 'OL') { const t = listMarkdown(node); if (t.trim()) blocks.push(t); }
    else if (tag === 'BLOCKQUOTE') { const t = inlineMarkdown(node).trim(); if (t) blocks.push(t.split('\n').map((l) => '> ' + l).join('\n')); }
    else if (tag === 'PRE') { const t = node.textContent.replace(/\n$/, ''); if (t.trim()) blocks.push('```\n' + t + '\n```'); }
    // Browsers sometimes nest blocks (e.g. a list inside a <p>); treat such wrappers as containers.
    else if ([...node.children].some((child) => BLOCK_TAGS.test(child.tagName))) { const inner = htmlToMarkdown(node); if (inner) blocks.push(inner); }
    else pushInline(inlineMarkdown(node));
  }
  flush();
  return blocks.join('\n\n');
}
