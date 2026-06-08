import React from 'react';

/**
 * TextInput — a token-styled text/number field. Optional label + error.
 */
export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  label,
  error,
  prefix,
  inputMode,
  disabled = false,
  style,
  ...rest
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label ? <span className="zt-eyebrow">{label}</span> : null}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 40,
          padding: '0 12px',
          background: 'var(--surface-sunken)',
          border: `1px solid ${error ? 'var(--negative)' : 'var(--border-hairline)'}`,
          borderRadius: 'var(--radius-md, 12px)',
        }}
      >
        {prefix ? <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>{prefix}</span> : null}
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange && onChange(e.target.value, e)}
          placeholder={placeholder}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
          }}
          {...rest}
        />
      </span>
      {error ? <span style={{ fontSize: 12, color: 'var(--negative)' }}>{error}</span> : null}
    </label>
  );
}
