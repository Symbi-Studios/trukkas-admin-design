'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner, Button, Checkbox, Modal } from '../ds.js';
import { TriangulationGoogleMap } from './TriangulationGoogleMap.jsx';
import { useCreateAdminTrackingGeofenceMutation } from '../store/features/tracking/trackingApi.js';
import { geofenceBoundaryError } from '../store/features/tracking/geofenceGeometry.js';

export function TrackingGeofenceDialog({ open, target, onClose, onCreated }) {
  const [vertices, setVertices] = useState([]);
  const [notifyOnEntry, setNotifyOnEntry] = useState(true);
  const [notifyOnExit, setNotifyOnExit] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState('');
  const [saveUnconfirmed, setSaveUnconfirmed] = useState(false);
  const savingLock = useRef(false);
  const [createGeofence, { isLoading: saving }] = useCreateAdminTrackingGeofenceMutation();
  useEffect(() => {
    if (!open) return;
    setVertices([]); setNotifyOnEntry(true); setNotifyOnExit(true); setMapReady(false); setError(''); setSaveUnconfirmed(false);
  }, [open, target]);
  const points = useMemo(() => target?.position ? [{ ...target.position, title: target.truck, opportunityId: target.tripId }] : [], [target]);
  const boundaryError = geofenceBoundaryError(vertices);
  const disabled = saving || saveUnconfirmed;
  function close() { if (!savingLock.current) onClose(); }
  function updateBoundary(next) {
    if (savingLock.current || saveUnconfirmed) return;
    if (next.length > 200) { setVertices((current) => [...current]); setError('A boundary can contain at most 200 points.'); return; }
    setVertices(next); setError('');
  }
  async function save() {
    if (savingLock.current || !mapReady || !target?.truckId || boundaryError || !notifyOnEntry && !notifyOnExit || saveUnconfirmed) return;
    savingLock.current = true; setError('');
    try {
      const saved = await createGeofence({ tripId: target.tripId, truckId: target.truckId, vertices, notifyOnEntry, notifyOnExit }).unwrap();
      onCreated(saved); onClose();
    } catch (failure) {
      const detail = failure?.data?.message || failure?.error || failure?.message;
      setError(Array.isArray(detail) ? detail.join(', ') : typeof detail === 'string' ? detail : 'Unable to create the geofence.');
      setSaveUnconfirmed(failure?.saveUnconfirmed === true);
    } finally { savingLock.current = false; }
  }
  return <Modal open={open} onClose={close} title="Create Geofence" description="Draw a boundary around a location to get alerts when trucks enter or exit." width={720}
    footer={<><Button variant="outline" disabled={saving} onClick={close}>Close</Button><Button icon="shield" disabled={disabled || !mapReady || !target?.truckId || Boolean(boundaryError) || !notifyOnEntry && !notifyOnExit} onClick={() => void save()}>{saving ? 'Creating…' : 'Create Geofence'}</Button></>}>
    <div style={{ display: 'grid', gap: 12 }}>
      <span className="tk-meta">Truck: {target?.truck || '—'} · Trip: {target?.tripId || '—'}</span>
      <span className="tk-meta">Click the map to add points. Drag a boundary point to adjust it. The boundary closes automatically.</span>
      <div style={{ height: 320, position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--tk-line-strong)' }}>
        {open && <TriangulationGoogleMap points={points} selectedId={target?.tripId} ariaLabel="Draw geofence boundary" fitOnDataChange={false}
          drawingPoints={vertices} onDrawingPoint={(point) => { if (!vertices.some((vertex) => vertex.lat === point.lat && vertex.lng === point.lng)) updateBoundary([...vertices, point]); }}
          onDrawingChange={updateBoundary} drawingDisabled={disabled} onReady={setMapReady} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <span className="tk-meta" style={{ flex: 1 }}>{vertices.length} / 200 points</span>
        <Button size="sm" variant="outline" disabled={disabled || !vertices.length} onClick={() => updateBoundary(vertices.slice(0, -1))}>Undo Point</Button>
        <Button size="sm" variant="outline" disabled={disabled || !vertices.length} onClick={() => updateBoundary([])}>Clear Boundary</Button>
      </div>
      <span className="tk-meta" role="status">{boundaryError || 'Boundary ready to save.'}</span>
      <Checkbox label="Notify on entry" checked={notifyOnEntry} disabled={disabled} onChange={setNotifyOnEntry} />
      <Checkbox label="Notify on exit" checked={notifyOnExit} disabled={disabled} onChange={setNotifyOnExit} />
      {!notifyOnEntry && !notifyOnExit && <span className="tk-meta">Enable entry or exit notifications.</span>}
      {error && <Banner tone="danger" title="Geofence not confirmed">{error}</Banner>}
    </div>
  </Modal>;
}
