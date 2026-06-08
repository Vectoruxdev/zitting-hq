import React from 'react';

/**
 * SegmentedControl — a pill group on dark. Active segment = lighter dark pill.
 * Used for time ranges (1D 1W 1M…) and allocation methods (% | Fixed | Remainder).
 * Controlled via `value`/`onChange`; options are strings or {value,label}.
 */
export function SegmentedControl({ options = [], value, defaultValue, onChange, size = 'md', full = false, style, ...rest }) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? (opts[0] && opts[0].value));
  const active = isControlled ? value : internal;

  const h = size === 'sm' ? 30 : 36;
  const fs = size === 'sm' ? 12 : 13;

  function pick(v) {
    if (!isControlled) setInternal(v);
    onChange && onChange(v);
  }

  return (
    <div
      role="tablist"
      style={{
        display: full ? 'grid' : 'inline-grid',
        gridAutoFlow: 'column',
        gridAutoColumns: full ? '1fr' : 'auto',
        gap: 2,
        padding: 3,
        background: 'var(--surface-sunken)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-pill)',
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
              height: h,
              padding: '0 16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: 'var(--font-sans)',
              fontSize: fs,
              fontWeight: on ? 600 : 500,
              color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: on ? 'var(--surface-raised)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              boxShadow: on ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
