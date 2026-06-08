import React from 'react';

/**
 * Tabs — underline-style navigation (white underline on the active tab),
 * matching the Buy/Sell pattern. Options are strings or {value,label,badge}.
 */
export function Tabs({ options = [], value, defaultValue, onChange, style, ...rest }) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? (opts[0] && opts[0].value));
  const active = isControlled ? value : internal;

  function pick(v) {
    if (!isControlled) setInternal(v);
    onChange && onChange(v);
  }

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        borderBottom: '1px solid var(--border-hairline)',
        ...style,
      }}
      {...rest}
    >
      {opts.map((o) => {
        const on = o.value === active;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => pick(o.value)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 1px 13px',
              background: 'none',
              border: 'none',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: on ? 600 : 500,
              color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {o.label}
            {o.badge != null ? (
              <span style={{
                fontFamily: 'var(--font-numeric)', fontSize: 11, fontWeight: 600,
                color: 'var(--text-tertiary)', background: 'var(--paper-tint)',
                padding: '1px 6px', borderRadius: 999,
              }}>{o.badge}</span>
            ) : null}
            <span
              style={{
                position: 'absolute',
                left: 0, right: 0, bottom: -1, height: 2,
                background: on ? 'var(--text-primary)' : 'transparent',
                borderRadius: 2,
                transition: 'background var(--dur-fast) var(--ease-out)',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
