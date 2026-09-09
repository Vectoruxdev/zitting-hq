"use client";
import * as React from "react";
import { Icon } from "../core/Icon";
import { Avatar, type AvatarProps } from "./Avatar";
import type { Tint } from "../interact";

export interface QuoteCardProps {
  text: string;
  who?: Pick<AvatarProps, "name" | "src" | "person">;
  age?: number;
  when?: string;
  tint?: Tint;
  tone?: "plain" | "paper";
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** A quote as an heirloom, not a record: big serif italic, who said it, when. `tone="paper"` gives it a soft tinted ground for the archive grid. */
export function QuoteCard({ text, who = {}, age, when, tint = "rose", tone = "plain", onClick, style }: QuoteCardProps) {
  const El: React.ElementType = onClick ? "button" : "figure";
  return (
    <El
      type={onClick ? "button" : undefined} onClick={onClick}
      style={{ margin: 0, padding: tone === "paper" ? 20 : 0, border: 0, borderRadius: "var(--radius-card)", background: tone === "paper" ? `var(--hue-${tint}-soft)` : "transparent", color: "var(--text-primary)", textAlign: "left", display: "flex", flexDirection: "column", gap: 14, cursor: onClick ? "pointer" : "default", font: "inherit", width: "100%", minWidth: 0, ...style }}
    >
      <Icon name="quote" size={18} color={`var(--hue-${tint})`} />
      <blockquote style={{ margin: 0, font: "var(--type-quote)", fontSize: tone === "paper" ? "var(--fs-xl)" : "var(--fs-2xl)", textWrap: "pretty", color: "var(--text-primary)" }}>{text}</blockquote>
      <figcaption style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar {...who} size="sm" />
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ font: "var(--type-label)" }}>{who.name}{age != null ? `, age ${age}` : ""}</span>
          {when ? <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>{when}</span> : null}
        </span>
      </figcaption>
    </El>
  );
}
