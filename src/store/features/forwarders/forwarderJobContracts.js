const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
function positive(value) {
  return value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0.1 ? Number(value) : null;
}
function fail(message) {
  throw new Error(message);
}
function fileUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export function forwarderJobBody(fields) {
  const movements = ['PORT_TO_DESTINATION', 'PORT_TO_PORT', 'BULK_BREAK', 'EXPORT'];
  if (!text(fields.forwarderId) || !movements.includes(fields.movementType) || !['CONTAINER', 'BULK_BREAK'].includes(fields.cargoType)) fail('Select a forwarder, movement and cargo type.');
  if (fields.movementType === 'BULK_BREAK' && fields.cargoType !== 'BULK_BREAK') fail('Bulk Break movement requires bulk cargo.');
  if (!text(fields.portId) || !text(fields.terminalId)) fail('Select a port and terminal.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fields.tdoDate || '')) fail('Enter a valid TDO date and time.');
  const tdo = new Date(fields.tdoDate + ':00+01:00');
  const local = new Date(tdo.getTime() + 3600000);
  if (!Number.isFinite(tdo.getTime()) || local.toISOString().slice(0, 16) !== fields.tdoDate || tdo.getTime() < Date.now() + 86400000) fail('The TDO date must be at least 24 hours from now.');
  const body = {
    forwarderId: fields.forwarderId,
    cargoType: fields.cargoType,
    movementType: fields.movementType,
    portId: fields.portId,
    terminalId: fields.terminalId,
    tdoDate: tdo.toISOString()
  };
  if (fields.movementType === 'PORT_TO_PORT') {
    if (!text(fields.dropoffPortId) || !text(fields.dropoffTerminalId)) fail('Select the dropoff port and terminal.');
    body.dropoffPortId = fields.dropoffPortId;
    body.dropoffTerminalId = fields.dropoffTerminalId;
  } else if (fields.movementType === 'EXPORT') {
    if (!text(fields.pickupAddress)) fail('Enter the pickup warehouse address.');
    body.pickupAddress = fields.pickupAddress.trim();
  } else {
    if (!text(fields.deliveryAddress)) fail('Enter the delivery address.');
    body.deliveryAddress = fields.deliveryAddress.trim();
  }
  if (fields.movementType === 'PORT_TO_DESTINATION') {
    if (!text(fields.containerReturnAddress)) fail('Enter the container return address.');
    body.containerReturnAddress = fields.containerReturnAddress.trim();
  }
  if (text(fields.warehouseState) && fields.movementType !== 'PORT_TO_PORT') body.warehouseState = fields.warehouseState.trim();
  if (text(fields.cargoDescription)) body.cargoDescription = fields.cargoDescription.trim();
  if (fields.cargoType === 'CONTAINER') {
    if (!Array.isArray(fields.containers) || !fields.containers.length) fail('Add at least one container.');
    body.containers = fields.containers.map(row => {
      const containerNumber = text(row.containerNumber)?.toUpperCase(),
        goodsTonnage = positive(row.goodsTonnage);
      if (!text(row.containerSizeId) || !text(row.containerTypeId) || !/^[A-Z]{4}\d{7}$/.test(containerNumber || '') || goodsTonnage == null) fail('Each container needs a size, type, container number and weight of at least 0.1 tonnes.');
      return {
        containerSizeId: row.containerSizeId,
        containerTypeId: row.containerTypeId,
        containerNumber,
        goodsTonnage
      };
    });
    if (new Set(body.containers.map(row => row.containerNumber)).size !== body.containers.length) fail('Each container number must be unique.');
  } else {
    if (!Array.isArray(fields.racks) || !fields.racks.length) fail('Add at least one truck load.');
    body.racks = fields.racks.map(row => {
      const weight = positive(row.weight);
      if (!text(row.truckTypeId) || !text(row.rackNumber) || weight == null) fail('Each truck load needs a truck type, rack number and weight of at least 0.1 tonnes.');
      const item = {
        truckTypeId: row.truckTypeId,
        rackNumber: row.rackNumber.trim(),
        weight
      };
      if (text(row.cargoPhotoUrl)) {
        const url = fileUrl(row.cargoPhotoUrl);
        if (!url) fail('Enter a valid HTTPS cargo photo URL.');
        item.cargoPhotoUrl = url;
      }
      return item;
    });
  }
  return body;
}
