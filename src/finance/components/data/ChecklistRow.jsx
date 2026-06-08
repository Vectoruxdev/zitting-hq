import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Badge } from '../core/Badge.jsx';

/**
 * ChecklistRow — a single transfer to make: From account → To destination,
 * exact amount, due date, and a state. `state` is 'todo' | 'done' | 'auto'.
 * Renders a tappable check circle on the left; `onToggle` marks it sent.
 * The signature "every dollar has a job" row.
 */
export function ChecklistRow({
  from,
  to,
  amount,            // pre-formatted string like "$1,200.00"
  due,
  state = 'todo',    // todo | done | auto
  icon = 'transfers',
  onToggle,
  style,
  ...rest
}) {
  const done = state === 'done' || state === 'auto';
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        background: done ? 'transparent' : 'var(--surface-card)',
        border: '1px solid',
        borderColor: done ? 'var(--border-hairline)' : 'transparent',
        borderRadius: 'var(--radius-md)',
        opacity: done ? 0.82 : 1,
        transition: 'background var(--dur-base) var(--ease-out), opacity var(--dur-base)',
        ...style,
      }}
      {...rest}
    >
      <button
        type="button"
        onClick={state === 'auto' ? undefined : onToggle}
        aria-label={done ? 'Sent' : 'Mark sent'}
        style={{
          width: 26, height: 26, flex: 'none',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 999,
          border: '1.5px solid',
          borderColor: done ? 'transparent' : 'var(--border-strong)',
          background: done ? 'var(--accent)' : 'transparent',
          color: done ? 'var(--text-on-accent)' : 'var(--text-tertiary)',
          cursor: state === 'auto' ? 'default' : 'pointer',
          transition: 'all var(--dur-fast) var(--ease-out)',
        }}
      >
        {done ? <Icon name="check" size={15} strokeWidth={2.4} /> : null}
      </button>

      <span style={{ width: 34, height: 34, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
        <Icon name={icon} size={17} />
      </span>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 500, color: 'var(--text-primary)' }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{to}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
          <span>From {from}</span>
          {due ? <React.Fragment><span>·</span><span>{due}</span></React.Fragment> : null}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flex: 'none' }}>
        <span className="zt-num" style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{amount}</span>
        {state === 'auto' ? <Badge status="auto-confirmed" size="sm" /> : state === 'done' ? <Badge status="sent" size="sm" dot /> : <Badge status="awaiting" size="sm" dot />}
      </div>
    </div>
  );
}
