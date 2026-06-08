import React from 'react';

/** Checkbox — token-styled, controlled. Optional label. */
export function Checkbox({ checked = false, onChange, label, disabled = false, size = 18, style }) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <span
        onClick={(e) => {
          if (disabled) return;
          e.preventDefault();
          onChange && onChange(!checked);
        }}
        style={{
          width: size,
          height: size,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 5,
          background: checked ? 'var(--accent)' : 'var(--surface-sunken)',
          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-strong, var(--border-hairline))'}`,
          transition: 'background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
        }}
      >
        {checked ? (
          <svg width={size - 6} height={size - 6} viewBox="0 0 24 24" fill="none" stroke="var(--text-on-accent, #0a0a0a)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 6" />
          </svg>
        ) : null}
      </span>
      {label ? <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{label}</span> : null}
    </label>
  );
}
