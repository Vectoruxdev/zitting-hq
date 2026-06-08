import React from 'react';

/**
 * Select — a token-styled native dropdown. `options` is [{value,label}] or
 * plain strings. Reliable keyboard/a11y for free.
 */
export function Select({ value, onChange, options = [], placeholder, label, disabled = false, style, ...rest }) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label ? <span className="zt-eyebrow">{label}</span> : null}
      <span
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          height: 40,
          background: 'var(--surface-sunken)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-md, 12px)',
        }}
      >
        <select
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange && onChange(e.target.value, e)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            flex: 1,
            height: '100%',
            padding: '0 34px 0 12px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span style={{ position: 'absolute', right: 11, pointerEvents: 'none', color: 'var(--text-tertiary)', display: 'inline-flex' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </span>
    </label>
  );
}
