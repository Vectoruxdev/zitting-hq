import React from 'react';

/* Email digests — owner overview + per-member spending summaries, on a shared
 * weekly/biweekly/monthly cadence. Owner-gated writes via window.ZHQ_API. */
function ZHQEmailDigestCard() {
  const { Card, Button, Icon, Toggle, SegmentedControl } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA || {};
  const API = window.ZHQ_API || {};
  const dg = D.digest || {};
  const members = (D.members || []).filter((m) => m.role === 'member');
  const [testState, setTestState] = React.useState(null); // null | sending | sent | skipped | error

  const update = (patch) => { if (API.updateDigestSettings) API.updateDigestSettings(patch).then(() => window.ZHQ_REFRESH && window.ZHQ_REFRESH()); };
  const toggleMember = (id, on) => { if (API.setMemberDigestOptIn) API.setMemberDigestOptIn(id, on).then(() => window.ZHQ_REFRESH && window.ZHQ_REFRESH()); };
  const sendTest = async () => {
    if (!API.sendDigestTest) return;
    setTestState('sending');
    try { const r = await API.sendDigestTest(); setTestState(r && r.ok ? 'sent' : (r && r.skipped ? 'skipped' : 'error')); }
    catch { setTestState('error'); }
  };
  const cadenceOpts = [{ value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Biweekly' }, { value: 'monthly', label: 'Monthly' }];
  const on = dg.enabled !== false;

  return (
    <Card padding={20}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Email digests</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>A spending recap by email — a household overview for you, a personal summary for each member.</div>
        </div>
        <Toggle checked={on} onChange={(v) => update({ enabled: v })} />
      </div>

      {on ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          {!dg.emailConfigured ? (
            <div style={{ fontSize: 12.5, color: 'var(--warning)', background: 'var(--warning-soft)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', lineHeight: 1.5 }}>
              Connect Resend (set <span className="zt-num">RESEND_API_KEY</span> + verify your sending domain) to start delivering these.
            </div>
          ) : null}

          <div>
            <div className="zt-eyebrow" style={{ marginBottom: 7 }}>How often</div>
            <SegmentedControl full value={dg.cadence || 'monthly'} onChange={(v) => update({ cadence: v })} options={cadenceOpts} />
            {dg.nextRunLabel ? <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>{dg.nextRunLabel}</div> : null}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13.5, color: 'var(--text-secondary)' }}>
            Email me the household overview
            <Toggle checked={dg.ownerEnabled !== false} onChange={(v) => update({ ownerEnabled: v })} size="sm" />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13.5, color: 'var(--text-secondary)' }}>
            Email members their own summaries
            <Toggle checked={dg.membersEnabled !== false} onChange={(v) => update({ membersEnabled: v })} size="sm" />
          </label>

          {dg.membersEnabled !== false && members.length ? (
            <div>
              <div className="zt-eyebrow" style={{ marginBottom: 4 }}>Members</div>
              {members.map((m, i) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: i === members.length - 1 ? 'none' : '1px solid var(--border-hairline)' }}>
                  <span style={{ fontSize: 13.5, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}{m.email ? <span style={{ color: 'var(--text-tertiary)' }}> · {m.email}</span> : <span style={{ color: 'var(--warning)' }}> · no email</span>}
                  </span>
                  <Toggle checked={m.digestOptIn !== false} onChange={(v) => toggleMember(m.id, v)} size="sm" disabled={!m.email} />
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" iconLeft={<Icon name="bell" size={14} />} onClick={sendTest} disabled={testState === 'sending'}>Send me a test</Button>
            {testState === 'sent' ? <span style={{ fontSize: 12.5, color: 'var(--accent)' }}>Sent ✓</span> : null}
            {testState === 'skipped' ? <span style={{ fontSize: 12.5, color: 'var(--warning)' }}>Email not configured yet</span> : null}
            {testState === 'error' ? <span style={{ fontSize: 12.5, color: 'var(--negative)' }}>Couldn’t send</span> : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

/* Notifications — alert feed + rule settings. */
function ZHQNotifications({ onNavigate }) {
  const { Card, Button, Icon, Badge, Toggle, Tabs, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API;
  const [tab, setTab] = React.useState('feed');
  const [busy, setBusy] = React.useState(false);
  const notifications = D.notifications || [];
  const notifPrefs = D.notifPrefs || [];
  const unread = notifications.filter((n) => n.unread).length;

  const setPref = (event, patch) => {
    if (!API.setNotificationPref) return;
    API.setNotificationPref(event, patch).then(() => window.ZHQ_REFRESH && window.ZHQ_REFRESH());
  };
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
        <Tabs options={[{ value: 'feed', label: 'Alerts', badge: unread || undefined }, { value: 'rules', label: 'Settings' }]} value={tab} onChange={setTab} style={{ flex: 1 }} />
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
        <>
        <ZHQEmailDigestCard />
        {!notifPrefs.length ? (
          <EmptyState icon="settings" title="Notification settings" body="Choose which events notify your household and where. Settings appear once notifications are set up." />
        ) : (
        <>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Choose which events send alerts, and whether they show in the bell, on phones, or both.
        </p>
        <Card padding={6}>
          {notifPrefs.map((p, i) => (
            <div key={p.event} style={{ padding: '15px 16px', borderBottom: i === notifPrefs.length - 1 ? 'none' : '1px solid var(--border-hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</span>
                    <Badge tone="neutral" size="sm">{p.audience === 'members' ? 'Members' : 'You'}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{p.detail}</div>
                </div>
                <Toggle checked={p.enabled} onChange={(v) => setPref(p.event, { enabled: v })} size="sm" />
              </div>
              {p.enabled ? (
                <div style={{ display: 'flex', gap: 22, marginTop: 12, paddingLeft: 2 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <Toggle checked={p.inApp} onChange={(v) => setPref(p.event, { inApp: v })} size="sm" />
                    In-app bell
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <Toggle checked={p.push} onChange={(v) => setPref(p.event, { push: v })} size="sm" />
                    Phone push
                  </label>
                </div>
              ) : null}
            </div>
          ))}
        </Card>
        </>
        )}
        </>
      )}
    </div>
  );
}

Object.assign(window, { ZHQNotifications });
