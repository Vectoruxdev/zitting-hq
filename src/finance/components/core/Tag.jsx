import React from 'react';
import { Icon } from './Icon.jsx';

/**
 * Tag — a category chip (e.g. Groceries, Dining). Quiet dark pill with a small
 * colored category dot. `editable` adds a chevron affordance; `onRemove` adds
 * an × . Use the `color` prop for the category's hue.
 */
export function Tag({
  children,
  color = 'var(--gray-400)',
  editable = false,
  onRemove,
  onClick,
  size = 'md',
  style,
  ...rest
}) {
  const pad = size === 'sm' ? '3px 9px' : '4px 11px';
  const fs = size === 'sm' ? 12 : 13;
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: pad,
        fontFamily: 'var(--font-sans)',
        fontSize: fs,
        fontWeight: 500,
        lineHeight: 1,
        color: 'var(--text-primary)',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-pill)',
        cursor: onClick || editable ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        transition: 'background var(--dur-fast) var(--ease-out)',
        ...style,
      }}
      onMouseEnter={(e) => { if (onClick || editable) e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { if (onClick || editable) e.currentTarget.style.background = 'var(--surface-raised)'; }}
      {...rest}
    >
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color, flex: 'none' }} />
      {children}
      {editable ? <Icon name="chevronDown" size={13} style={{ color: 'var(--text-tertiary)', marginRight: -2 }} /> : null}
      {onRemove ? (
        <span
          onClick={(e) => { e.stopPropagation(); onRemove(e); }}
          style={{ display: 'inline-flex', marginRight: -3, color: 'var(--text-tertiary)' }}
        >
          <Icon name="x" size={13} />
        </span>
      ) : null}
    </span>
  );
}
