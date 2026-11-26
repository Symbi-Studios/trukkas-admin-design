// The movement of a job, named the way the mobile app names it (Create job, step 1).
// The CODE is the contract with the backend; the label is ours, so every admin screen says the same thing
// even when the backend's own label differs ("Transfer", "Import (Container)" do not exist in the app).
// Movement is separate from cargo: whether a job carries containers or racks is a different field (itemKind).

export const MOVEMENT_LABELS: Record<string, string> = {
  PORT_TO_DESTINATION: 'Port-to-Destination',
  PORT_TO_PORT: 'Port-to-Port',
  // not offered in the app yet (exporter flow paused); the name is ready for when it is
  EXPORT: 'Export',
  // the backend still lists it as a movement; the app only offers it as a cargo kind
  BULK_BREAK: 'Break bulk',
};

/** What the app offers today, for filters */
export const MOVEMENT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'PORT_TO_DESTINATION', label: MOVEMENT_LABELS.PORT_TO_DESTINATION },
  { value: 'PORT_TO_PORT', label: MOVEMENT_LABELS.PORT_TO_PORT },
];

export function movementLabel(code: string | null | undefined, backendLabel?: string | null): string {
  if (code && MOVEMENT_LABELS[code]) return MOVEMENT_LABELS[code];
  return (backendLabel && backendLabel.trim()) || '—';
}