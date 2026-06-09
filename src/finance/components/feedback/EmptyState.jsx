import React from 'react';
import { Button } from '../core/Button';
import { Icon } from '../core/Icon';

/**
 * EmptyState — a centered icon + title + body + optional actions, for views
 * with no data yet.
 */
export function EmptyState({ icon = 'list', title, body, actionLabel, onAction, secondaryLabel, onSecondary, style }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: '64px 20px', ...style }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <span style={{ display: 'inline-flex', width: 54, height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: 'var(--surface-raised)', color: 'var(--text-tertiary)', marginBottom: 15 }}>
          <Icon name={icon} size={24} />
        </span>
        {title ? <h2 style={{ margin: '0 0 7px', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2> : null}
        {body ? <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{body}</p> : null}
        {actionLabel || secondaryLabel ? (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {actionLabel ? <Button variant="primary" onClick={onAction}>{actionLabel}</Button> : null}
            {secondaryLabel ? <Button variant="secondary" onClick={onSecondary}>{secondaryLabel}</Button> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
