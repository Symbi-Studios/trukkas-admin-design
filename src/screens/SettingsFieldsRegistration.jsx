'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  PageHeader, Button, Card, Icon, IconButton, SearchField, FilterSelect, DataTable, Pagination,
  Badge, Switch, TextField, Select, Textarea, DropdownMenu, Modal, EmptyState, Checkbox,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import {
  REGISTRATION_ENTITIES, FIELD_CATEGORIES, FIELD_TYPES, VALIDATION_RULES,
} from '../mock/fixtures/registrationFields.js';
import {
  createRegistrationField, updateRegistrationField, setRegistrationFieldEnabled, deleteRegistrationField,
  duplicateRegistrationField, reorderRegistrationFields, bulkUpdateRegistrationFields, validateRegistrationField,
} from '../mock/registrationFieldsApi.js';
import './SettingsFieldsRegistration.css';

const TYPE_LABEL = Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t.label]));
const CATEGORY_LABEL = Object.fromEntries(FIELD_CATEGORIES.map((c) => [c.value, c.label]));
const OPTION_TYPES = ['select', 'multi_select'];
const PLACEHOLDER_TYPES = ['text', 'textarea', 'number', 'email', 'phone', 'list'];
const ALL = 'all';
const EMPTY_DRAFT = {
  label: '', key: '', type: 'text', category: 'personal', placeholder: '', required: false, visible: true,
  editable: true, enabled: true, helpText: '', validation: 'none', options: [], order: '',
};
const FILTERS = [
  { section: 'Required' }, { key: 'required', value: true, label: 'Required only' }, { key: 'required', value: false, label: 'Optional only' },
  { divider: true }, { section: 'Status' }, { key: 'enabled', value: true, label: 'Enabled' }, { key: 'enabled', value: false, label: 'Disabled' },
];

const toKey = (label) => label.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'f_$1').slice(0, 64);

function typeBadge(type) {
  return <Badge tone={type === 'multi_select' ? 'neutral' : 'info'}>{TYPE_LABEL[type] || type}</Badge>;
}

function EntityTabs({ value, counts, onChange }) {
  return (
    <Card pad="none" className="fr-entity-tabs" role="tablist">
      {REGISTRATION_ENTITIES.map((e) => {
        const on = e.value === value;
        return (
          <button key={e.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(e.value)}
            className={'fr-entity-tab' + (on ? ' is-active' : '')}>
            <Icon name={e.icon} size={18} />
            {e.label} ({counts[e.value] || 0})
          </button>
        );
      })}
    </Card>
  );
}

function CategoryList({ entity, fields, value, onChange }) {
  const singular = REGISTRATION_ENTITIES.find((e) => e.value === entity)?.singular;
  // Only list categories this entity actually uses, plus any that are selected.
  const items = [
    { value: ALL, label: 'All Fields', icon: 'layout-grid', count: fields.length },
    ...FIELD_CATEGORIES
      .map((c) => ({ ...c, label: c.value === 'documents' ? `${singular} Documents` : c.label, count: fields.filter((f) => f.category === c.value).length }))
      .filter((c) => c.count > 0 || c.value === value),
  ];
  return (
    <Card className="fr-categories">
      <h3 className="tk-section" style={{ marginBottom: 12 }}>Field Categories</h3>
      <nav style={{ display: 'grid', gap: 4 }}>
        {items.map((c) => (
          <button key={c.value} type="button" onClick={() => onChange(c.value)}
            className={'fr-category' + (c.value === value ? ' is-active' : '')}>
            <Icon name={c.icon} size={18} />
            <span className="fr-category-label" style={{ flex: 1, textAlign: 'left' }}>{c.label}</span>
            <span className="fr-category-count">{c.count}</span>
          </button>
        ))}
      </nav>
    </Card>
  );
}

function RowMenu({ field, isFirst, isLast, onEdit, onDuplicate, onMove, onDelete }) {
  const [open, setOpen] = useState(false);
  const close = (fn) => () => { setOpen(false); fn(); };
  return (
    <span style={{ position: 'relative', display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
      <IconButton icon="ellipsis" tone="outline" size={28} label={`Actions for ${field.label}`} onClick={() => setOpen((o) => !o)} />
      {open && (
        <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }} onMouseLeave={() => setOpen(false)}>
          <DropdownMenu width={190} items={[
            { label: 'Edit Field', icon: 'pencil', onClick: close(onEdit) },
            { label: 'Duplicate', icon: 'copy', onClick: close(onDuplicate) },
            { label: 'Move Up', icon: 'arrow-up', disabled: isFirst, onClick: close(() => onMove(-1)) },
            { label: 'Move Down', icon: 'arrow-down', disabled: isLast, onClick: close(() => onMove(1)) },
            { divider: true },
            { label: 'Delete Field', icon: 'trash-2', tone: 'danger', onClick: close(onDelete) },
          ]} />
        </span>
      )}
    </span>
  );
}

function FieldEditor({ entity, mode, field, total, onClose, onSaved, onDelete }) {
  const [draft, setDraft] = useState(() => (field ? { ...field } : { ...EMPTY_DRAFT, order: total + 1 }));
  const [keyTouched, setKeyTouched] = useState(Boolean(field));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  async function save() {
    const payload = { ...draft, label: draft.label.trim(), order: Number(draft.order) };
    const local = validateRegistrationField(entity, payload, { ignoreId: field?.id });
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const saved = field
        ? await updateRegistrationField(entity, field.id, payload)
        : await createRegistrationField(entity, payload);
      onSaved(saved);
    } catch (err) {
      setErrors(err.errors || { form: err.message || 'Could not save this field.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="fr-editor">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="tk-section">{mode === 'add' ? 'Add Field' : 'Edit Field'}</h3>
        <IconButton icon="x" label="Close" onClick={onClose} />
      </div>

      <TextField label="Field Label" required value={draft.label} error={errors.label}
        onChange={(e) => set({ label: e.target.value, ...(keyTouched ? {} : { key: toKey(e.target.value) }) })} />
      <TextField label="Field Key" required value={draft.key} error={errors.key}
        hint="Unique identifier (use lowercase and underscores)"
        onChange={(e) => { setKeyTouched(true); set({ key: e.target.value.toLowerCase() }); }} />
      <Select label={<>Field Type <span style={{ color: 'var(--tk-danger)' }}>*</span></>} value={draft.type}
        options={FIELD_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        onChange={(e) => set({ type: e.target.value })} />
      <Select label="Category" value={draft.category}
        options={FIELD_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
        onChange={(e) => set({ category: e.target.value })} />
      {PLACEHOLDER_TYPES.includes(draft.type) && (
        <TextField label="Placeholder Text" value={draft.placeholder} onChange={(e) => set({ placeholder: e.target.value })} />
      )}
      {OPTION_TYPES.includes(draft.type) && (
        <div style={{ display: 'grid', gap: 6 }}>
          <Textarea label="Options" rows={4} value={(draft.options || []).join('\n')}
            hint="One option per line."
            onChange={(e) => set({ options: e.target.value.split('\n').map((o) => o.trimStart()).filter((o, i, a) => o || i === a.length - 1) })} />
          {errors.options && <span className="tk-meta" style={{ color: 'var(--tk-danger)' }}>{errors.options}</span>}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        <Switch checked={draft.required} onChange={(v) => set({ required: v })} label="Required" hint="Field must be filled during registration" />
        <Switch checked={draft.visible} onChange={(v) => set({ visible: v })} label="Visible" hint="Show this field on the registration form" />
        <Switch checked={draft.editable} onChange={(v) => set({ editable: v })} label="Editable" hint="Allow users to update this field after registration" />
      </div>

      <div style={{ display: 'grid', gap: 4 }}>
        <Textarea label="Help Text" rows={2} value={draft.helpText} onChange={(e) => set({ helpText: e.target.value.slice(0, 200) })} />
        <span className="tk-meta" style={{ justifySelf: 'end', color: errors.helpText ? 'var(--tk-danger)' : undefined }}>
          {(draft.helpText || '').length}/200 characters
        </span>
      </div>
      <Select label="Validation Rules" value={draft.validation}
        options={VALIDATION_RULES.map((r) => ({ value: r.value, label: r.label }))}
        onChange={(e) => set({ validation: e.target.value })} />
      <TextField label="Display Order" type="number" min={1} max={mode === 'add' ? total + 1 : total} value={draft.order} error={errors.order}
        hint="Determines the field position in the form" onChange={(e) => set({ order: e.target.value })} />

      {errors.form && <span className="tk-meta" style={{ color: 'var(--tk-danger)' }}>{errors.form}</span>}

      <div className="fr-editor-footer">
        {mode === 'edit' && (
          <Button variant="outline" icon="trash-2" className="fr-delete" onClick={() => onDelete(field)}>Delete Field</Button>
        )}
        <span style={{ flex: 1 }} />
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : mode === 'add' ? 'Add Field' : 'Save Changes'}</Button>
      </div>
    </Card>
  );
}

function PreviewInput({ field }) {
  const common = { label: field.label, placeholder: field.placeholder || undefined, hint: field.helpText || undefined };
  const label = <>{field.label}{field.required && <span style={{ color: 'var(--tk-danger)' }}> *</span>}</>;
  if (field.type === 'textarea') return <Textarea {...common} label={label} rows={3} />;
  if (field.type === 'list') return <Textarea {...common} label={label} rows={3} hint={field.helpText || 'One item per line.'} />;
  if (field.type === 'select') return <Select label={label} placeholder="Select an option" options={field.options} />;
  if (field.type === 'multi_select') {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{label}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
          {field.options.map((o) => <Checkbox key={o} label={o} />)}
        </div>
        {field.helpText && <span className="tk-meta">{field.helpText}</span>}
      </div>
    );
  }
  if (field.type === 'file') return <TextField {...common} label={label} type="file" />;
  const inputType = { number: 'number', email: 'email', phone: 'tel', date: 'date' }[field.type] || 'text';
  return <TextField {...common} label={label} required={false} type={inputType} />;
}

function PreviewModal({ open, entity, fields, onClose }) {
  const meta = REGISTRATION_ENTITIES.find((e) => e.value === entity);
  const shown = fields.filter((f) => f.enabled && f.visible);
  return (
    <Modal open={open} onClose={onClose} width={640} title={`${meta?.singular} Registration Form — Preview`}
      description={`${shown.length} of ${fields.length} fields are shown to new ${meta?.singular.toLowerCase()}s. Disabled and hidden fields are left out.`}
      footer={<Button onClick={onClose}>Close Preview</Button>}>
      <div style={{ display: 'grid', gap: 14, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
        {shown.map((f) => <PreviewInput key={f.id} field={f} />)}
        {!shown.length && <EmptyState icon="eye-off" title="No visible fields" description="Enable a field and mark it visible to show it here." />}
      </div>
    </Modal>
  );
}

export function SettingsFieldsRegistration() {
  const navigate = useNavigate();
  const all = useCollection('registrationFields') || [];
  const [entity, setEntity] = useState('driver');
  const [category, setCategory] = useState(ALL);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState([]);
  const [editor, setEditor] = useState(null); // { mode: 'add' | 'edit', id? }
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragId, setDragId] = useState(null);

  const counts = useMemo(() => Object.fromEntries(REGISTRATION_ENTITIES.map((e) => [e.value, all.filter((f) => f.entity === e.value).length])), [all]);
  const fields = useMemo(() => all.filter((f) => f.entity === entity).sort((a, b) => a.order - b.order), [all, entity]);
  const meta = REGISTRATION_ENTITIES.find((e) => e.value === entity);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return fields.filter((f) => (
      (category === ALL || f.category === category)
      && (!filter || f[filter.key] === filter.value)
      && (!needle || [f.label, f.key, TYPE_LABEL[f.type], CATEGORY_LABEL[f.category]].some((s) => s?.toLowerCase().includes(needle)))
    ));
  }, [fields, category, filter, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); setSelected([]); }, [entity, category, filter, q, pageSize]);

  const editing = editor?.mode === 'edit' ? fields.find((f) => f.id === editor.id) : null;
  useEffect(() => { if (editor?.mode === 'edit' && !editing) setEditor(null); }, [editor, editing]);

  function switchEntity(next) { setEntity(next); setCategory(ALL); setEditor(null); }

  async function handleDelete(field) {
    if (!window.confirm(`Delete "${field.label}"? Existing ${meta.singular.toLowerCase()} records keep their saved value, but the field will no longer be collected.`)) return;
    await deleteRegistrationField(entity, field.id);
    setEditor(null);
  }

  async function moveTo(field, targetOrder) {
    const ids = fields.map((f) => f.id).filter((id) => id !== field.id);
    ids.splice(Math.max(0, Math.min(ids.length, targetOrder - 1)), 0, field.id);
    await reorderRegistrationFields(entity, ids);
  }

  function handleDrop(event) {
    event.preventDefault();
    const tr = event.target.closest('tbody tr');
    const target = tr ? paged[tr.sectionRowIndex] : null;
    const moved = fields.find((f) => f.id === dragId);
    setDragId(null);
    if (moved && target && target.id !== moved.id) moveTo(moved, target.order);
  }

  async function bulk(changes) {
    await bulkUpdateRegistrationFields(entity, selected, changes);
    setSelected([]);
  }

  const columns = [
    {
      key: 'label', header: 'Field Name', render: (f) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="fr-drag" draggable title="Drag to reorder" aria-label={`Reorder ${f.label}`}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => { setDragId(f.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', f.id); }}
            onDragEnd={() => setDragId(null)}>
            <Icon name="grip-vertical" size={16} />
          </span>
          <span style={{ color: 'var(--tk-ink-900)', fontWeight: 500 }}>{f.label}</span>
        </span>
      ),
    },
    { key: 'key', header: 'Field Key', render: (f) => <span className="fr-key">{f.key}</span> },
    { key: 'type', header: 'Type', render: (f) => typeBadge(f.type) },
    { key: 'required', header: 'Required', render: (f) => (f.required ? <Badge tone="danger">Yes</Badge> : <Badge tone="neutral">No</Badge>) },
    {
      key: 'enabled', header: 'Status', render: (f) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Switch checked={f.enabled} onChange={(v) => setRegistrationFieldEnabled(entity, f.id, v)} />
        </span>
      ),
    },
    { key: 'order', header: 'Order', align: 'center' },
    {
      key: 'actions', header: 'Actions', align: 'center', render: (f) => (
        <RowMenu field={f} isFirst={f.order === 1} isLast={f.order === fields.length}
          onEdit={() => setEditor({ mode: 'edit', id: f.id })}
          onDuplicate={() => duplicateRegistrationField(entity, f.id)}
          onMove={(dir) => moveTo(f, f.order + dir)}
          onDelete={() => handleDelete(f)} />
      ),
    },
  ];

  return (
    <div className="fr-page">
      <PageHeader
        crumbs={[
          { label: 'Dashboard', onClick: () => navigate('/dashboard') },
          { label: 'Settings', onClick: () => navigate('/settings') },
          'Fields Registration',
        ]}
        title="Fields Registration"
        description="Manage all data fields for Forwarders, Drivers and Companies. Add new fields, edit existing ones, set requirements and control visibility during registration and profile updates."
        actions={(
          <>
            <SearchField variant="panel" placeholder="Search fields..." value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
            <Button variant="outline" icon="eye" onClick={() => setPreviewOpen(true)}>Preview Form</Button>
            <Button icon="plus" onClick={() => setEditor({ mode: 'add' })}>Add Field</Button>
          </>
        )}
      />

      <div className={'fr-layout' + (editor ? ' has-editor' : '')}>
        <div className="fr-main">
          <EntityTabs value={entity} counts={counts} onChange={switchEntity} />

          <div className="fr-body">
            <CategoryList entity={entity} fields={fields} value={category} onChange={setCategory} />

            <Card pad="none" className="fr-table-card">
              <div className="fr-table-head">
                <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <h3 className="tk-section">{meta.singular} Fields</h3>
                  <span className="tk-meta">Manage the fields collected during {meta.singular.toLowerCase()} registration and profile updates.</span>
                </div>
                <div className="fr-table-tools">
                  <SearchField variant="panel" placeholder="Search fields..." value={q} onChange={(e) => setQ(e.target.value)} />
                  <span style={{ position: 'relative' }}>
                    <FilterSelect icon="filter" label={filter ? filter.label : 'Filter'} active={Boolean(filter)} onClick={() => setFilterOpen((o) => !o)} />
                    {filterOpen && (
                      <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setFilterOpen(false)}>
                        <DropdownMenu width={200} items={[
                          ...FILTERS.map((f) => (f.key ? {
                            label: f.label, icon: filter?.label === f.label ? 'check' : undefined,
                            onClick: () => { setFilter(f); setFilterOpen(false); },
                          } : f)),
                          { divider: true },
                          { label: 'Clear filter', icon: 'x', disabled: !filter, onClick: () => { setFilter(null); setFilterOpen(false); } },
                        ]} />
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {selected.length > 0 && (
                <div className="fr-bulk">
                  <span className="tk-meta" style={{ fontWeight: 600, color: 'var(--tk-ink-700)' }}>{selected.length} selected</span>
                  <Button size="sm" variant="outline" onClick={() => bulk({ required: true })}>Mark Required</Button>
                  <Button size="sm" variant="outline" onClick={() => bulk({ required: false })}>Mark Optional</Button>
                  <Button size="sm" variant="outline" onClick={() => bulk({ enabled: true })}>Enable</Button>
                  <Button size="sm" variant="outline" onClick={() => bulk({ enabled: false })}>Disable</Button>
                </div>
              )}

              {filtered.length ? (
                <div onDragOver={(e) => { if (dragId) e.preventDefault(); }} onDrop={handleDrop}>
                  <DataTable coloredHeader selectable columns={columns} rows={paged}
                    selected={selected} onSelect={setSelected}
                    onRowClick={(f) => setEditor({ mode: 'edit', id: f.id })} />
                </div>
              ) : (
                <EmptyState icon="list-x" title={`No ${meta.singular.toLowerCase()} fields match`}
                  description="Each field collected on the registration form appears here with its key, type and requirement."
                  action={<Button variant="outline" onClick={() => { setQ(''); setFilter(null); setCategory(ALL); }}>Clear search & filters</Button>} />
              )}

              <Pagination page={page} pageCount={pageCount} pageSize={pageSize} total={filtered.length}
                onPage={(p) => setPage(Math.max(1, Math.min(pageCount, p)))} onPageSize={setPageSize} />
            </Card>
          </div>
        </div>

        {editor && (
          <FieldEditor key={`${entity}-${editor.mode}-${editor.id || 'new'}`} entity={entity} mode={editor.mode}
            field={editing} total={fields.length}
            onClose={() => setEditor(null)}
            onSaved={(saved) => setEditor({ mode: 'edit', id: saved.id })}
            onDelete={handleDelete} />
        )}
      </div>

      <PreviewModal open={previewOpen} entity={entity} fields={fields} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}
