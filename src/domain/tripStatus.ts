// How a trip's status looks on screen. The CODE is what the backend filters on (statusFilter).
// The Trips screen shows trips in progress only: delivered and cancelled trips are not listed there.

export type TripTab = 'assigned' | 'atPickup' | 'inTransit' | 'atDelivery' | 'returningContainer' | 'delayed';

export type TripTone = 'info' | 'success' | 'purple' | 'orange' | 'teal' | 'danger' | 'neutral';

export const TRIP_TABS: { value: TripTab; label: string }[] = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'atPickup', label: 'At Pickup' },
  { value: 'inTransit', label: 'In Transit' },
  { value: 'atDelivery', label: 'At Delivery' },
  { value: 'returningContainer', label: 'Returning Container' },
  { value: 'delayed', label: 'Delayed' },
];

const TONES: Record<string, TripTone> = {
  Assigned: 'info',
  'In Transit': 'success',
  'At Pickup': 'purple',
  'At Delivery': 'orange',
  'Returning Container': 'teal',
  Delayed: 'danger',
  // only seen in the drawer, when a link opens a trip that has finished
  Delivered: 'success',
};

export function tripTone(status: string | null | undefined): TripTone {
  return (status && TONES[status]) || 'neutral';
}

export function isTripTab(value: string): value is TripTab {
  return TRIP_TABS.some((tab) => tab.value === value);
}