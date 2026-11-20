'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Badge, Banner, Button, DataTable, DrawerFacts, DrawerSection, EmptyState, Icon, IconButton,
  Modal, SearchField, Select, SideDrawer, Skeleton, Switch, TextField,
} from '../ds.js';
import { SettingsSectionHeader, SettingsPanelLoading, SettingsCard } from './settingsShared.jsx';
import { SettingsReadNotice } from './settingsValues.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import {
  useGetAdminPortsQuery, useGetAdminPortTerminalsQuery, useGetAdminPortStatesQuery,
  useCreateAdminPortMutation, useUpdateAdminPortMutation, useDeleteAdminPortMutation,
  useCreateAdminTerminalMutation, useUpdateAdminTerminalMutation,
} from '../store/features/ports/portsApi.js';
import styles from './SettingsPorts.module.css';

const show = (value) => value == null ? '—' : value.toLocaleString('en-NG');
const statusLabel = (isActive) => isActive === true ? 'Active' : isActive === false ? 'Paused' : '—';
const statusTone = (isActive) => isActive === true ? 'success' : isActive === false ? 'warning' : 'neutral';
const coords = (t) => t.latitude != null && t.longitude != null ? `${t.latitude.toFixed(4)}, ${t.longitude.toFixed(4)}` : null;
const mapLink = (t) => `https://www.google.com/maps/search/?api=1&query=${t.latitude},${t.longitude}`;
const PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
const blankTerminal = () => ({ key: Math.random().toString(36).slice(2), name: '', latitude: '', longitude: '' });

/** Settings › Ports & Terminals: where jobs are picked up from. Prices live in Finance › Pricing. */
export function SettingsPorts() {
  const ports = useGetAdminPortsQuery();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [dialog, setDialog] = useState(null);

  const rows = ports.currentData || [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((p) => p.name.toLowerCase().includes(q) || (p.state || '').toLowerCase().includes(q)) : rows;
  }, [rows, search]);
  const open = rows.find((p) => p.id === openId) || null;

  const active = rows.filter((p) => p.isActive === true).length;
  const paused = rows.filter((p) => p.isActive === false).length;
  const terminals = rows.length && rows.every((p) => p.terminalCount != null) ? rows.reduce((sum, p) => sum + p.terminalCount, 0) : null;

  const header = (
    <SettingsSectionHeader title="Ports & Terminals"
      description="The ports and terminals that jobs are picked up from. Prices for each port are set in Finance › Pricing."
      actions={<Button icon="plus" onClick={() => setDialog({ type: 'port' })}>Add Port</Button>} />
  );

  if (ports.isLoading) return <>{header}<SettingsPanelLoading /></>;

  return (
    <>
      {header}
      <SettingsReadNotice error={ports.error} />
      {ports.error && <div><Button variant="outline" icon="rotate-cw" disabled={ports.isFetching} onClick={() => ports.refetch()}>Retry</Button></div>}

      {!ports.error && (
        <div className={styles.stats}>
          <Stat icon="anchor" label="Ports" value={show(rows.length)} />
          <Stat icon="circle-check" tone="success" label="Active · Paused" value={`${show(active)} · ${show(paused)}`} />
          <Stat icon="warehouse" label="Terminals" value={show(terminals)} />
        </div>
      )}

      {!ports.error && (
        <SettingsCard title="Ports" count={rows.length || null} pad="none"
          description="Select a port to see its terminals, edit it, pause it or remove it.">
          {rows.length === 0 ? (
            <EmptyState icon="anchor" title="No ports yet"
              description="Ports you add appear here with their terminals. Every port needs at least one terminal."
              action={<Button icon="plus" onClick={() => setDialog({ type: 'port' })}>Add Port</Button>} />
          ) : (
            <>
              {rows.length > 5 && (
                <div className={styles.toolbar}>
                  <SearchField placeholder="Search ports or states" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search ports" />
                </div>
              )}
              <DataTable rows={visible} rowKey={(p) => p.id} onRowClick={(p) => setOpenId(p.id)} columns={[
                { key: 'name', header: 'Port', render: (p) => (
                  <div className={styles.portCell}>
                    <span className={styles.portIcon} data-paused={p.isActive === false}><Icon name="anchor" size={17} /></span>
                    <span className={styles.portName}><strong>{p.name}</strong><span>{p.state || '—'}</span></span>
                  </div>
                ) },
                { key: 'status', header: 'Status', render: (p) => <Badge tone={statusTone(p.isActive)} dot>{statusLabel(p.isActive)}</Badge> },
                { key: 'terminals', header: 'Terminals', align: 'right', render: (p) => <span className={styles.num}>{show(p.terminalCount)}</span> },
                { key: 'jobs', header: 'Jobs', align: 'right', render: (p) => <span className={styles.num}>{show(p.jobCount)}</span> },
                { key: 'open', header: '', width: 40, align: 'right', render: () => <span className={styles.chevron}><Icon name="chevron-right" size={16} /></span> },
              ]} />
              {visible.length === 0 && <EmptyState icon="search" title="No matching ports" description={`No port or state matches “${search.trim()}”.`} />}
            </>
          )}
        </SettingsCard>
      )}

      {open && <PortDrawer port={open} onClose={() => setOpenId(null)} onDialog={setDialog} />}

      {dialog?.type === 'port' && <PortDialog port={dialog.port} onClose={() => setDialog(null)} onCreated={(id) => id && setOpenId(id)} />}
      {dialog?.type === 'terminal' && <TerminalDialog port={dialog.port} terminal={dialog.terminal} lastActive={dialog.lastActive} onClose={() => setDialog(null)} />}
      {dialog?.type === 'status' && <PortStatusDialog port={dialog.port} onClose={() => setDialog(null)} />}
      {dialog?.type === 'delete' && <DeletePortDialog port={dialog.port} onClose={() => setDialog(null)} onDeleted={() => { setDialog(null); setOpenId(null); }} />}
    </>
  );
}

function Stat({ icon, tone, label, value }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statIcon} data-tone={tone}><Icon name={icon} size={18} /></span>
      <span className={styles.statBody}><span className={styles.statValue}>{value}</span><span className={styles.statLabel}>{label}</span></span>
    </div>
  );
}

function PortDrawer({ port, onClose, onDialog }) {
  const terminals = useGetAdminPortTerminalsQuery(port.id);
  const list = terminals.currentData || [];
  const activeCount = list.filter((t) => t.isActive === true).length;
  const paused = port.isActive === false;

  return (
    <SideDrawer label="Port details" eyebrow="Port" title={port.name} onClose={onClose}
      meta={<><Badge tone={statusTone(port.isActive)} dot>{statusLabel(port.isActive)}</Badge><span className="tk-meta">{port.state || '—'}</span></>}
      footer={(
        <div className="tk-drawer-footer-row">
          <Button variant="outline" icon="pencil" onClick={() => onDialog({ type: 'port', port })}>Edit Port</Button>
          <Button variant="outline" icon={paused ? 'play' : 'pause'} disabled={port.isActive == null} onClick={() => onDialog({ type: 'status', port })}>{paused ? 'Resume Port' : 'Pause Port'}</Button>
          <Button variant="danger" icon="trash-2" onClick={() => onDialog({ type: 'delete', port })}>Delete</Button>
        </div>
      )}>
      {paused && <div className="tk-drawer-note"><Icon name="pause" size={16} /> This port is paused. Forwarders can't pick it for new jobs until you resume it.</div>}

      <DrawerSection title="Overview">
        <DrawerFacts items={[
          { label: 'State', value: port.state || '—' },
          { label: 'Status', value: statusLabel(port.isActive) },
          { label: 'Terminals', value: show(port.terminalCount) },
          { label: 'Jobs', value: show(port.jobCount) },
          { label: 'Added', value: port.created },
          { label: 'Last updated', value: port.updated },
        ]} />
      </DrawerSection>

      <DrawerSection>
        <div className={styles.sectionHead}>
          <h3>Terminals</h3>
          <Button size="sm" variant="outline" icon="plus" onClick={() => onDialog({ type: 'terminal', port })}>Add Terminal</Button>
        </div>
        {terminals.error ? (
          <Banner tone="danger" action={<Button size="sm" variant="outline" disabled={terminals.isFetching} onClick={() => terminals.refetch()}>Retry</Button>}>{getApiErrorMessage(terminals.error)}</Banner>
        ) : terminals.isLoading ? (
          <div className={styles.terminalList}><Skeleton height={62} /><Skeleton height={62} /></div>
        ) : list.length === 0 ? (
          <Banner tone="warning" title="No terminals">Every port needs at least one terminal before jobs can use it. Add one now.</Banner>
        ) : (
          <div className={styles.terminalList}>
            {list.map((t) => {
              const where = coords(t);
              return (
                <div key={t.id} className={styles.terminal} data-inactive={t.isActive === false}>
                  <span className={styles.portIcon}><Icon name="warehouse" size={16} /></span>
                  <div className={styles.terminalBody}>
                    <span className={styles.terminalName}>{t.name}{t.isActive === false && <Badge tone="neutral">Inactive</Badge>}</span>
                    <span className={styles.terminalMeta}>
                      <Icon name="map-pin" size={13} />
                      {where ? <><span className={styles.mono}>{where}</span><a href={mapLink(t)} target="_blank" rel="noreferrer">View on map</a></> : <span>No location set</span>}
                    </span>
                  </div>
                  <IconButton icon="pencil" label={`Edit ${t.name}`}
                    onClick={() => onDialog({ type: 'terminal', port, terminal: t, lastActive: t.isActive === true && activeCount === 1 })} />
                </div>
              );
            })}
          </div>
        )}
        <span className="tk-meta">Terminal locations are used to work out road distances for quotes. Handling fees are set in Finance › Pricing.</span>
      </DrawerSection>
    </SideDrawer>
  );
}

/** Splits "6.45, 3.38" pasted into either field across latitude and longitude. */
function locationChange(field, value, current) {
  const pair = value.match(PAIR);
  return pair ? { ...current, latitude: pair[1], longitude: pair[2] } : { ...current, [field]: value };
}

function PortDialog({ port, onClose, onCreated }) {
  const editing = Boolean(port);
  const states = useGetAdminPortStatesQuery();
  const [name, setName] = useState(port?.name === '—' ? '' : port?.name || '');
  const [state, setState] = useState(port?.state || '');
  const [rows, setRows] = useState(() => [blankTerminal()]);
  const [error, setError] = useState(null);
  const [create, creating] = useCreateAdminPortMutation();
  const [update, updating] = useUpdateAdminPortMutation();
  const busy = creating.isLoading || updating.isLoading, pending = useRef(false);

  const rowsReady = rows.every((r) => r.name.trim() && r.latitude !== '' && r.longitude !== '');
  const ready = name.trim() && (editing || (rows.length > 0 && rowsReady));

  async function save() {
    if (pending.current || !ready) return;
    pending.current = true; setError(null);
    try {
      if (editing) await update({ id: port.id, name, state }).unwrap();
      else {
        const result = await create({ name, state, terminals: rows }).unwrap();
        onCreated(result?.port?.id || result?.id);
      }
      onClose();
    } catch (failure) { setError(failure?.status === 'CUSTOM_ERROR' ? failure.error : getApiErrorMessage(failure)); }
    finally { pending.current = false; }
  }

  const setRow = (key, next) => setRows((all) => all.map((r) => r.key === key ? next(r) : r));

  return (
    <Modal open width={editing ? 520 : 720} title={editing ? 'Edit Port' : 'Add Port'}
      description={editing ? 'Change the port name or state. Terminals are managed from the port panel.' : 'Add a port and at least one terminal. Prices are set later in Finance › Pricing.'}
      onClose={() => { if (!busy) onClose(); }}
      footer={<>
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={!ready || busy} onClick={save}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Port'}</Button>
      </>}>
      <div className={styles.form}>
        {error && <Banner tone="danger">{error}</Banner>}
        <div className={styles.formGrid}>
          <TextField label="Port Name" required placeholder="e.g. Apapa Port" value={name} onChange={(e) => setName(e.target.value)} />
          {states.currentData
            ? <Select label="State" placeholder="Select a state" options={states.currentData} value={state} onChange={(e) => setState(e.target.value)} />
            : <TextField label="State" placeholder="e.g. Lagos" value={state} onChange={(e) => setState(e.target.value)}
                hint={states.error ? 'The list of states could not be loaded; type the state instead.' : undefined} />}
        </div>

        {!editing && (
          <>
            <div className={styles.subhead}>
              <div>
                <h4>Terminals</h4>
                <p>A port needs at least one terminal. Tip: paste “6.4500, 3.3800” from Google Maps into either location field.</p>
              </div>
              <Button size="sm" variant="outline" icon="plus" onClick={() => setRows((all) => [...all, blankTerminal()])}>Add Another</Button>
            </div>
            {rows.map((r, index) => (
              <div key={r.key} className={styles.terminalRow}>
                <TextField label={`Terminal ${index + 1}`} required placeholder="e.g. Terminal B" value={r.name}
                  onChange={(e) => setRow(r.key, (row) => ({ ...row, name: e.target.value }))} />
                <TextField label="Latitude" required inputMode="decimal" placeholder="6.4500" value={r.latitude}
                  onChange={(e) => setRow(r.key, (row) => locationChange('latitude', e.target.value, row))} />
                <TextField label="Longitude" required inputMode="decimal" placeholder="3.3800" value={r.longitude}
                  onChange={(e) => setRow(r.key, (row) => locationChange('longitude', e.target.value, row))} />
                <div className={styles.rowRemove}>
                  <IconButton icon="x" label={`Remove terminal ${index + 1}`} disabled={rows.length === 1}
                    onClick={() => setRows((all) => all.filter((row) => row.key !== r.key))} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}

function TerminalDialog({ port, terminal, lastActive, onClose }) {
  const editing = Boolean(terminal);
  const [form, setForm] = useState(() => ({
    name: terminal?.name === '—' ? '' : terminal?.name || '',
    latitude: terminal?.latitude != null ? String(terminal.latitude) : '',
    longitude: terminal?.longitude != null ? String(terminal.longitude) : '',
    isActive: terminal ? terminal.isActive !== false : true,
  }));
  const [error, setError] = useState(null);
  const [create, creating] = useCreateAdminTerminalMutation();
  const [update, updating] = useUpdateAdminTerminalMutation();
  const busy = creating.isLoading || updating.isLoading, pending = useRef(false);
  const ready = form.name.trim() && form.latitude !== '' && form.longitude !== '';

  async function save() {
    if (pending.current || !ready) return;
    pending.current = true; setError(null);
    try {
      if (editing) await update({ id: terminal.id, ...form }).unwrap();
      else await create({ portId: port.id, ...form }).unwrap();
      onClose();
    } catch (failure) { setError(failure?.status === 'CUSTOM_ERROR' ? failure.error : getApiErrorMessage(failure)); }
    finally { pending.current = false; }
  }

  return (
    <Modal open width={520} title={editing ? 'Edit Terminal' : 'Add Terminal'} description={`${port.name}${port.state ? ' · ' + port.state : ''}`}
      onClose={() => { if (!busy) onClose(); }}
      footer={<>
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={!ready || busy} onClick={save}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Terminal'}</Button>
      </>}>
      <div className={styles.form}>
        {error && <Banner tone="danger">{error}</Banner>}
        <TextField label="Terminal Name" required placeholder="e.g. Terminal B" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className={styles.formGrid}>
          <TextField label="Latitude" required inputMode="decimal" placeholder="6.4500" value={form.latitude}
            onChange={(e) => setForm(locationChange('latitude', e.target.value, form))} />
          <TextField label="Longitude" required inputMode="decimal" placeholder="3.3800" value={form.longitude}
            onChange={(e) => setForm(locationChange('longitude', e.target.value, form))} />
        </div>
        <span className="tk-meta">Used to work out road distances for quotes. Tip: paste “6.4500, 3.3800” from Google Maps into either field.</span>
        {editing && (
          <Switch checked={form.isActive} disabled={lastActive && form.isActive} label="Active"
            hint={lastActive && form.isActive ? 'This is the port’s only active terminal. Add or activate another terminal before deactivating this one.' : 'Inactive terminals can’t be picked for new jobs.'}
            onChange={(next) => setForm({ ...form, isActive: next })} />
        )}
      </div>
    </Modal>
  );
}

function PortStatusDialog({ port, onClose }) {
  const pausing = port.isActive === true;
  const [update, state] = useUpdateAdminPortMutation();
  const [error, setError] = useState(null);
  async function confirm() {
    setError(null);
    try { await update({ id: port.id, isActive: !pausing }).unwrap(); onClose(); }
    catch (failure) { setError(getApiErrorMessage(failure)); }
  }
  return (
    <Modal open width={460} title={pausing ? `Pause ${port.name}?` : `Resume ${port.name}?`}
      onClose={() => { if (!state.isLoading) onClose(); }}
      footer={<>
        <Button variant="outline" disabled={state.isLoading} onClick={onClose}>Cancel</Button>
        <Button variant={pausing ? 'danger' : 'primary'} disabled={state.isLoading} onClick={confirm}>{state.isLoading ? 'Saving…' : pausing ? 'Pause Port' : 'Resume Port'}</Button>
      </>}>
      <div className={styles.form}>
        {error && <Banner tone="danger">{error}</Banner>}
        <p className="tk-meta" style={{ margin: 0 }}>{pausing
          ? 'Forwarders won’t be able to pick this port for new jobs while it’s paused. You can resume it at any time.'
          : 'Forwarders will be able to pick this port for new jobs again.'}</p>
      </div>
    </Modal>
  );
}

function DeletePortDialog({ port, onClose, onDeleted }) {
  const [remove, state] = useDeleteAdminPortMutation();
  const [error, setError] = useState(null);
  const inUse = port.jobCount != null && port.jobCount > 0;
  async function confirm() {
    setError(null);
    try { await remove({ id: port.id }).unwrap(); onDeleted(); }
    catch (failure) { setError(failure?.status === 'CUSTOM_ERROR' ? failure.error : getApiErrorMessage(failure)); }
  }
  return (
    <Modal open width={460} title={`Delete ${port.name}?`}
      onClose={() => { if (!state.isLoading) onClose(); }}
      footer={<>
        <Button variant="outline" disabled={state.isLoading} onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={inUse || state.isLoading} onClick={confirm}>{state.isLoading ? 'Deleting…' : 'Delete Port'}</Button>
      </>}>
      <div className={styles.form}>
        {error && <Banner tone="danger">{error}</Banner>}
        {inUse
          ? <Banner tone="warning" title="This port has jobs">{`${show(port.jobCount)} job${port.jobCount === 1 ? '' : 's'} use this port, so it can’t be deleted. Pause it instead to stop new jobs.`}</Banner>
          : <p className="tk-meta" style={{ margin: 0 }}>This removes the port and its {port.terminalCount === 1 ? 'terminal' : 'terminals'}. It can’t be undone.</p>}
      </div>
    </Modal>
  );
}
