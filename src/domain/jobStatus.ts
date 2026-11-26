// How a job's status looks on screen. One place, so the list, the board and the detail screen agree.

export type StatusTone = 'warning' | 'purple' | 'info' | 'success' | 'neutral' | 'danger';

const STATUS_TONE: Record<string, StatusTone> = {
  'Pending Approval': 'warning',
  Bidding: 'purple',
  Assigned: 'info',
  'In Transit': 'warning',
  Delivered: 'success',
  Cancelled: 'neutral',
  Rejected: 'danger',
  Open: 'info',
  'At Pickup': 'warning',
  'Awaiting Assignment': 'warning',
  'Partially Assigned': 'warning',
  'Partially Delivered': 'info',
  'Attention Required': 'danger',
  Delayed: 'danger',
};

export function statusTone(status: string | null | undefined): StatusTone {
  return (status && STATUS_TONE[status]) || 'neutral';
}

/** The backend's job status code, in the words the admin uses */
export const STATUS_LABELS: Record<string, string> = {
  TRUCK_REQUESTED: 'Pending Approval',
  DOC_REVIEW: 'Pending Approval',
  DOCUMENTS_VALIDATED: 'Bidding',
  DRIVER_ASSIGNED: 'Assigned',
  DRIVER_EN_ROUTE: 'Assigned',
  DRIVER_ARRIVED: 'Assigned',
  PICKUP_COMPLETED: 'In Transit',
  IN_TRANSIT: 'In Transit',
  CARGO_ARRIVED: 'In Transit',
  DEMURRAGE_IN_PROGRESS: 'In Transit',
  OFFLOADING: 'In Transit',
  OFFLOAD_COMPLETED: 'In Transit',
  CONTAINER_RETURNED: 'In Transit',
  COMPLETED: 'Delivered',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Attention Required',
};

/** A trip in one of these statuses is on the road */
export const ACTIVE_TRIP_STATUSES = new Set([
  'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'PICKUP_COMPLETED', 'IN_TRANSIT', 'CARGO_ARRIVED',
  'DEMURRAGE_IN_PROGRESS', 'OFFLOADING', 'OFFLOAD_COMPLETED', 'CONTAINER_RETURNED',
]);

/** Trips that can be marked "at delivery" */
export const ARRIVAL_TRIP_STATUSES = new Set(['DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'PICKUP_COMPLETED', 'IN_TRANSIT']);

export const TERMINAL_JOB_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

/** Jobs that can be marked delivered */
export const DELIVERABLE_JOB_STATUSES = new Set(['DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'PICKUP_COMPLETED', 'IN_TRANSIT', 'CONTAINER_RETURNED']);
