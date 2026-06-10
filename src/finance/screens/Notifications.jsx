import React from 'react';
/* Notifications — alert feed + rule settings. */
function ZHQNotifications({ onNavigate }) {
  const { Card, Button, Icon, Badge, Toggle, Tabs, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API;
  const [tab, setTab] = React.useState('feed');
  const [busy, setBusy] = React.useState(false);
  const notifications = D.notifications || [];
  const notifRules = D.notifRules || [];
  const unread = notifications.filter((n) => n.unread).length;
  const toneColor = { accent: 'var(--accent)', warning: 'var(--warning)', negative: 'var(--negative)', info: 'var(--indigo-400)' };
  const toneBg = { accent: 'var(--accent-soft)', warning: 'var(--warning-soft)', negative: 'var(--negative-soft)', info: 'var(--indigo-tint)' };

  const markAllRead = async () => {
    if (busy || !API) return;
    setBusy(true);
    try {
      await API.markNotificationsRead();
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
    } finally {
      setBusy(false);
    }
  };

  const openNotif = async (n) => {
    // Mark this one read (skip synthetic string-id derived alerts), then deep-link.
    if (API && n.unread && typeof n.id === 'number') {
      API.markNotificationsRead([n.id]).then(() => window.ZHQ_REFRESH && window.ZHQ_REFRESH());
    }
    const dest = n.linkTo || (n.type === 'transfers' ? 'transfers' : null);
    if (dest && onNavigate) onNavigate(dest);
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Tabs options={[{ value: 'feed', label: 'Alerts', badge: unread || undefined }, { value: 'rules', label: 'Rules' }]} value={tab} onChange={setTab} style={{ flex: 1 }} />
        {tab === 'feed' && unread ? <Button variant="ghost" size="sm" disabled={busy} onClick={markAllRead}>Mark all read</Button> : null}
      </div>

      {tab === 'feed' ? (
        <>
        {window.ZHQPushPrompt ? <window.ZHQPushPrompt /> : null}
        {!notifications.length ? (
          <EmptyState icon="bell" title="No alerts" body="You're all caught up. Alerts about large charges, new subscriptions, and overspending will show up here." />
        ) : (
        <Card padding={6}>
          {notifications.map((n, i) => (
            <div key={n.id} onClick={() => openNotif(n)} style={{ display: 'flex', gap: 14, padding: '15px 16px', cursor: (n.linkTo || n.type === 'transfers' || n.unread) ? 'pointer' : 'default', borderBottom: i === notifications.length - 1 ? 'none' : '1px solid var(--border-hairline)', background: n.unread ? 'var(--surface-hover)' : 'transparent', borderRadius: n.unread ? 'var(--radius-sm)' : 0 }}>
              <span style={{ width: 38, height: 38, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: toneBg[n.tone], color: toneColor[n.tone] }}><Icon name={n.icon} size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
                  {n.unread ? <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--accent)' }} /> : null}
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-tertiary)' }}>{n.time}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>{n.body}</div>
                {n.type === 'transfers' ? <Button variant="accent" size="sm" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('transfers'); }}>Review transfers</Button> : null}
              </div>
            </div>
          ))}
        </Card>
        )}
        </>
      ) : (
        !notifRules.length ? (
          <EmptyState icon="settings" title="No alert rules yet" body="Create rules to get notified about large charges, new subscriptions, or overspending. Rule settings are coming soon." />
        ) : (
        <Card padding={6}>
          {notifRules.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 16px', borderBottom: i === notifRules.length - 1 ? 'none' : '1px solid var(--border-hairline)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{r.detail}</div>
              </div>
              <Badge tone="neutral" size="sm">{r.channels}</Badge>
              <Toggle defaultChecked={r.on} size="sm" />
            </div>
          ))}
        </Card>
        )
      )}
    </div>
  );
}

Object.assign(window, { ZHQNotifications });
