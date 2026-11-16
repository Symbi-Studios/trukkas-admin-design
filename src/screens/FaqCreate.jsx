'use client';

import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import { PageHeader, Card, Button, TextField, Banner } from '../ds.js';
import { useCreateAdminFaqMutation, useGetAdminFaqCategoriesQuery } from '../store/features/faq/faqApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import './Support.css';

export function FaqCreate() {
  const navigate = useNavigate();
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const owner = useSelector(state => state.auth.admin?.id);
  const { data: categories } = useGetAdminFaqCategoriesQuery({ owner }, { skip: !authenticated || !owner, refetchOnMountOrArgChange: true });
  const [createFaq, { isLoading }] = useCreateAdminFaqMutation();
  const [form, setForm] = useState({ category: '', question: '', answer: '', sortOrder: '' });
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    if (locked.current || uncertain) return;
    if (!form.category.trim() || !form.question.trim() || !form.answer.trim()) { setError('Category, question and answer are required.'); return; }
    if (form.sortOrder !== '' && (!/^\d+$/.test(form.sortOrder) || Number(form.sortOrder) > 10000)) { setError('Sort order must be a whole number from 0 to 10000.'); return; }
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

  return <div className="support-page">
    <PageHeader crumbs={['Support System', 'FAQ', 'Add FAQ']} title="Add FAQ" description="Create a frequently asked question." />
    <Card style={{ maxWidth: 800 }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
        {error && <Banner tone="danger">{error}</Banner>}
        <TextField label="Category" required maxLength={100} list="faq-categories" value={form.category} disabled={isLoading || uncertain} onChange={e => set('category', e.target.value)} />
        <datalist id="faq-categories">{(categories || []).map(category => <option key={category} value={category} />)}</datalist>
        <TextField label="Question" required maxLength={300} value={form.question} disabled={isLoading || uncertain} onChange={e => set('question', e.target.value)} />
        <label><span className="field-label">Answer <em>*</em></span><textarea className="plain-input summary-input" style={{ minHeight: 150 }} maxLength={5000} required value={form.answer} disabled={isLoading || uncertain} onChange={e => set('answer', e.target.value)} /></label>
        <TextField label="Sort Order (Optional)" type="number" min="0" max="10000" step="1" hint="Leave blank to place this FAQ last in its category." value={form.sortOrder} disabled={isLoading || uncertain} onChange={e => set('sortOrder', e.target.value)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}><Button type="submit" disabled={!authenticated || isLoading || uncertain}>{isLoading ? 'Saving…' : 'Add FAQ'}</Button><Button type="button" variant="outline" disabled={isLoading} onClick={() => navigate('/faq')}>Cancel</Button></div>
      </form>
    </Card>
  </div>;
}