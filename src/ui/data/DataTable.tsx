"use client";
import * as React from "react";
import { Icon } from "../core/Icon";
import { useInteract, focusRing } from "../interact";

export interface DataColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  numeric?: boolean;
  align?: "left" | "right" | "center";
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string | number;
  muted?: boolean;
  wrap?: boolean;
  maxWidth?: number;
}
export interface SortState { key: string; dir: "asc" | "desc" }
export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey?: string;
  defaultSort?: SortState;
  sort?: SortState;
  onSortChange?: (s: SortState) => void;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number;
  density?: "finance" | "family";
  loading?: boolean;
  loadingRows?: number;
  empty?: React.ReactNode;
  sortValue?: (row: T, key: string) => unknown;
  style?: React.CSSProperties;
}

type AnyRow = Record<string, unknown>;
const get = <T,>(row: T, key: string): unknown => (row as unknown as AnyRow)[key];

function Th<T>({ col, sort, onSort }: { col: DataColumn<T>; sort: SortState | null; onSort: (k: string) => void }) {
  const it = useInteract(!col.sortable);
  const active = !!sort && sort.key === col.key;
  return (
    <th scope="col" aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined} style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--surface-card)", textAlign: col.align || "left", padding: "0 12px", height: 40, borderBottom: "1px solid var(--border-strong)", font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: active ? "var(--text-primary)" : "var(--text-tertiary)", whiteSpace: "nowrap", width: col.width }}>
      {col.sortable ? (
        <button type="button" onClick={() => onSort(col.key)} {...it.bind} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "transparent", color: it.hover || active ? "var(--text-primary)" : "inherit", font: "inherit", letterSpacing: "inherit", textTransform: "inherit", cursor: "pointer", padding: "4px 0", outline: "none", borderRadius: 4, ...focusRing(it.focus) }}>
          {col.label}<Icon name={active ? (sort!.dir === "asc" ? "chevron-up" : "chevron-down") : "chevrons-up-down"} size={12} style={{ opacity: active ? 1 : 0.5 }} />
        </button>
      ) : col.label}
    </th>
  );
}

function Tr<T>({ row, columns, onClick, selected, density }: { row: T; columns: DataColumn<T>[]; onClick?: (row: T) => void; selected: boolean; density: "finance" | "family" }) {
  const it = useInteract(!onClick);
  return (
    <tr
      onClick={onClick ? () => onClick(row) : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(row); } : undefined} {...(onClick ? it.bind : {})} aria-selected={selected || undefined}
      style={{ height: density === "family" ? "var(--row-h-family)" : "var(--row-h-finance)", background: selected ? "var(--accent-soft)" : it.hover ? "var(--surface-hover)" : "transparent", cursor: onClick ? "pointer" : "default", outline: "none", transition: "background-color var(--dur-fast) var(--ease-out)", ...focusRing(it.focus) }}
    >
      {columns.map((c) => (
        <td key={c.key} className={c.numeric ? "zh-money" : undefined} style={{ padding: "0 12px", borderBottom: "1px solid var(--border-hairline)", textAlign: c.align || (c.numeric ? "right" : "left"), font: c.numeric ? "var(--type-money-sm)" : "var(--type-body-sm)", fontVariantNumeric: c.numeric ? "tabular-nums" : undefined, color: c.muted ? "var(--text-secondary)" : "var(--text-primary)", whiteSpace: c.wrap ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: c.maxWidth }}>
          {c.render ? c.render(get(row, c.key), row) : (get(row, c.key) as React.ReactNode)}
        </td>
      ))}
    </tr>
  );
}

/** Data table with REAL client-side sort (never cosmetic). `sortValue(row,key)` overrides comparison. */
export function DataTable<T>({ columns = [], rows = [], rowKey = "id", defaultSort, sort: sortProp, onSortChange, onRowClick, selectedKey, density = "finance", loading = false, loadingRows = 6, empty, sortValue, style }: DataTableProps<T>) {
  const [inner, setInner] = React.useState<SortState | null>(defaultSort || null);
  const sort = sortProp ?? inner;
  const onSort = (key: string) => {
    const next: SortState = sort && sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" };
    setInner(next); onSortChange?.(next);
  };
  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const val = (r: T) => (sortValue ? sortValue(r, sort.key) : get(r, sort.key));
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true });
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, sort, sortValue]);
  const keyOf = (r: T, i: number) => { const k = get(r, rowKey); return (k as string | number | undefined) ?? i; };
  return (
    <div style={{ overflow: "auto", borderRadius: "var(--radius-card)", border: "1px solid var(--border-hairline)", background: "var(--surface-card)", boxShadow: "var(--shadow-1)", ...style }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, font: "var(--type-body-sm)" }}>
        <thead><tr>{columns.map((c) => <Th key={c.key} col={c} sort={sort} onSort={onSort} />)}</tr></thead>
        <tbody>
          {loading ? Array.from({ length: loadingRows }).map((_, i) => (
            <tr key={i} style={{ height: "var(--row-h-finance)" }}>
              {columns.map((c) => <td key={c.key} style={{ padding: "0 12px", borderBottom: "1px solid var(--border-hairline)" }}><span style={{ display: "block", height: 12, width: c.numeric ? "50%" : "70%", marginLeft: c.numeric ? "auto" : 0, borderRadius: 6, background: "linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-shine) 50%, var(--skeleton-base) 75%)", backgroundSize: "200% 100%", animation: `zh-shimmer 1.4s linear ${i * 80}ms infinite` }} /></td>)}
            </tr>
          ))
            : sorted.length === 0 ? <tr><td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>{empty || "Nothing here yet."}</td></tr>
            : sorted.map((r, i) => <Tr key={keyOf(r, i)} row={r} columns={columns} onClick={onRowClick} selected={selectedKey != null && get(r, rowKey) === selectedKey} density={density} />)}
        </tbody>
      </table>
    </div>
  );
}
