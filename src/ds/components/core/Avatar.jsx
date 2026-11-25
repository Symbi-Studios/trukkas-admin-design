import React from 'react';

/** Initials (or a photo) in a neutral disc. Identity comes from the name beside it, not a colour;
 *  pass `tone` for the few places that want a filled mark (the signed-in account). */
export function Avatar({ name = '', src, size = 36, square = false, tone, style }) {
  const [failedSrc, setFailedSrc] = React.useState(null);
  const showImage = Boolean(src) && src !== failedSrc;
  const words = name.split(/\s+/).filter(Boolean);
  const initials = (words.length > 1
    ? words.slice(0, 2).map(w => w[0]).join('')
    : (words[0] || '').slice(0, 2)).toUpperCase();
  const filled = Boolean(tone);
  return (
    <div title={name} style={{
      width: size, height: size, flex: '0 0 auto',
      borderRadius: square ? 'var(--tk-r-sm)' : 'var(--tk-r-pill)',
      background: filled ? tone : 'var(--tk-neutral-soft)', overflow: 'hidden',
      boxShadow: filled ? undefined : 'inset 0 0 0 1px var(--tk-line)',
      color: filled ? (String(tone).includes('--tk-navy') ? 'var(--tk-ink-on-navy)' : '#fff') : 'var(--tk-ink-500)',
      display: 'grid', placeItems: 'center',
      font: `600 ${Math.round(size * 0.36)}px/1 var(--tk-font-sans)`, ...style,
    }}>{showImage ? <img src={src} alt="" onError={() => setFailedSrc(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}</div>
  );
}
