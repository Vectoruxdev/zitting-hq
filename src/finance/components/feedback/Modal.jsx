import React from 'react';
import { createPortal } from 'react-dom';
import { overlayFrame, useVisibleViewport } from '../../../ui/overlays/viewport';

/**
 * Modal — centered dialog over a dim overlay. Controlled via `open`/`onClose`.
 * Matches the design tokens (dark card, large radius, soft shadow).
 *
 * Rendered through a portal to <body> so the `position: fixed` overlay is
 * relative to the viewport — the finance screens sit inside a `.zt-enter`
 * wrapper whose lingering `transform` would otherwise become the containing
 * block and clip a tall modal under the header. The portal also lets it cover
 * the full screen on mobile.
 *
 * The header and footer stay put and only the body scrolls, so the buttons are
 * always on screen. While the on-screen keyboard is up the overlay shrinks to
 * the visible part of the screen (see ui/overlays/viewport) instead of sitting
 * behind the keys.
 */
export function Modal({ open, onClose, title, children, footer, width = 460 }) {
  const ref = React.useRef(null);
  const box = useVisibleViewport(open, ref);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;
  const overlay = (
    <div
      onClick={onClose}
      style={{
        ...overlayFrame('fixed', box),
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(12px, 4vw, 24px)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="zt-enter"
        style={{
          width: '100%',
          maxWidth: width,
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-lg, 18px)',
          boxShadow: 'var(--shadow-pop, 0 24px 60px rgba(0,0,0,0.5))',
        }}
      >
        {title ? (
          <div
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-hairline)',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', padding: 4 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        ) : null}
        <div style={{ padding: 20, overflowY: 'auto', overscrollBehavior: 'contain', flex: '1 1 auto', minHeight: 0 }}>{children}</div>
        {footer ? (
          <div style={{ flex: 'none', display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border-hairline)' }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
  return createPortal(overlay, document.body);
}
