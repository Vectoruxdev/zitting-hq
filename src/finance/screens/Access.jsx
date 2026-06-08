import React from 'react';
/* Access Admin — manage a member's permissions matrix + invite. */
function ZHQPermRow({ row, last }) {
  const { Toggle, Icon } = window.ZittingHQDesignSystem_c9e528;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', alignItems: 'center', padding: '13px 16px', borderBottom: last ? 'none' : '1px solid var(--border-hairline)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: 'var(--text-primary)' }}>
        {row.locked ? <Icon name="eye" size={14} style={{ color: 'var(--text-tertiary)' }} /> : null}{row.name}
      </span>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle defaultChecked={row.view} size="sm" disabled={row.locked} /></div>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle defaultChecked={row.edit} size="sm" disabled={row.locked} /></div>
    </div>
  );
}

function ZHQAccess() {
  const { Card, Button, Icon, Avatar, Badge } = window.ZittingHQDesignSystem_c9e528;
  const P = window.ZHQ_DATA.permissions;
  const members = [{ name: 'Sarah', role: 'Member', on: true }, { name: 'Rebecca', role: 'Member' }, { name: 'Caleb', role: 'Teen' }];

  const Matrix = ({ title, rows }) => (
    <Card padding={6}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '12px 16px 10px', borderBottom: '1px solid var(--border-hairline)' }}>
        <span className="zt-eyebrow">{title}</span>
        <span className="zt-eyebrow" style={{ textAlign: 'center' }}>View</span>
        <span className="zt-eyebrow" style={{ textAlign: 'center' }}>Edit</span>
      </div>
      {rows.map((r, i) => <ZHQPermRow key={r.name} row={r} last={i === rows.length - 1} />)}
    </Card>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 22, alignItems: 'start' }}>
      <Card padding={14}>
        <div className="zt-eyebrow" style={{ padding: '4px 8px 12px' }}>Family members</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {members.map((m) => (
            <button key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: m.on ? 'var(--surface-raised)' : 'transparent', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
              <Avatar name={m.name} size="sm" />
              <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: m.on ? 600 : 500, color: 'var(--text-primary)' }}>{m.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{m.role}</div></div>
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" full iconLeft={<Icon name="plus" size={14} />} style={{ marginTop: 12 }}>Invite member</Button>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name="Sarah" size="lg" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)' }}>Sarah Zitting</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>sarah@zitting.family · Member</div>
          </div>
          <Badge tone="positive" dot>Active</Badge>
        </div>

        <Matrix title="Finance areas" rows={P.areas} />
        <Matrix title="Accounts" rows={P.accounts} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="ghost">Reset</Button>
          <Button variant="primary">Save permissions</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ZHQAccess });
