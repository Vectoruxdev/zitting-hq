import React from 'react';

/**
 * Button — pill-shaped action. The primary variant is the one high-contrast
 * moment per screen: a solid white pill with black text. Secondary/ghost stay
 * dark and quiet. Sizes sm/md/lg. Optional leading/trailing icon nodes.
 */
export function Button({
  children,
  variant = 'secondary', // primary | secondary | ghost | accent | destructive
  size = 'md',           // sm | md | lg
  iconLeft = null,
  iconRight = null,
  disabled = false,
  full = false,
  type = 'button',
  onClick,
  style,
  ...rest
}) {
  const sizes = {
    sm: { height: 30, padding: '0 14px', font: 13, gap: 6 },
    md: { height: 38, padding: '0 18px', font: 14, gap: 8 },
    lg: { height: 46, padding: '0 24px', font: 15, gap: 8 },
  };
  const s = sizes[size] || sizes.md;

  const variants = {
    primary: {
      background: 'var(--btn-primary-bg)',
      color: 'var(--btn-primary-fg)',
      border: '1px solid transparent',
      fontWeight: 600,
    },
    accent: {
      background: 'var(--accent)',
      color: 'var(--text-on-accent)',
      border: '1px solid transparent',
      fontWeight: 600,
    },
    secondary: {
      background: 'var(--surface-raised)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-hairline)',
      fontWeight: 500,
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid transparent',
      fontWeight: 500,
    },
    destructive: {
      background: 'var(--negative-soft)',
      color: 'var(--negative)',
      border: '1px solid transparent',
      fontWeight: 600,
    },
  };
  const v = variants[variant] || variants.secondary;

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="zt-button"
      style={{
        display: full ? 'flex' : 'inline-flex',
        width: full ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.height,
        padding: s.padding,
        fontFamily: 'var(--font-sans)',
        fontSize: s.font,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        borderRadius: 'var(--radius-pill)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
        transition: 'background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out)',
        ...v,
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >
      {iconLeft ? <span style={{ display: 'inline-flex', marginLeft: -2 }}>{iconLeft}</span> : null}
      {children}
      {iconRight ? <span style={{ display: 'inline-flex', marginRight: -2 }}>{iconRight}</span> : null}
    </button>
  );
}
