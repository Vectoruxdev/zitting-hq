import React from 'react';

/**
 * Toggle — a switch. Off = dark track; on = green accent track. Quick slide.
 * Controlled via `checked` + `onChange`, or uncontrolled with `defaultChecked`.
 */
export function Toggle({ checked, defaultChecked = false, onChange, disabled = false, size = 'md', label, style, ...rest }) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;

  const dims = size === 'sm' ? { w: 34, h: 20, k: 14 } : { w: 42, h: 24, k: 18 };

  function toggle() {
    if (disabled) return;
    if (!isControlled) setInternal(!on);
    onChange && onChange(!on);
  }

  const sw = (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      disabled={disabled}
      style={{
        position: 'relative',
        width: dims.w,
        height: dims.h,
        flex: 'none',
        borderRadius: 'var(--radius-pill)',
        border: '1px solid',
        borderColor: on ? 'transparent' : 'var(--border-strong)',
        background: on ? 'var(--accent)' : 'var(--surface-sunken)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        padding: 0,
        transition: 'background var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: on ? `calc(100% - ${dims.k + 2}px)` : '2px',
          transform: 'translateY(-50%)',
          width: dims.k,
          height: dims.k,
          borderRadius: 999,
          background: on ? 'var(--text-on-accent)' : 'var(--paper-200)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
          transition: 'left var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out)',
        }}
      />
    </button>
  );

  if (!label) return sw;
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', ...style }} {...rest}>
      {sw}
      <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>{label}</span>
    </label>
  );
}
