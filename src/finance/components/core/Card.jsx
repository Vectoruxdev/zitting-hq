import React from 'react';

/**
 * Card — the base dark surface. Borderless by default (separation via tone +
 * soft shadow); pass `bordered` for a hairline, `raised` for the elevated panel
 * tone, `padding` to override. `as` lets it render a different element.
 */
export function Card({
  children,
  raised = false,
  bordered = false,
  interactive = false,
  padding = 22,
  radius = 'var(--radius-lg)',
  as = 'div',
  style,
  ...rest
}) {
  const El = as;
  return (
    <El
      style={{
        background: raised ? 'var(--surface-raised)' : 'var(--surface-card)',
        border: bordered ? '1px solid var(--border-hairline)' : '1px solid transparent',
        borderRadius: radius,
        padding,
        boxShadow: 'var(--shadow-md)',
        transition: 'background var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
        cursor: interactive ? 'pointer' : 'default',
        ...style,
      }}
      onMouseEnter={interactive ? (e) => { e.currentTarget.style.background = 'var(--surface-hover)'; } : undefined}
      onMouseLeave={interactive ? (e) => { e.currentTarget.style.background = raised ? 'var(--surface-raised)' : 'var(--surface-card)'; } : undefined}
      {...rest}
    >
      {children}
    </El>
  );
}

/**
 * SectionHeader — title (optionally with eyebrow) + an optional "see all" / action
 * on the right. Use above lists, tables, and card groups.
 */
export function SectionHeader({ title, eyebrow, action, style, ...rest }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 16, ...style }} {...rest}>
      <div>
        {eyebrow ? <div className="zt-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div> : null}
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      {action ? <div style={{ flex: 'none' }}>{action}</div> : null}
    </div>
  );
}
