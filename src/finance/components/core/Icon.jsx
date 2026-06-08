import React from 'react';

/**
 * Icon — renders a Lucide-style line glyph from the Zitting icon set
 * (window.ZT_ICONS, loaded via assets/icons.js). Monochrome, inherits
 * currentColor, ~1.75 stroke. Use muted color at rest, brighten on active.
 */
export function Icon({ name, size = 18, strokeWidth = 1.75, color, style, title, ...rest }) {
  const inner = (typeof window !== 'undefined' && window.ZT_ICONS && window.ZT_ICONS[name]) || '';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      style={{ display: 'block', flex: 'none', color: color || 'currentColor', ...style }}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : '') + inner }}
      {...rest}
    />
  );
}
