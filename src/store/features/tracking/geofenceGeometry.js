// The editor uses map coordinates; the API boundary converts these to latitude/longitude.
export function geofenceBoundaryError(vertices) {
  if (!Array.isArray(vertices) || vertices.length < 3) return 'Add at least three boundary points.';
  if (vertices.length > 200) return 'A boundary can contain at most 200 points.';
  if (!vertices.every((point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180)) return 'The boundary contains an invalid coordinate.';
  if (new Set(vertices.map((point) => point.lat + ',' + point.lng)).size !== vertices.length) return 'Each boundary point must be distinct; the boundary closes automatically.';
  // Unwrap around the first longitude so shapes crossing the date line remain local.
  const origin = vertices[0];
  const local = vertices.map((point) => ({ y: point.lat - origin.lat, x: ((point.lng - origin.lng + 540) % 360) - 180 }));
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const area = local.reduce((sum, point, index) => { const next = local[(index + 1) % local.length]; return sum + point.x * next.y - next.x * point.y; }, 0);
  if (Math.abs(area) < 1e-14) return 'Draw a boundary enclosing an area.';
  const onSegment = (a, b, p) => Math.abs(cross(a, b, p)) < 1e-14 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
  for (let i = 0; i < local.length; i += 1) {
    const a = local[i], b = local[(i + 1) % local.length];
    for (let j = i + 1; j < local.length; j += 1) {
      if (j === i + 1 || i === 0 && j === local.length - 1) continue;
      const c = local[j], d = local[(j + 1) % local.length];
      const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
      if (abC * abD < 0 && cdA * cdB < 0 || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) return 'Boundary edges must not cross or overlap.';
    }
  }
  return null;
}
