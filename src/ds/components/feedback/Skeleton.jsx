import React from 'react';

/** Flat grey loading geometry — no shimmer gradient, no spinner where a shape will do. */
export function Skeleton({ width = '100%', height = 12, radius = 6, style }) {
  return <div style={{ width, height, borderRadius: radius, background: 'var(--tk-viz-track)', ...style }} />;
}

export function SkeletonRow({ columns = 4, style }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px 0', ...style }}>
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton key={i} height={12} width={i === 0 ? 180 : 90} />
      ))}
    </div>
  );
}
