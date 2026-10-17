"use client";

import { useRef, useState } from 'react';
import { Banner, Button, Modal, Select, Textarea, TextField } from '../ds.js';
import { DriverTableLoading } from './DriversLoading.jsx';
import { forwarderError, useGetAdminForwarderJobOptionsQuery, useGetAdminForwarderJobTerminalsQuery, useCreateAdminForwarderJobMutation } from '../store/features/forwarders/forwardersApi.js';
const container = () => ({
  key: crypto.randomUUID(),
  containerSizeId: '',
  containerTypeId: '',
  containerNumber: '',
  goodsTonnage: ''
});
const rack = () => ({
  key: crypto.randomUUID(),
  truckTypeId: '',
  rackNumber: '',
  weight: '',
  cargoPhotoUrl: ''
});
export function ForwarderJobModal({
  forwarder,
  owner,
  onClose,
  onDone
}) {
  const [fields, setFields] = useState(() => ({
    forwarderId: forwarder.id,
    cargoType: 'CONTAINER',
    movementType: 'PORT_TO_DESTINATION',
    portId: '',
    terminalId: '',
    dropoffPortId: '',
    dropoffTerminalId: '',
    tdoDate: '',
    pickupAddress: '',
    deliveryAddress: '',
    containerReturnAddress: '',
    warehouseState: '',
    cargoDescription: '',
    containers: [container()],
    racks: [rack()]
  }));
  const [error, setError] = useState(null),
    [unconfirmed, setUnconfirmed] = useState(false),
    lock = useRef(false);
  const [create, state] = useCreateAdminForwarderJobMutation();
  const optionsQuery = useGetAdminForwarderJobOptionsQuery(owner),
    options = optionsQuery.error ? null : optionsQuery.currentData;
  const terminalsQuery = useGetAdminForwarderJobTerminalsQuery({
    portId: fields.portId,
    owner
  }, {
    skip: !fields.portId
  });
  const dropoffQuery = useGetAdminForwarderJobTerminalsQuery({
    portId: fields.dropoffPortId,
    owner
  }, {
    skip: fields.movementType !== 'PORT_TO_PORT' || !fields.dropoffPortId
  });
  const busy = state.isLoading,
    disabled = busy || unconfirmed;
  const edit = key => event => setFields(current => ({
    ...current,
    [key]: event.target.value
  }));
  function changePort(key, terminalKey, value) {
    setFields(current => ({
      ...current,
      [key]: value,
      [terminalKey]: ''
    }));
  }
  function editRow(collection, key, field, value) {
    setFields(current => ({
      ...current,
      [collection]: current[collection].map(row => row.key === key ? {
        ...row,
        [field]: value
      } : row)
    }));
  }
  function close() {
    if (!lock.current) onClose();
  }
  async function submit(event) {
    event.preventDefault();
    if (lock.current || disabled || !options || optionsQuery.isFetching || terminalsQuery.isFetching || dropoffQuery.isFetching) return;
    lock.current = true;
    setError(null);
    try {
      const saved = await create(fields).unwrap();
      onDone?.('Job ' + saved.jobNumber + ' created.');
      onClose();
    } catch (failure) {
      setError(failure);
      setUnconfirmed(failure?.saveUnconfirmed === true);
    } finally {
      lock.current = false;
    }
  }
  const movements = [{
    value: 'PORT_TO_DESTINATION',
    label: 'Port to Destination'
  }, {
    value: 'PORT_TO_PORT',
    label: 'Port to Port'
  }, ...(fields.cargoType === 'BULK_BREAK' ? [{
    value: 'BULK_BREAK',
    label: 'Bulk Break'
  }] : []), ...(forwarder.exporterLicenseStatus === 'VERIFIED' ? [{
    value: 'EXPORT',
    label: 'Export'
  }] : [])];
  return <Modal open title="Create Job for this Forwarder" description={forwarder.name} width={800} onClose={close} footer={<><Button variant="outline" disabled={busy} onClick={close}>Cancel</Button><Button type="submit" form="forwarder-job-form" disabled={disabled || !options || optionsQuery.isFetching || Boolean(optionsQuery.error) || Boolean(terminalsQuery.error) || fields.movementType === 'PORT_TO_PORT' && Boolean(dropoffQuery.error)}>{busy ? 'Creating…' : 'Create Job'}</Button></>}>
    <form id="forwarder-job-form" onSubmit={submit} style={{
      display: 'grid',
      gap: 18
    }}>
      {error && <Banner tone="danger" title="Job creation not confirmed">{forwarderError(error)}</Banner>}
      {optionsQuery.isFetching ? <DriverTableLoading columns={2} label="Loading job options" /> : optionsQuery.error ? <Banner tone="danger" action={<Button type="button" variant="outline" onClick={optionsQuery.refetch}>Retry</Button>}>{forwarderError(optionsQuery.error)}</Banner> : <>
        <div className="fd-info-grid">
          <Select label="Cargo Type" value={fields.cargoType} disabled={disabled} options={[{
            value: 'CONTAINER',
            label: 'Container'
          }, {
            value: 'BULK_BREAK',
            label: 'Bulk Break'
          }]} onChange={event => setFields(current => ({
            ...current,
            cargoType: event.target.value,
            movementType: current.movementType === 'BULK_BREAK' && event.target.value === 'CONTAINER' ? 'PORT_TO_DESTINATION' : current.movementType
          }))} />
          <Select label="Movement Type" value={fields.movementType} disabled={disabled} options={movements} onChange={edit('movementType')} />
          <Select label={fields.movementType === 'EXPORT' ? 'Destination Port' : 'Pickup Port'} value={fields.portId} disabled={disabled} options={options?.ports || []} onChange={event => changePort('portId', 'terminalId', event.target.value)} />
          <Select label={fields.movementType === 'EXPORT' ? 'Destination Terminal' : 'Pickup Terminal'} value={fields.terminalId} disabled={disabled || !fields.portId || terminalsQuery.isFetching || Boolean(terminalsQuery.error)} options={!terminalsQuery.error ? terminalsQuery.currentData || [] : []} onChange={edit('terminalId')} />
          {fields.movementType === 'PORT_TO_PORT' && <><Select label="Dropoff Port" value={fields.dropoffPortId} disabled={disabled} options={options?.ports || []} onChange={event => changePort('dropoffPortId', 'dropoffTerminalId', event.target.value)} /><Select label="Dropoff Terminal" value={fields.dropoffTerminalId} disabled={disabled || !fields.dropoffPortId || dropoffQuery.isFetching || Boolean(dropoffQuery.error)} options={!dropoffQuery.error ? dropoffQuery.currentData || [] : []} onChange={edit('dropoffTerminalId')} /></>}
          <TextField label="TDO Date & Time (Lagos)" type="datetime-local" required value={fields.tdoDate} disabled={disabled} onChange={edit('tdoDate')} hint="At least 24 hours from now" />
          {fields.movementType !== 'PORT_TO_PORT' && <TextField label="Warehouse State (optional)" value={fields.warehouseState} disabled={disabled} onChange={edit('warehouseState')} />}
        </div>
        {terminalsQuery.isFetching && <DriverTableLoading columns={2} label="Loading pickup / destination terminals" />}
        {terminalsQuery.error && <Banner tone="danger" action={<Button type="button" variant="outline" onClick={terminalsQuery.refetch}>Retry</Button>}>{forwarderError(terminalsQuery.error)}</Banner>}
        {fields.movementType === 'PORT_TO_PORT' && dropoffQuery.isFetching && <DriverTableLoading columns={2} label="Loading dropoff terminals" />}
        {fields.movementType === 'PORT_TO_PORT' && dropoffQuery.error && <Banner tone="danger" action={<Button type="button" variant="outline" onClick={dropoffQuery.refetch}>Retry</Button>}>{forwarderError(dropoffQuery.error)}</Banner>}
        {fields.movementType === 'EXPORT' ? <Textarea label="Pickup Warehouse Address" value={fields.pickupAddress} required disabled={disabled} onChange={edit('pickupAddress')} /> : fields.movementType !== 'PORT_TO_PORT' && <Textarea label="Delivery Address" value={fields.deliveryAddress} required disabled={disabled} onChange={edit('deliveryAddress')} />}
        {fields.movementType === 'PORT_TO_DESTINATION' && <Textarea label="Container Return Address" value={fields.containerReturnAddress} required disabled={disabled} onChange={edit('containerReturnAddress')} />}
        <Textarea label="Cargo Description (optional)" value={fields.cargoDescription} disabled={disabled} onChange={edit('cargoDescription')} />
        {fields.cargoType === 'CONTAINER' ? <section><h3 className="tk-title">Containers</h3>{fields.containers.map((row, index) => <div key={row.key} className="fd-row" style={{
            display: 'grid',
            gap: 12
          }}><strong>Container {index + 1}</strong><div className="fd-info-grid"><Select label="Container Size" value={row.containerSizeId} options={options?.containerSizes || []} disabled={disabled} onChange={event => editRow('containers', row.key, 'containerSizeId', event.target.value)} /><Select label="Container Type" value={row.containerTypeId} options={options?.containerTypes || []} disabled={disabled} onChange={event => editRow('containers', row.key, 'containerTypeId', event.target.value)} /><TextField label="Container Number" value={row.containerNumber} required disabled={disabled} maxLength={11} onChange={event => editRow('containers', row.key, 'containerNumber', event.target.value.toUpperCase())} /><TextField label="Goods Weight (tonnes)" type="number" min={0.1} step="any" required value={row.goodsTonnage} disabled={disabled} onChange={event => editRow('containers', row.key, 'goodsTonnage', event.target.value)} /></div><Button type="button" size="sm" variant="outline" disabled={disabled || fields.containers.length === 1} onClick={() => setFields(current => ({
              ...current,
              containers: current.containers.filter(item => item.key !== row.key)
            }))}>Remove Container</Button></div>)}<Button type="button" variant="outline" icon="plus" disabled={disabled} onClick={() => setFields(current => ({
            ...current,
            containers: [...current.containers, container()]
          }))}>Add Container</Button></section> : <section><h3 className="tk-title">Truck Loads</h3>{fields.racks.map((row, index) => <div key={row.key} className="fd-row" style={{
            display: 'grid',
            gap: 12
          }}><strong>Truck Load {index + 1}</strong><div className="fd-info-grid"><Select label="Truck Type" value={row.truckTypeId} options={options?.truckTypes || []} disabled={disabled} onChange={event => editRow('racks', row.key, 'truckTypeId', event.target.value)} /><TextField label="Rack Number" required value={row.rackNumber} disabled={disabled} onChange={event => editRow('racks', row.key, 'rackNumber', event.target.value)} /><TextField label="Weight (tonnes)" type="number" min={0.1} step="any" required value={row.weight} disabled={disabled} onChange={event => editRow('racks', row.key, 'weight', event.target.value)} /><TextField label="Cargo Photo URL (optional)" type="url" value={row.cargoPhotoUrl} disabled={disabled} onChange={event => editRow('racks', row.key, 'cargoPhotoUrl', event.target.value)} /></div><Button type="button" size="sm" variant="outline" disabled={disabled || fields.racks.length === 1} onClick={() => setFields(current => ({
              ...current,
              racks: current.racks.filter(item => item.key !== row.key)
            }))}>Remove Truck Load</Button></div>)}<Button type="button" variant="outline" icon="plus" disabled={disabled} onClick={() => setFields(current => ({
            ...current,
            racks: [...current.racks, rack()]
          }))}>Add Truck Load</Button></section>}
      </>}
    </form>
  </Modal>;
}
