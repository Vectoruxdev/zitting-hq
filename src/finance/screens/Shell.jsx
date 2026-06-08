import React from 'react';
/* Shell — sidebar + topbar layout for the Zitting Finance desktop app. */
function ZHQSidebar({ active, onNavigate }) {
  const { Icon, Avatar } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  return (
    <aside style={{
      width: 'var(--sidebar-w)', flex: 'none', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-app)', borderRight: '1px solid var(--border-hairline)',
      padding: '18px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 18px' }}>
        <img src="/finance/mark.svg" width="30" height="30" alt="" style={{ borderRadius: 9 }} />
        <span className="zt-wordmark" style={{ fontSize: 20, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Zitting <span style={{ color: 'var(--accent)' }}>HQ</span></span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
        {D.nav.map((item) => {
          const on = item.id === active;
          return (
            <button key={item.id} className="zhq-nav-item" data-active={on ? 'true' : 'false'} onClick={() => onNavigate && onNavigate(item.id)}>
              <Icon name={item.icon} size={18} className="zhq-nav-icon" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button className="zhq-nav-item" data-active="false" onClick={() => onNavigate && onNavigate('member')}>
          <Icon name="eye" size={18} className="zhq-nav-icon" /> View as member
        </button>
        <button className="zhq-nav-item" data-active={active === 'settings' ? 'true' : 'false'} onClick={() => onNavigate && onNavigate('settings')}>
          <Icon name="settings" size={18} className="zhq-nav-icon" /> Settings
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px' }}>
          <Avatar name="Jared" size="sm" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Jared</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Owner</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ZHQTopbar({ title, onNavigate }) {
  const { Icon, IconButton, SegmentedControl } = window.ZittingHQDesignSystem_c9e528;
  const [theme, setTheme] = React.useState((typeof window !== 'undefined' && window.__zhqTheme) || 'dark');
  const toggleTheme = () => {
    const t = theme === 'light' ? 'dark' : 'light';
    window.__zhqSetTheme && window.__zhqSetTheme(t);
    setTheme(t);
  };
  return (
    <header style={{
      height: 'var(--topbar-h)', flex: 'none',
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 26px', borderBottom: '1px solid var(--border-hairline)',
    }}>
      <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{title}</h1>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 14px 0 12px', background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-pill)', color: 'var(--text-tertiary)', minWidth: 200 }}>
        <Icon name="search" size={16} />
        <span style={{ fontSize: 13 }}>Search transactions…</span>
      </div>
      <SegmentedControl options={['This month', 'Last month', 'Custom']} defaultValue="This month" size="sm" />
      <IconButton icon={theme === 'light' ? 'moon' : 'sun'} label="Toggle theme" variant="solid" onClick={toggleTheme} />
      <div style={{ position: 'relative' }}>
        <IconButton icon="bell" label="Notifications" variant="solid" onClick={() => onNavigate && onNavigate('notifications')} />
        <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-on-accent)', background: 'var(--accent)', borderRadius: 999, border: '2px solid var(--bg-app)' }}>3</span>
      </div>
    </header>
  );
}

function ZHQShell({ active, onNavigate, title, children, loading }) {
  const { LoadingBar } = window.ZittingHQDesignSystem_c9e528;
  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-app)' }}>
      <ZHQSidebar active={active} onNavigate={onNavigate} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ZHQTopbar title={title} onNavigate={onNavigate} />
        <div style={{ height: 2, flex: 'none' }}>{loading && LoadingBar ? <LoadingBar /> : null}</div>
        <main style={{ flex: 1, overflowY: 'auto', padding: '26px' }}>
          <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { ZHQSidebar, ZHQTopbar, ZHQShell });
