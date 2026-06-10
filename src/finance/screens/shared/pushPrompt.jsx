import React from 'react';
/**
 * Enable-phone-notifications card. Shared by the owner Notifications feed and
 * the member Spendable view. Reads window.ZHQ_PUSH (push.js) for capability +
 * subscription state and renders the right call-to-action per platform state.
 * Hidden entirely on browsers that don't support push.
 */
function ZHQPushPrompt({ compact }) {
  const DS = window.ZittingHQDesignSystem_c9e528;
  const { Card, Button, Icon, Badge } = DS;
  const PUSH = window.ZHQ_PUSH;
  const [status, setStatus] = React.useState('loading');
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(() => {
    if (!PUSH) { setStatus('unsupported'); return; }
    PUSH.status().then(setStatus).catch(() => setStatus('unsupported'));
  }, [PUSH]);
  React.useEffect(() => { refresh(); }, [refresh]);

  if (status === 'loading' || status === 'unsupported') return null;

  const enable = async () => { setBusy(true); try { await PUSH.enable(); } finally { setBusy(false); refresh(); } };
  const disable = async () => { setBusy(true); try { await PUSH.disable(); } finally { setBusy(false); refresh(); } };

  const wrap = (children) => (
    <Card padding={compact ? 4 : 5} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 38, height: 38, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
        <Icon name="bell" size={18} />
      </span>
      {children}
    </Card>
  );

  if (status === 'subscribed') {
    return wrap(
      <>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Phone notifications <Badge tone="positive" size="sm">On</Badge>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>This device will get alerts even when the app is closed.</div>
        </div>
        <Button variant="ghost" size="sm" disabled={busy} onClick={disable}>Turn off</Button>
      </>
    );
  }

  if (status === 'ios-needs-install') {
    return wrap(
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Get alerts on your iPhone</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
          Tap the <b>Share</b> icon, choose <b>Add to Home Screen</b>, then open Family HQ from your home screen and turn on notifications there.
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return wrap(
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Notifications are blocked</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
          Allow notifications for Family HQ in your browser or phone settings, then come back and enable them here.
        </div>
      </div>
    );
  }

  // 'default' — not yet subscribed
  return wrap(
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Get alerts on your phone</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>New transactions, large charges, and reminders — pushed to this device.</div>
      </div>
      <Button variant="accent" size="sm" disabled={busy} onClick={enable}>{busy ? 'Enabling…' : 'Enable'}</Button>
    </>
  );
}

Object.assign(window, { ZHQPushPrompt });
