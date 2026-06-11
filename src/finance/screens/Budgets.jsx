import React from 'react';
/* Budgets — personal allowances + shared category budgets.
 * Spent is derived server-side from the current month's transactions
 * (getFinanceData); this screen just renders + provides the add/edit/delete
 * workflow via window.ZHQ_API. */

function ZHQBudgetActions({ onEdit, onDelete }) {
  const { IconButton } = window.ZittingHQDesignSystem_c9e528;
  return (
    <span style={{ display: 'inline-flex', gap: 2, flex: 'none' }}>
      <IconButton icon="pencil" size="sm" label="Edit budget" onClick={onEdit} />
      <IconButton icon="x" size="sm" label="Remove budget" onClick={onDelete} />
    </span>
  );
}

function ZHQAllowanceCard({ b, onEdit, onDelete }) {
  const { Card, Avatar, ProgressBar } = window.ZittingHQDesignSystem_c9e528;
  const left = b.limit - b.spent;
  const over = left < 0;
  const near = !over && b.limit > 0 && left / b.limit <= 0.15;
  return (
    <Card padding={20}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
        <Avatar name={b.who} size="md" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{b.who}</div>
          <div className="zt-num" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>${b.limit.toLocaleString()}/mo</div>
        </div>
        <ZHQBudgetActions onEdit={() => onEdit(b)} onDelete={() => onDelete(b)} />
      </div>
      <div className="zt-eyebrow" style={{ marginBottom: 7 }}>{over ? 'Over by' : 'Remaining'}</div>
      <div className="zt-num" style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', color: over ? 'var(--negative)' : near ? 'var(--warning)' : 'var(--accent)' }}>{over ? '−' : ''}${Math.abs(left).toLocaleString()}</div>
      <div style={{ margin: '16px 0 9px' }}><ProgressBar value={b.spent} max={b.limit} /></div>
      <div className="zt-num" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>${b.spent.toLocaleString()} spent of ${b.limit.toLocaleString()}</div>
    </Card>
  );
}

function ZHQBudgetModal({ open, onClose, editing }) {
  const { Modal, Select, TextInput, SegmentedControl, Button } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA;
  const members = D.members || [];
  const allCats = (D.allCategories || []).filter((c) => c.kind !== 'income' && c.kind !== 'transfer' && !c.excludeFromBudget);
  const budgets = D.budgets || [];

  const initialKind = editing ? (editing.memberId ? 'allowance' : 'category') : 'allowance';
  const [kind, setKind] = React.useState(initialKind);
  const [memberId, setMemberId] = React.useState(editing?.memberId || '');
  const [categoryId, setCategoryId] = React.useState(editing?.categoryId || '');
  const [limit, setLimit] = React.useState(editing ? String(editing.limit) : '');
  const [busy, setBusy] = React.useState(false);

  // (Re)seed the form whenever the modal opens or the target budget changes.
  React.useEffect(() => {
    if (!open) return;
    setKind(editing ? (editing.memberId ? 'allowance' : 'category') : 'allowance');
    setMemberId(editing?.memberId || '');
    setCategoryId(editing?.categoryId || '');
    setLimit(editing ? String(editing.limit) : '');
    setBusy(false);
  }, [open, editing]);

  // Don't offer people/categories that already have a budget (except the one
  // being edited).
  const usedMembers = new Set(budgets.filter((b) => b.memberId && b.id !== editing?.id).map((b) => b.memberId));
  const usedCats = new Set(budgets.filter((b) => b.categoryId && b.id !== editing?.id).map((b) => b.categoryId));
  const memberOpts = members.filter((m) => !usedMembers.has(m.id)).map((m) => ({ value: m.id, label: m.name }));
  const catOpts = allCats.filter((c) => !usedCats.has(c.id)).map((c) => ({ value: c.id, label: c.name }));

  const lim = parseFloat(limit);
  const target = kind === 'allowance' ? memberId : categoryId;
  const valid = !!target && Number.isFinite(lim) && lim > 0;

  async function save() {
    if (!valid) return;
    const payload = {
      kind,
      memberId: kind === 'allowance' ? memberId : null,
      categoryId: kind === 'category' ? categoryId : null,
      limit: lim,
    };
    setBusy(true);
    try {
      if (editing && API.updateBudget) await API.updateBudget(editing.id, payload);
      else if (API.createBudget) await API.createBudget(payload);
      window.ZHQ_REFRESH && window.ZHQ_REFRESH();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit budget' : 'New budget'} width={440}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy || !valid}>{editing ? 'Save' : 'Add budget'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="zt-eyebrow" style={{ marginBottom: 7 }}>Budget type</div>
          <SegmentedControl
            full
            value={kind}
            onChange={setKind}
            options={[{ value: 'allowance', label: 'Personal allowance' }, { value: 'category', label: 'Category budget' }]}
          />
        </div>

        {kind === 'allowance' ? (
          memberOpts.length || editing ? (
            <Select label="Person" value={memberId} onChange={setMemberId} placeholder="Choose a person"
              options={editing && editing.memberId && !memberOpts.find((o) => o.value === memberId)
                ? [{ value: editing.memberId, label: editing.who || 'Current' }, ...memberOpts]
                : memberOpts} />
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Everyone already has an allowance. Add people on the Access screen first.</p>
          )
        ) : (
          catOpts.length || editing ? (
            <Select label="Category" value={categoryId} onChange={setCategoryId} placeholder="Choose a category"
              options={editing && editing.categoryId && !catOpts.find((o) => o.value === categoryId)
                ? [{ value: editing.categoryId, label: editing.name || 'Current' }, ...catOpts]
                : catOpts} />
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Every category already has a budget. Add categories on the Categories screen first.</p>
          )
        )}

        <TextInput label="Monthly limit" value={limit} onChange={setLimit} prefix="$" type="number" inputMode="decimal" placeholder="500" />
      </div>
    </Modal>
  );
}

function ZHQBudgets() {
  const { Card, Icon, Button, BudgetRow, EmptyState } = window.ZittingHQDesignSystem_c9e528;
  const API = window.ZHQ_API || {};
  const D = window.ZHQ_DATA;
  const budgets = D.budgets || [];
  const allowances = budgets.filter((b) => b.who);
  const shared = budgets.filter((b) => !b.who);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (b) => { setEditing(b); setModalOpen(true); };
  async function remove(b) {
    if (!API.deleteBudget) return;
    if (typeof window !== 'undefined' && !window.confirm(`Remove the ${b.name} budget?`)) return;
    await API.deleteBudget(b.id);
    window.ZHQ_REFRESH && window.ZHQ_REFRESH();
  }

  const modal = <ZHQBudgetModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />;

  if (!budgets.length) {
    return (
      <>
        <EmptyState
          icon="pie"
          title="No budgets yet"
          body="Set a monthly spending limit for a person (an allowance) or a category. Spending is pulled automatically from your transactions."
          actionLabel="New budget"
          onAction={openAdd}
        />
        {modal}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)' }}>Spending updates automatically from your transactions each month.</p>
        <Button variant="primary" iconLeft={<Icon name="plus" size={16} />} onClick={openAdd} style={{ flex: 'none' }}>New budget</Button>
      </div>

      {allowances.length ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="zt-eyebrow">Personal allowances</span><span style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-3)', gap: 14 }}>
            {allowances.map((b, i) => <ZHQAllowanceCard key={b.id ?? i} b={b} onEdit={openEdit} onDelete={remove} />)}
          </div>
        </div>
      ) : null}

      {shared.length ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="zt-eyebrow">Shared household budgets</span><span style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
          </div>
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2)', gap: '20px 36px' }}>
              {shared.map((b, i) => {
                const left = b.limit - b.spent;
                const over = left < 0;
                const near = !over && b.limit > 0 && left / b.limit <= 0.15;
                return (
                  <BudgetRow key={b.id ?? i} name={b.name} value={b.spent} max={b.limit}
                    left={<Icon name={b.icon || 'pie'} size={15} style={{ color: 'var(--text-tertiary)' }} />}
                    right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className="zt-num" style={{ fontSize: 13.5, color: over ? 'var(--negative)' : near ? 'var(--warning)' : 'var(--text-secondary)' }}>{over ? `$${Math.abs(left).toLocaleString()} over` : `$${left.toLocaleString()} left`}</span>
                      <ZHQBudgetActions onEdit={() => openEdit(b)} onDelete={() => remove(b)} />
                    </span>}
                    caption={`$${b.spent.toLocaleString()} of $${b.limit.toLocaleString()}`} />
                );
              })}
            </div>
          </Card>
        </div>
      ) : null}

      {modal}
    </div>
  );
}

Object.assign(window, { ZHQBudgets });
