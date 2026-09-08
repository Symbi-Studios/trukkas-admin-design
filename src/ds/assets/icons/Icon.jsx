import React from 'react';

const CDN = 'https://cdn.jsdelivr.net/npm/lucide-static@0.462.0/icons';

/**
 * Lucide glyph rendered as a CSS mask so it always paints in currentColor.
 * name is the kebab-case Lucide id: "truck", "map-pin", "wallet", "chevron-down".
 */
export function Icon({ name, size = 18, color = 'currentColor', style, title, ...rest }) {
  const url = `url("${CDN}/${name}.svg")`;
  return (
    <span
      role="img"
      aria-label={title || name}
      {...rest}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flex: '0 0 auto',
        backgroundColor: color,
        WebkitMask: url + ' center / contain no-repeat',
        mask: url + ' center / contain no-repeat',
        ...style,
      }}
    />
  );
}
