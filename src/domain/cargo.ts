// What a job carries, named the way the mobile app names it (Create job, step 3).
// Movement (Port-to-Port...) and cargo kind are separate things: see domain/movement.ts.

/** "Container" / "Break bulk" from the backend's cargo type code (the backend's enum value is BULK_BREAK; BREAK_BULK is accepted too) */
export function cargoKindLabel(code: string | null | undefined, backendLabel?: string | null): string | null {
  if (code === 'CONTAINER') return 'Container';
  if (code === 'BULK_BREAK' || code === 'BREAK_BULK') return 'Break bulk';
  return backendLabel?.trim() || null;
}

export const CARGO_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: 'CONTAINER', label: 'Containers' },
  { value: 'BULK_BREAK', label: 'Break bulk' },
];
