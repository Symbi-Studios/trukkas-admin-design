'use client';
import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';
import { Badge } from '../core/Badge.jsx';
import { Button } from '../core/Button.jsx';
import { IconButton } from '../core/IconButton.jsx';
import { Skeleton } from '../feedback/Skeleton.jsx';
import { InlineAlerts } from '../feedback/AlertSlot.jsx';
import { NotAvailable, isMissing } from '../core/NotAvailable.jsx';

const STATUS_TONE = { Approved: 'success', Rejected: 'danger', Pending: 'warning', 'Pending Review': 'warning', 'Re-upload requested': 'danger' };
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|heic)$/i;

function fileIcon(name = '') {
  if (/\.(xlsx?|csv)$/i.test(name)) return 'file-spreadsheet';
  if (IMAGE_EXT.test(name)) return 'image';
  return 'file-text';
}
const show = (value) => (isMissing(value) ? <NotAvailable /> : value);
const extension = (name = '') => { const m = /\.([a-z0-9]{1,5})$/i.exec(name); return m ? m[1].toUpperCase() : 'DOC'; };

/** "CUSTOMS_GATE_PASS" → "Customs gate pass"; short acronyms like "TDO" stay as they are. */
export function documentTitle(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/[_\s]/.test(text) && text.length <= 4) return text;
  const words = text.replace(/[_-]+/g, ' ').toLowerCase().split(/\s+/);
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

/**
 * Apple Preview-style document review sheet. variant="drawer" slides it in from the right instead of centring it.
 *  - documents: [{ id, name, type, status, submittedBy, date, size, scope, reviewedBy, reviewedOn, reference }]
 *  - selectedId / onSelect: the document shown large; thumbnails in the left rail switch it
 *  - preview: { url, loading, error } for the selected document
 *  - onApprove(doc) / onRequestReupload(doc): footer actions; canReview(doc) enables them
 */
export function DocumentPreview({ open, onClose, title, subtitle, documents = [], selectedId, onSelect, preview = {}, onApprove, onRequestReupload, canReview = () => false, busy = false, variant = 'modal', titleActions, loading = false }) {
  const index = Math.max(0, documents.findIndex((d) => d.id === selectedId));
  const doc = documents[index] || null;
  React.useEffect(() => {
    if (!open) return undefined;
    const key = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); const next = documents[index + 1]; if (next) onSelect?.(next.id); }
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); const prev = documents[index - 1]; if (prev) onSelect?.(prev.id); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, index, documents, onSelect, onClose]);
  if (!open) return null;
  const reviewable = doc && canReview(doc);
  const isImage = doc && (IMAGE_EXT.test(doc.name || '') || /^image\//.test(doc.mimeType || ''));
  return (
    <InlineAlerts>
    <div className={'tk-preview-scrim' + (variant === 'drawer' ? ' drawer' : '')} role="presentation" onClick={onClose}>
      <div className={'tk-preview' + (variant === 'drawer' ? ' drawer' : '')} role="dialog" aria-modal="true" aria-label={title || 'Document preview'} onClick={(e) => e.stopPropagation()}>
        <header className="tk-preview-titlebar">
          <div className="tk-preview-title">
            <strong>{title}</strong>
            {subtitle && <span>{subtitle}</span>}
          </div>
          <span className="tk-preview-count">{documents.length ? `${index + 1} of ${documents.length}` : 'No documents'}</span>
          <div className="tk-preview-title-actions">
            {titleActions}
            {preview.url && <a className="tk-preview-icon-link" href={preview.url} download={doc?.name} target="_blank" rel="noopener noreferrer" aria-label="Download document" title="Download"><Icon name="download" size={17} /></a>}
            <IconButton icon="x" label="Close preview" onClick={onClose} />
          </div>
        </header>

        <div className="tk-preview-body">
          <nav className="tk-preview-rail" aria-label="Documents">
            {documents.map((item) => (
              <button key={item.id} type="button" className={'tk-preview-thumb' + (item.id === doc?.id ? ' active' : '')} onClick={() => onSelect?.(item.id)} aria-current={item.id === doc?.id ? 'true' : undefined}>
                <span className="tk-preview-page">
                  <Icon name={fileIcon(item.name)} size={26} />
                  <small>{extension(item.name)}</small>
                </span>
                <span className="tk-preview-thumb-name" title={item.name}>{documentTitle(item.type) || item.name}</span>
                <span className={'tk-preview-dot ' + (STATUS_TONE[item.status] || 'neutral')} aria-label={item.status} />
              </button>
            ))}
          </nav>

          <section className="tk-preview-main">
            {loading ? <div className="tk-preview-canvas"><Skeleton height="100%" style={{ borderRadius: 8 }} /></div> : doc ? <>
              <div className="tk-preview-details">
                <div className="tk-preview-doc-name">
                  <strong title={doc.name}>{documentTitle(doc.type) || doc.name}</strong>
                  <Badge tone={STATUS_TONE[doc.status] || 'neutral'} dot>{doc.status || 'Unknown'}</Badge>
                </div>
                <dl>
                  <div><dt>File</dt><dd title={doc.name}>{show(doc.name)}</dd></div>
                  <div><dt>Applies to</dt><dd>{show(doc.scope)}</dd></div>
                  <div><dt>Submitted by</dt><dd>{show(doc.submittedBy)}</dd></div>
                  <div><dt>Submitted</dt><dd>{show(doc.date)}</dd></div>
                  <div><dt>Reviewed</dt><dd>{isMissing(doc.reviewedBy) ? <NotAvailable label="Not reviewed" /> : `${doc.reviewedBy}${isMissing(doc.reviewedOn) ? '' : ' · ' + doc.reviewedOn}`}</dd></div>
                </dl>
              </div>
              <div className="tk-preview-canvas">
                {preview.loading ? <Skeleton height="100%" style={{ borderRadius: 8 }} />
                  : preview.url ? (isImage
                    ? <img src={preview.url} alt={doc.name} referrerPolicy="no-referrer" />
                    : <iframe src={preview.url} title={doc.name + ' preview'} referrerPolicy="no-referrer" />)
                  : <div className="tk-preview-empty">
                      <Icon name={fileIcon(doc.name)} size={44} />
                      <strong>{preview.error ? 'This document couldn’t be loaded' : 'No preview available'}</strong>
                      <span>{preview.error ? 'Try again in a moment.' : 'The file wasn’t uploaded or can’t be shown here.'}</span>
                    </div>}
              </div>
            </> : <div className="tk-preview-empty"><Icon name="files" size={44} /><strong>No documents</strong><span>Nothing has been uploaded yet.</span></div>}
          </section>
        </div>

        <footer className="tk-preview-footer">
          <span className="tk-preview-hint"><kbd>↑</kbd><kbd>↓</kbd> to switch documents</span>
          {doc && <div className="tk-preview-actions">
            <Button variant="danger" icon="rotate-ccw" disabled={busy || !reviewable || doc.status === 'Rejected'} onClick={() => onRequestReupload?.(doc)}>Request re-upload</Button>
            <Button icon="circle-check" disabled={busy || !reviewable || doc.status === 'Approved'} onClick={() => onApprove?.(doc)}>Approve</Button>
          </div>}
        </footer>
      </div>
    </div>
    </InlineAlerts>
  );
}
