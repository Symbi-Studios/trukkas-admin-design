'use client';

import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import { PageHeader, Card, Button, IconButton, Banner, Icon, Select } from '../ds.js';
import { FAQ_CATEGORIES, CATEGORY_ICONS, useCreateAdminFaqMutation, useGetAdminFaqCategoriesQuery } from '../store/features/faq/faqApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import './Support.css';
import './FaqCreate.css';

const LIMITS = { category: 100, question: 300, answer: 5000, sortOrder: 10000 };
const NEW_CATEGORY = '__new__';
const TIPS = [
  'Phrase the question the way a user would ask it.',
  'Lead with the answer, then give the steps.',
  'Put each step on its own numbered line.',
  'Reuse an existing category where one fits.',
  'Use display order to control the sequence.',
];

const NUMBERED = /^\s*\d+[.)]\s+/;
const BULLETED = /^\s*[•\-*]\s+/;

/** Toggle a list prefix on every line the selection touches. Plain text in, plain text out. */
function toggleList(text, start, end, kind) {
  const from = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', end > start && text[end - 1] === '\n' ? end - 1 : end);
  const to = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(from, to).split('\n');
  const pattern = kind === 'numbered' ? NUMBERED : BULLETED;
  const filled = lines.filter(line => line.trim());
  const removing = filled.length > 0 && filled.every(line => pattern.test(line));
  let n = 0;
  const next = lines.map(line => {
    const bare = line.replace(NUMBERED, '').replace(BULLETED, '');
    if (removing || !line.trim()) return removing ? bare : line;
    n += 1;
    return (kind === 'numbered' ? `${n}. ` : '• ') + bare;
  }).join('\n');
  return { value: text.slice(0, from) + next + text.slice(to), selection: [from, from + next.length] };
}

function Counter({ value, max }) {
  const near = value > max * 0.9;
  return <span className="faq-counter" data-near={near || undefined}>{value.toLocaleString()} / {max.toLocaleString()}</span>;
}

function FieldLabel({ htmlFor, children, required, optional }) {
  return <label className="faq-label" htmlFor={htmlFor}>{children}{required && <em> *</em>}{optional && <span className="faq-optional">Optional</span>}</label>;
}

export function FaqCreate() {
  const navigate = useNavigate();
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const owner = useSelector(state => state.auth.admin?.id);
  const { data: existing } = useGetAdminFaqCategoriesQuery({ owner }, { skip: !authenticated || !owner, refetchOnMountOrArgChange: true });
  const [createFaq, { isLoading }] = useCreateAdminFaqMutation();
  const [form, setForm] = useState({ category: '', question: '', answer: '', sortOrder: '' });
  const [categoryChoice, setCategoryChoice] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const locked = useRef(false);
  const answerRef = useRef(null);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const busy = isLoading || uncertain;

  const categoryOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const name of [...FAQ_CATEGORIES.slice(1), ...(existing || [])]) {
      const key = name.trim().toLowerCase();
      if (!seen.has(key)) { seen.add(key); list.push(name.trim()); }
    }
    return [...list.map(name => ({ value: name, label: name })), { value: NEW_CATEGORY, label: '+ New category…' }];
  }, [existing]);

  function chooseCategory(value) {
    setCategoryChoice(value);
    set('category', value === NEW_CATEGORY ? '' : value);
  }

  function applyList(kind) {
    const el = answerRef.current;
    if (!el || busy) return;
    const { value, selection } = toggleList(form.answer, el.selectionStart, el.selectionEnd, kind);
    if (value.length > LIMITS.answer) return;
    set('answer', value);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(...selection); });
  }

  function step(delta) {
    const current = form.sortOrder === '' ? (delta > 0 ? -1 : 1) : Number(form.sortOrder);
    if (!Number.isFinite(current)) return;
    set('sortOrder', String(Math.min(LIMITS.sortOrder, Math.max(0, Math.trunc(current) + delta))));
  }

  const missing = {
    question: !form.question.trim(),
    answer: !form.answer.trim(),
    category: !form.category.trim(),
  };
  const sortInvalid = form.sortOrder !== '' && (!/^\d+$/.test(form.sortOrder) || Number(form.sortOrder) > LIMITS.sortOrder);

  async function submit(event) {
    event.preventDefault();
    if (locked.current || uncertain) return;
    setTouched(true);
    if (missing.category || missing.question || missing.answer) { setError('Add a question, an answer and a category before saving.'); return; }
    if (sortInvalid) { setError('Display order must be a whole number from 0 to 10,000.'); return; }
    locked.current = true;
    setError('');
    try {
      await createFaq(form).unwrap();
      navigate('/faq');
    } catch (err) {
      if (err?.status === 'CUSTOM_ERROR' || err?.status === 'FETCH_ERROR' || err?.status === 'TIMEOUT_ERROR' || err?.status === 'PARSING_ERROR' || (typeof err?.status === 'number' && err.status >= 500)) {
        setUncertain(true);
        setError('The result could not be confirmed. Check the FAQ list before trying again.');
      } else setError(getApiErrorMessage(err, 'Unable to create FAQ.'));
    } finally { locked.current = false; }
  }

  const showError = key => touched && missing[key];
  const previewCategory = form.category.trim();
  const previewIcon = CATEGORY_ICONS[previewCategory] || 'folder';

  return <div className="support-page">
    <PageHeader crumbs={['Support System', 'FAQ', 'Add FAQ']} title="Add FAQ" description="Create a new frequently asked question to help users get quick answers." />

    <div className="faq-create-layout">
      <Card pad="none" className="faq-create-card">
        <form onSubmit={submit} noValidate>
          <div className="faq-create-head">
            <IconButton icon="arrow-left" tone="outline" size={36} label="Back to FAQ" onClick={() => navigate('/faq')} />
            <div>
              <h2 className="tk-section">Question details</h2>
              <p className="tk-meta">Fields marked <em className="faq-req">*</em> are required.</p>
            </div>
          </div>

          <div className="faq-create-body">
            {error && <Banner tone="danger">{error}</Banner>}

            <div className="faq-field">
              <FieldLabel htmlFor="faq-question" required>Question</FieldLabel>
              <input id="faq-question" className="faq-input" data-invalid={showError('question') || undefined} maxLength={LIMITS.question} placeholder="e.g. How do I create a transportation request?" value={form.question} disabled={busy} onChange={e => set('question', e.target.value)} />
              <div className="faq-field-foot">
                <span className="faq-hint" data-error={showError('question') || undefined}>{showError('question') ? 'Enter the question.' : 'Write it the way a user would ask it.'}</span>
                <Counter value={form.question.length} max={LIMITS.question} />
              </div>
            </div>

            <div className="faq-field">
              <FieldLabel htmlFor="faq-answer" required>Answer</FieldLabel>
              <div className="faq-editor" data-invalid={showError('answer') || undefined} data-expanded={expanded || undefined}>
                <div className="faq-editor-tools" role="toolbar" aria-label="Answer formatting">
                  <button type="button" title="Numbered list" aria-label="Numbered list" disabled={busy} onClick={() => applyList('numbered')}><Icon name="list-ordered" size={17} /></button>
                  <button type="button" title="Bulleted list" aria-label="Bulleted list" disabled={busy} onClick={() => applyList('bulleted')}><Icon name="list" size={17} /></button>
                  <span className="faq-editor-note">Plain text — line breaks are kept.</span>
                  <button type="button" className="faq-editor-expand" title={expanded ? 'Collapse editor' : 'Expand editor'} aria-label={expanded ? 'Collapse editor' : 'Expand editor'} aria-pressed={expanded} onClick={() => setExpanded(v => !v)}><Icon name={expanded ? 'minimize-2' : 'maximize-2'} size={16} /></button>
                </div>
                <textarea id="faq-answer" ref={answerRef} maxLength={LIMITS.answer} placeholder={'Start with a one-line answer, then list the steps:\n1. …\n2. …'} value={form.answer} disabled={busy} onChange={e => set('answer', e.target.value)} />
                <div className="faq-editor-foot"><Counter value={form.answer.length} max={LIMITS.answer} /></div>
              </div>
              {showError('answer') && <span className="faq-hint" data-error>Enter the answer.</span>}
            </div>

            <div className="faq-row">
              <div className="faq-field">
                <FieldLabel htmlFor="faq-category" required>Category</FieldLabel>
                <Select id="faq-category" options={categoryOptions} value={categoryChoice} placeholder="Select a category" disabled={busy} onChange={e => chooseCategory(e.target.value)} />
                {categoryChoice === NEW_CATEGORY
                  ? <input aria-label="New category name" className="faq-input" autoFocus maxLength={LIMITS.category} placeholder="Name the new category" value={form.category} disabled={busy} onChange={e => set('category', e.target.value)} />
                  : null}
                <span className="faq-hint" data-error={showError('category') || undefined}>{showError('category') ? 'Choose or name a category.' : 'Groups this question on the FAQ page.'}</span>
              </div>

              <div className="faq-field">
                <FieldLabel htmlFor="faq-order" optional>Display order</FieldLabel>
                <div className="faq-stepper" data-invalid={sortInvalid || undefined}>
                  <input id="faq-order" inputMode="numeric" placeholder="Last" value={form.sortOrder} disabled={busy} onChange={e => /^\d{0,5}$/.test(e.target.value) && set('sortOrder', e.target.value)} />
                  <div className="faq-stepper-buttons">
                    <button type="button" aria-label="Increase display order" disabled={busy} onClick={() => step(1)}><Icon name="chevron-up" size={14} /></button>
                    <button type="button" aria-label="Decrease display order" disabled={busy} onClick={() => step(-1)}><Icon name="chevron-down" size={14} /></button>
                  </div>
                </div>
                <span className="faq-hint" data-error={sortInvalid || undefined}>{sortInvalid ? 'Use a whole number from 0 to 10,000.' : 'Lower numbers appear first. Leave blank to add it last.'}</span>
              </div>
            </div>
          </div>

          <div className="faq-create-foot">
            <Button type="button" variant="outline" size="lg" disabled={isLoading} onClick={() => navigate('/faq')}>Cancel</Button>
            <Button type="submit" size="lg" icon="check" disabled={!authenticated || busy}>{isLoading ? 'Saving…' : 'Save FAQ'}</Button>
          </div>
        </form>
      </Card>

      <aside className="faq-create-rail">
        <Card pad="none">
          <div className="faq-rail-head">
            <span className="faq-rail-tile"><Icon name="eye" size={20} color="var(--tk-blue)" /></span>
            <div>
              <h2 className="tk-section">Live preview</h2>
              <p className="tk-meta">How this FAQ will appear to users.</p>
            </div>
          </div>
          <div className="faq-preview-wrap">
            <div className="faq-preview">
              <span className="faq-preview-chip" data-empty={!previewCategory || undefined}><Icon name={previewIcon} size={13} />{previewCategory || 'No category'}</span>
              <div className="faq-preview-q">
                <strong data-empty={!form.question.trim() || undefined}>{form.question.trim() || 'Your question will appear here'}</strong>
                <Icon name="chevron-up" size={18} color="var(--tk-blue)" />
              </div>
              <p className="faq-preview-a" data-empty={!form.answer.trim() || undefined}>{form.answer.trim() || 'Start typing an answer to see it here.'}</p>
            </div>
          </div>
        </Card>

        <div className="faq-tips">
          <h2 className="tk-section"><span className="faq-tips-icon"><Icon name="lightbulb" size={16} color="#d99a00" /></span>FAQ tips</h2>
          <ul>{TIPS.map(tip => <li key={tip}><Icon name="check" size={15} color="var(--tk-blue)" />{tip}</li>)}</ul>
        </div>
      </aside>
    </div>
  </div>;
}
