import * as React from "react";
import { Icon } from "../core/Icon";

export interface DetailItem { label: string; value: React.ReactNode; icon?: string }
export interface DetailListProps { items: DetailItem[]; dense?: boolean; style?: React.CSSProperties }

/** Key/value rows for a detail view (appointment, transaction, camera event). Values right-aligned; money values pass a <Money>. */
export function DetailList({ items = [], dense = false, style }: DetailListProps) {
  return (
    <dl style={{ margin: 0, display: "flex", flexDirection: "column", ...style }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16, minHeight: dense ? 36 : 48, padding: dense ? "6px 0" : "10px 0", borderTop: i ? "1px solid var(--border-hairline)" : "none" }}>
          <dt style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 40%", minWidth: 0, font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>
            {it.icon ? <Icon name={it.icon} size={16} color="var(--text-tertiary)" /> : null}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
          </dt>
          <dd style={{ margin: 0, flex: 1, minWidth: 0, font: "var(--type-body)", fontWeight: 500, textAlign: "right", color: "var(--text-primary)", textWrap: "pretty" }}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
