import React from 'react';

/* A small, calm palette for member initials — tonal, never loud. */
const AVATAR_COLORS = [
  { bg: 'rgba(63,208,127,0.16)',  fg: '#5BDB97' },
  { bg: 'rgba(110,108,240,0.18)', fg: '#8A88F4' },
  { bg: 'rgba(229,163,61,0.18)',  fg: '#E5A33D' },
  { bg: 'rgba(245,245,246,0.10)', fg: '#C9C9CE' },
];

function hashIndex(str, mod) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % mod;
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Avatar — initials chip for a family member (or "Household"). Pass `src` for a
 * photo, otherwise initials are derived from `name` and colored deterministically.
 * `tone` overrides the auto color. Sizes xs→lg.
 */
export function Avatar({ name, src, tone, size = 'md', ring = false, style, ...rest }) {
  const dims = { xs: 22, sm: 28, md: 34, lg: 44 };
  const fonts = { xs: 10, sm: 11, md: 13, lg: 16 };
  const d = dims[size] || dims.md;
  const c = tone ? { bg: 'var(--accent-soft)', fg: 'var(--accent)' } : AVATAR_COLORS[hashIndex(name, AVATAR_COLORS.length)];

  return (
    <span
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: d,
        height: d,
        borderRadius: 'var(--radius-pill)',
        background: src ? 'var(--surface-raised)' : c.bg,
        color: c.fg,
        fontFamily: 'var(--font-sans)',
        fontSize: fonts[size] || 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
        flex: 'none',
        overflow: 'hidden',
        boxShadow: ring ? '0 0 0 2px var(--bg-app), 0 0 0 3px var(--border-hairline)' : 'none',
        ...style,
      }}
      {...rest}
    >
      {src ? (
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : initials(name)}
    </span>
  );
}
