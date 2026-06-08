import React from 'react';
import { Icon } from '../core/Icon.jsx';

/**
 * DataTable — the transactions/bills workhorse. `columns` is
 * [{ key, header, align, width, sortable, render(row) }]; `rows` is your data.
 * Quiet hairline rows, hover highlight, optional sortable headers (cosmetic),
 * pending rows can dim via row.muted. Cells render custom nodes (Tag, Avatar,
 * amounts) via the column `render`.
 */
export function DataTable({
  columns = [],
  rows = [],
  rowKey = 'id',
  onRowClick,
  sortKey,
  sortDir = 'desc',
  onSort,
  dense = false,
  style,
  ...rest
}) {
  const padY = dense ? 10 : 14;
  return (
    <div style={{ width: '100%', overflowX: 'auto', ...style }} {...rest}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sortKey === c.key;
              return (
                <th
                  key={c.key}
                  onClick={c.sortable && onSort ? () => onSort(c.key) : undefined}
                  style={{
                    textAlign: c.align || 'left',
                    padding: `0 14px 11px`,
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: active ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    width: c.width,
                    cursor: c.sortable && onSort ? 'pointer' : 'default',
                    borderBottom: '1px solid var(--border-hairline)',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexDirection: c.align === 'right' ? 'row-reverse' : 'row' }}>
                    {c.header}
                    {c.sortable ? (
                      <Icon name="chevronDown" size={12} style={{ opacity: active ? 1 : 0.3, transform: active && sortDir === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-fast)' }} />
                    ) : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row[rowKey] ?? ri}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className="zt-table-row"
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                opacity: row.muted ? 0.55 : 1,
                transition: 'background var(--dur-fast) var(--ease-out)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {columns.map((c, ci) => (
                <td
                  key={c.key}
                  style={{
                    textAlign: c.align || 'left',
                    padding: `${padY}px 14px`,
                    fontSize: 13.5,
                    color: 'var(--text-primary)',
                    borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--border-hairline)',
                    borderTopLeftRadius: ci === 0 ? 10 : 0,
                    whiteSpace: c.wrap ? 'normal' : 'nowrap',
                    verticalAlign: 'middle',
                  }}
                >
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** AmountCell — right-aligned mono currency; income (positive) shows green. */
export function AmountCell({ value, income = false, cents = true }) {
  const neg = value < 0;
  const abs = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  const color = income ? 'var(--positive)' : 'var(--text-primary)';
  return (
    <span className="zt-num" style={{ fontSize: 13.5, fontWeight: 500, color, letterSpacing: '-0.01em' }}>
      {income ? '+' : neg ? '−' : ''}${abs}
    </span>
  );
}
