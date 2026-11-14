import React from 'react';

const PALETTE = ['var(--tk-blue)', 'var(--tk-purple)', 'var(--tk-success)', 'var(--tk-orange)', 'var(--tk-teal)', 'var(--tk-navy)'];

export function Avatar({ name = '', src, size = 36, square = false, tone, style }) {
  const [failedSrc, setFailedSrc] = React.useState(null);
  const showImage = Boolean(src) && src !== failedSrc;
  const words = name.split(/\s+/).filter(Boolean);
  const initials = (words.length > 1
    ? words.slice(0, 2).map(w => w[0]).join('')
    : (words[0] || '').slice(0, 2)).toUpperCase();
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = tone || PALETTE[hash % PALETTE.length];
  return (
    <div title={name} style={{
      width: size, height: size, flex: '0 0 auto',
      borderRadius: square ? 'var(--tk-r-sm)' : 'var(--tk-r-pill)',
      background: bg, overflow: 'hidden',
      color: '#fff', display: 'grid', placeItems: 'center',
      font: `600 ${Math.round(size * 0.36)}px/1 var(--tk-font-sans)`, ...style,
    }}>{showImage ? <img src={src} alt="" onError={() => setFailedSrc(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}</div>
  );
}
