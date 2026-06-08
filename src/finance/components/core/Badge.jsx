import React from 'react';

const TONES = {
  neutral:   { bg: 'var(--paper-tint)',    fg: 'var(--text-secondary)', dot: 'var(--gray-400)' },
  positive:  { bg: 'var(--positive-soft)',  fg: 'var(--positive)',       dot: 'var(--positive)' },
  warning:   { bg: 'var(--warning-soft)',   fg: 'var(--warning)',        dot: 'var(--warning)' },
  negative:  { bg: 'var(--negative-soft)',  fg: 'var(--negative)',       dot: 'var(--negative)' },
  accent:    { bg: 'var(--accent-soft)',    fg: 'var(--accent)',         dot: 'var(--accent)' },
  info:      { bg: 'var(--indigo-tint)',    fg: 'var(--indigo-400)',     dot: 'var(--indigo-400)' },
};

/** Map common finance statuses → tone, so callers can pass a status directly. */
const STATUS_TONE = {
  pending: 'warning', awaiting: 'warning', 'due soon': 'warning', changed: 'warning',
  confirmed: 'positive', sent: 'positive', done: 'positive', 'auto-confirmed': 'accent',
  new: 'info', over: 'negative', 'over budget': 'negative', late: 'negative', missed: 'negative',
};

/**
 * Badge — tiny low-key status pill. Pass either an explicit `tone` or a
 * finance `status` string (pending, confirmed, new, changed, over budget…)
 * which maps to the right tone. `dot` shows a leading status dot.
 */
export function Badge({ children, tone, status, dot = false, size = 'md', style, ...rest }) {
  const resolved = tone || (status && STATUS_TONE[String(status).toLowerCase()]) || 'neutral';
  const t = TONES[resolved] || TONES.neutral;
  const pad = size === 'sm' ? '2px 8px' : '3px 10px';
  const fs = size === 'sm' ? 11 : 12;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: pad,
        fontFamily: 'var(--font-sans)',
        fontSize: fs,
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: '-0.005em',
        color: t.fg,
        background: t.bg,
        borderRadius: 'var(--radius-pill)',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {dot ? <span style={{ width: 6, height: 6, borderRadius: 999, background: t.dot, flex: 'none' }} /> : null}
      {children || status}
    </span>
  );
}
