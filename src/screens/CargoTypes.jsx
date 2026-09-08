import { useMemo, useState } from 'react';
import {
  PageHeader, Button, StatCard, SectionCard, TableToolbar, SearchField, DataTable,
  Pagination, Badge, Tag, ListRow, QuickActionsCard, Card, Modal, TextField, Select, Switch,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { addCargoType } from '../mock/api.js';

const CATEGORIES = ['General', 'Temp. Sensitive', 'Hazardous', 'Bulk'];
const EMPTY_FORM = { name: '', category: CATEGORIES[0], handling: '', trucks: '', restricted: false };

export function CargoTypes() {
  const rows = useCollection('cargoTypes') || [];
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => !q ? rows : rows.filter(
    (r) => r.name.toLowerCase().includes(q.toLowerCase()),
  ), [rows, q]);

  const counts = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.status === 'Active').length,
    restricted: rows.filter((r) => r.status === 'Restricted').length,
  }), [rows]);

  function resetForm() { setAddOpen(false); setForm(EMPTY_FORM); }

  async function handleSave() {
    setSaving(true);
    await addCargoType({
      name: form.name, category: form.category, handling: form.handling || 'Standard',
      trucks: form.trucks || 'All truck types', status: form.restricted ? 'Restricted' : 'Active',
    });
    setSaving(false);
    resetForm();
  }

  return (
    <>
      <PageHeader crumbs={['Cargo', 'Cargo Types']} title="Cargo Types"
        description="Manage all cargo types used across jobs and shipments."
        actions={<Button icon="plus" onClick={() => setAddOpen(true)}>Add Cargo Type</Button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="container" label="Total Cargo Types" value={counts.total} caption="defined" />
        <StatCard icon="circle-check" tint="green" label="Active" value={counts.active}
          caption={`${((counts.active / counts.total) * 100).toFixed(1)}% of total`} />
        <StatCard icon="shield-alert" tint="amber" label="Restricted" value={counts.restricted} caption="requires approval" />
      </div>

      <Card pad="none">
        <TableToolbar search={<SearchField placeholder="Search cargo types by name..."
          value={q} onChange={(e) => setQ(e.target.value)} />} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Cargo Types" count={filtered.length} pad="none">
          <DataTable rows={filtered} rowKey={(r) => r.name}
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'category', header: 'Category', render: (r) => <Tag tone="orange">{r.category}</Tag> },
              { key: 'handling', header: 'Handling Requirements' },
              { key: 'trucks', header: 'Compatible Trucks' },
              { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]} />
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(filtered.length / 10))}
            total={filtered.length} onPage={setPage} onPageSize={() => {}} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Recently Added">
            {rows.slice(0, 2).map((r) => (
              <ListRow key={r.name} icon="container" title={r.name} subtitle={r.category} />
            ))}
          </SectionCard>
          <QuickActionsCard items={[{ icon: 'plus', label: 'Add Cargo Type', onClick: () => setAddOpen(true) }]} />
        </div>
      </div>

      <Modal open={addOpen} onClose={resetForm} title="Add Cargo Type"
        description="Define a new cargo type available when publishing jobs."
        footer={<>
          <Button variant="outline" onClick={resetForm}>Cancel</Button>
          <Button disabled={saving || !form.name} onClick={handleSave}>Save Cargo Type</Button>
        </>}>
        <div style={{ display: 'grid', gap: 14 }}>
          <TextField label="Name" required placeholder="e.g. Perishable Produce"
            value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Select label="Category" value={form.category} options={CATEGORIES}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          <TextField label="Handling Requirements" placeholder="e.g. Ventilated enclosure"
            value={form.handling} onChange={(e) => setForm((f) => ({ ...f, handling: e.target.value }))} />
          <TextField label="Compatible Trucks" placeholder="e.g. Flatbed, 40FT Trailer"
            value={form.trucks} onChange={(e) => setForm((f) => ({ ...f, trucks: e.target.value }))} />
          <Switch checked={form.restricted} onChange={(v) => setForm((f) => ({ ...f, restricted: v }))}
            label="Restricted" hint="Requires admin approval before use on a job." />
        </div>
      </Modal>
    </>
  );
}
