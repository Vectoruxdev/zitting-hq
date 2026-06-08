import React from 'react';
import { Icon } from './Icon.jsx';

/**
 * IconButton — a square/circular icon-only control. Quiet dark pill with a
 * hairline border by default; `ghost` for toolbar/rail use. Pass an `icon`
 * name (from the Zitting set) or arbitrary `children`.
 */
export function IconButton({
  icon,
  children,
  variant = 'ghost', // ghost | solid | outline
  size = 'md',       // sm | md | lg
  round = true,
  active = false,
  disabled = false,
  label,
  onClick,
  style,
  ...rest
}) {
  const dims = { sm: 30, md: 36, lg: 42 };
  const iconSizes = { sm: 16, md: 18, lg: 20 };
  const d = dims[size] || dims.md;

  const variants = {
    ghost: {
      background: active ? 'var(--surface-hover)' : 'transparent',
      border: '1px solid transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    },
    solid: {
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-hairline)',
      color: 'var(--text-primary)',
    },
    outline: {
      background: 'transparent',
      border: '1px solid var(--border-hairline)',
      color: 'var(--text-secondary)',
    },
  };
  const v = variants[variant] || variants.ghost;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: d,
        height: d,
        borderRadius: round ? 'var(--radius-pill)' : 'var(--radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
        ...v,
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled && !active) { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = v.background; e.currentTarget.style.color = v.color; } }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.94)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={iconSizes[size]} /> : children}
    </button>
  );
}
