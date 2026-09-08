import { Card, EmptyState } from '../ds.js';

/** Honest stand-in for nav destinations not yet built bespoke — see HANDOFF.md, "Screen coverage". */
export function ScreenPlaceholder({ label }) {
  return (
    <Card>
      <EmptyState icon="hammer" title={`${label} isn't built yet`}
        description="This destination is wired into navigation and routing, but its screen hasn't been transcribed from the source screenshots yet." />
    </Card>
  );
}
