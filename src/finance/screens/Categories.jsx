import React from 'react';
/* Categories — manage the taxonomy (parent categories → subcategories) +
 * auto-categorize rules. Parents are category_groups; subcategories are the
 * actual categories transactions/budgets attach to. */

const SWATCHES = [
  'var(--green-500)', 'var(--green-400)', 'var(--green-600)',
  'var(--indigo-500)', 'var(--indigo-400)', 'var(--amber-500)',
  'var(--amber-600)', 'var(--gray-500)', 'var(--red-500)',
];
const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Parent groups that hold a system subcategory (transfer / uncategorized).
const PROTECTED_GROUPS = new Set(['transfers', 'other']);
const PROTECTED_CATS = new Set(['uncategorized', 'transfer']);

// ---- Parent category (group) modal ----------------------------------------
function GroupModal({ open, onClose, editing }) {
  const { Modal, TextInput, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const groups = (window.ZHQ_DATA.categoryGroups) || [];
  const existingIds = new Set(groups.map((g) => g.id));
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name || ''); setBusy(false);
  }, [open, editing]);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (editing && API.updateCategoryGroup) {
        await API.updateCategoryGroup(editing.id, { name: name.trim() });
      } else if (API.createCategoryGroup) {
        let id = slug(name) || 'category'; let i = 2;
        while (existingIds.has(id)) id = `${slug(name)}-${i++}`;
        await API.createCategoryGroup({ id, name: name.trim() });
      }
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Rename category' : 'New category'} width={400}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !name.trim()}>{editing ? 'Save' : 'Create'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextInput label="Category name" value={name} onChange={setName} placeholder="Automobile" />
        {!editing ? <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>You'll add subcategories to it next.</span> : null}
      </div>
    </Modal>
  );
}

// ---- Subcategory (category) modal -----------------------------------------
function CategoryModal({ open, onClose, editing, presetGroupId }) {
  const { Modal, TextInput, Select, Toggle, Button } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API || {};
  const groups = D.categoryGroups || [];
  const existingIds = new Set((D.allCategories || []).map((c) => c.id));

  const [name, setName] = React.useState('');
  const [groupId, setGroupId] = React.useState(groups[0]?.id || '');
  const [kind, setKind] = React.useState('expense');
  const [color, setColor] = React.useState(SWATCHES[0]);
  const [exclude, setExclude] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name); setGroupId(editing.groupId || groups[0]?.id || '');
      setKind(editing.kind || 'expense'); setColor(editing.color || SWATCHES[0]);
      setExclude(!!editing.excludeFromBudget);
    } else {
      setName(''); setGroupId(presetGroupId || groups[0]?.id || ''); setKind('expense'); setColor(SWATCHES[0]); setExclude(false);
    }
    setBusy(false);
  }, [editing, open, presetGroupId]);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (editing) {
        await API.updateCategory(editing.id, { name: name.trim(), groupId, kind, color, excludeFromBudget: exclude });
      } else {
        let id = slug(name); let i = 2;
        while (existingIds.has(id)) id = `${slug(name)}-${i++}`;
        await API.createCategory({ id, name: name.trim(), groupId, kind, color, excludeFromBudget: exclude });
      }
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit subcategory' : 'New subcategory'} width={420}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !name.trim()}>{editing ? 'Save' : 'Create'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TextInput label="Name" value={name} onChange={setName} placeholder="Fuel" />
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2)', gap: 12 }}>
          <Select label="Category (parent)" value={groupId} onChange={setGroupId} options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          <Select label="Kind" value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'transfer', label: 'Transfer' }]} />
        </div>
        <div>
          <span className="zt-eyebrow" style={{ display: 'block', marginBottom: 8 }}>Color</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SWATCHES.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: 999, background: c, border: color === c ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </div>
        </div>
        <Toggle label="Exclude from budgets/spending" checked={exclude} onChange={setExclude} />
      </div>
    </Modal>
  );
}

function RuleModal({ open, onClose }) {
  const { Modal, TextInput, Select, Button } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API || {};
  const cats = D.allCategories || [];
  const members = D.members || [];
  const [field, setField] = React.useState('merchant');
  const [matchType, setMatchType] = React.useState('contains');
  const [matchValue, setMatchValue] = React.useState('');
  const [categoryId, setCategoryId] = React.useState(cats[0]?.id || '');
  const [member, setMember] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function save() {
    if (!matchValue.trim() || !categoryId) return;
    setBusy(true);
    try {
      await API.createRule({ field, matchType, matchValue: matchValue.trim(), categoryId, member: member || null, priority: 50 });
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      setMatchValue(''); onClose();
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="New rule" width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !matchValue.trim()}>Create rule</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2)', gap: 12 }}>
          <Select label="When" value={field} onChange={setField} options={[{ value: 'merchant', label: 'Description' }, { value: 'account', label: 'Account' }, { value: 'amount', label: 'Amount' }]} />
          <Select label="Match" value={matchType} onChange={setMatchType} options={[{ value: 'contains', label: 'contains' }, { value: 'exact', label: 'is exactly' }, { value: 'regex', label: 'regex' }]} />
        </div>
        <TextInput label="Value" value={matchValue} onChange={setMatchValue} placeholder="netflix" />
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2)', gap: 12 }}>
          <Select label="Set category" value={categoryId} onChange={setCategoryId} options={cats.map((c) => ({ value: c.id, label: c.name }))} />
          <Select label="Set person (optional)" value={member} onChange={setMember} options={[{ value: '', label: '— none —' }, ...members.map((m) => ({ value: m.id, label: m.name }))]} />
        </div>
      </div>
    </Modal>
  );
}

function ZHQCategories() {
  const { Card, Button, Icon, Tag, Tabs, Toggle, Badge, IconButton } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API || {};
  const groups = D.categoryGroups || [];
  const cats = D.allCategories || [];
  const rules = D.catRules || [];

  const [tab, setTab] = React.useState('Categories');
  const [groupModal, setGroupModal] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState(null);
  const [catModal, setCatModal] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [presetGroupId, setPresetGroupId] = React.useState(null);
  const [ruleModal, setRuleModal] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const refresh = () => window.ZHQ_REFRESH && window.ZHQ_REFRESH();

  const openNewGroup = () => { setEditingGroup(null); setGroupModal(true); };
  const openEditGroup = (g) => { setEditingGroup(g); setGroupModal(true); };
  async function delGroup(g) {
    if (PROTECTED_GROUPS.has(g.id)) return;
    if (!window.confirm(`Delete the "${g.name}" category? Its subcategories move to Other.`)) return;
    await API.deleteCategoryGroup(g.id); refresh();
  }
  const openNewSub = (gid) => { setEditing(null); setPresetGroupId(gid); setCatModal(true); };
  const openEditSub = (c) => { setEditing(c); setPresetGroupId(null); setCatModal(true); };
  async function delSub(c) {
    if (PROTECTED_CATS.has(c.id)) return;
    if (!window.confirm(`Delete "${c.name}"? Its transactions move to Uncategorized.`)) return;
    await API.deleteCategory(c.id); refresh();
  }

  async function autoCategorize() {
    setMsg('Auto-categorizing…');
    const res = await API.recategorizeAll({ onlyUnreviewed: true });
    refresh();
    setMsg(`Auto-categorized ${res?.updated ?? 0} unreviewed transaction(s).`);
  }
  async function rebuildMemory() {
    setMsg('Learning from history…');
    const res = await API.rebuildMemoryFromHistory();
    refresh();
    setMsg(`Learned from ${res?.learned ?? 0} reviewed transaction(s).`);
  }
  async function toggleRule(r) { await API.updateRule(r.id, { enabled: !r.enabled }); refresh(); }
  async function delRule(r) { await API.deleteRule(r.id); refresh(); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Tabs options={['Categories', 'Rules']} value={tab} onChange={setTab} />
        <span style={{ flex: 1 }} />
        {tab === 'Categories'
          ? <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={15} />} onClick={openNewGroup}>New category</Button>
          : <>
              <Button variant="ghost" size="sm" onClick={rebuildMemory}>Rebuild memory</Button>
              <Button variant="secondary" size="sm" onClick={autoCategorize}>Auto-categorize all</Button>
              <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={15} />} onClick={() => setRuleModal(true)}>New rule</Button>
            </>}
      </div>

      {tab === 'Categories' ? (
        groups.length ? groups.map((g) => {
          const list = cats.filter((c) => c.groupId === g.id);
          const locked = PROTECTED_GROUPS.has(g.id);
          return (
            <div key={g.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="zt-eyebrow">{g.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{list.length}</span>
                <IconButton icon="pencil" size="sm" label="Rename category" onClick={() => openEditGroup(g)} />
                {!locked ? <IconButton icon="x" size="sm" label="Delete category" onClick={() => delGroup(g)} /> : null}
                <span style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
                <Button variant="ghost" size="sm" iconLeft={<Icon name="plus" size={14} />} onClick={() => openNewSub(g.id)}>Subcategory</Button>
              </div>
              <Card padding={6}>
                {list.length ? list.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--border-hairline)' }}>
                    <span style={{ width: 11, height: 11, borderRadius: 999, background: c.color, flex: 'none' }} />
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</span>
                    {c.kind !== 'expense' ? <Badge tone="neutral" size="sm">{c.kind}</Badge> : null}
                    {c.excludeFromBudget ? <Badge tone="neutral" size="sm">excluded</Badge> : null}
                    <span style={{ flex: 1 }} />
                    <button onClick={() => openEditSub(c)} className="zhq-rowbtn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', padding: 4 }}><Icon name="pencil" size={15} /></button>
                    {!PROTECTED_CATS.has(c.id) ? <button onClick={() => delSub(c)} className="zhq-rowbtn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', padding: 4 }}><Icon name="x" size={15} /></button> : null}
                  </div>
                )) : (
                  <button onClick={() => openNewSub(g.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', font: 'inherit', fontSize: 13 }}>
                    <Icon name="plus" size={14} /> Add a subcategory
                  </button>
                )}
              </Card>
            </div>
          );
        }) : (
          <Card padding={28}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>No categories yet. Create one to get started.</p>
          </Card>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {msg ? <div style={{ fontSize: 13, color: 'var(--accent)' }}>{msg}</div> : null}
          {!rules.length ? (
            <Card padding={28}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
                No rules yet. Rules auto-assign categories on import and are learned when you recategorize a transaction. Create one to get started.
              </p>
            </Card>
          ) : (
            <Card padding={6}>
              {rules.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderBottom: '1px solid var(--border-hairline)' }}>
                  <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
                    If <b style={{ color: 'var(--text-primary)' }}>{r.field}</b> {r.matchType} <b style={{ color: 'var(--text-primary)' }}>“{r.matchValue}”</b> →
                  </span>
                  <Tag size="sm">{r.categoryName || r.categoryId}</Tag>
                  {r.member ? <Badge tone="neutral" size="sm">{r.member}</Badge> : null}
                  {r.source === 'learned' ? <Badge tone="neutral" size="sm">learned</Badge> : null}
                  <span style={{ flex: 1 }} />
                  <Toggle checked={r.enabled} onChange={() => toggleRule(r)} size="sm" />
                  <button onClick={() => delRule(r)} className="zhq-rowbtn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', padding: 4 }}><Icon name="x" size={15} /></button>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      <GroupModal open={groupModal} onClose={() => setGroupModal(false)} editing={editingGroup} />
      <CategoryModal open={catModal} onClose={() => setCatModal(false)} editing={editing} presetGroupId={presetGroupId} />
      <RuleModal open={ruleModal} onClose={() => setRuleModal(false)} />
    </div>
  );
}

Object.assign(window, { ZHQCategories });
