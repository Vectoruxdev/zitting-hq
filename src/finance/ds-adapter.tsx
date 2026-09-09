"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- the finance screens are untyped .jsx; this adapter is their typed edge */
/**
 * Adapter: the finance screens' component namespace (window.ZittingHQDesignSystem_c9e528,
 * the 2026-06 "Premium Dark Fintech" handoff) re-implemented on the 2026-09 design
 * system in src/ui. Each export keeps the OLD prop contract the 23 screens were
 * written against and renders the NEW component, so the screens re-skin with zero
 * edits. Components with no faithful equivalent (charts, DataTable, StatTile, Card)
 * stay on their original implementation, which already reads the new tokens.
 * Phase 6 ports the screens to src/ui directly and deletes this file.
 */
import * as React from "react";
import * as UI from "@/ui";

/* ---------- icon names: old icons.js keys → Lucide ---------- */
const ICON_MAP: Record<string, string> = {
  dashboard: "layout-dashboard", wallet: "wallet", transfers: "arrow-left-right", list: "list", pie: "chart-pie",
  trendingUp: "trending-up", trendingDown: "trending-down", repeat: "repeat", allocations: "sliders-horizontal", target: "target",
  receipt: "receipt", sparkles: "sparkles", settings: "settings", bell: "bell", search: "search", plus: "plus", check: "check",
  chevronRight: "chevron-right", chevronDown: "chevron-down", chevronLeft: "chevron-left", chevronUp: "chevron-up",
  arrowUpRight: "arrow-up-right", arrowDownRight: "arrow-down-right", arrowRight: "arrow-right", arrowDown: "arrow-down", arrowUp: "arrow-up",
  creditCard: "credit-card", bank: "landmark", users: "users", user: "user", filter: "filter", moreHorizontal: "ellipsis",
  alert: "triangle-alert", alertTriangle: "triangle-alert", x: "x", calendar: "calendar", camera: "camera", flag: "flag",
  logout: "log-out", eye: "eye", eyeOff: "eye-off", pencil: "pencil", dollar: "dollar-sign", piggyBank: "piggy-bank", grid: "layout-grid",
  clock: "clock", link: "link", sun: "sun", moon: "moon", trash: "trash-2", upload: "upload", download: "download", refresh: "refresh-cw",
  info: "info", lock: "lock", home: "house", image: "image", heart: "heart", copy: "copy", share: "share", tag: "tag", mail: "mail",
};
export const iconName = (name: unknown): string => {
  const n = String(name ?? "");
  if (ICON_MAP[n]) return ICON_MAP[n];
  if (UI.hasIcon(n)) return n;
  if (process.env.NODE_ENV !== "production") console.warn(`[finance adapter] unmapped icon "${n}"`);
  return "circle";
};

/** Stable 1–6 person tint from a name (the old system hashed names into a palette the same way). */
const personFor = (name: unknown): number => {
  const s = String(name ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
};

const BUTTON_VARIANT: Record<string, UI.ButtonVariant> = { primary: "primary", accent: "primary", secondary: "secondary", ghost: "ghost", destructive: "danger", soft: "soft", danger: "danger", onPhoto: "onPhoto" };

/* ---------- core ---------- */
export function Icon({ name, size = 18, color, style, title, className, strokeWidth: _sw, ...rest }: any) {
  void _sw;
  return <UI.Icon name={iconName(name)} size={size} color={color} label={title} className={className} style={style} {...rest} />;
}

export function Button({ children, variant = "secondary", size = "md", iconLeft = null, iconRight = null, full = false, ...rest }: any) {
  const left = typeof iconLeft === "string" ? iconName(iconLeft) : undefined;
  const right = typeof iconRight === "string" ? iconName(iconRight) : undefined;
  return (
    <UI.Button variant={BUTTON_VARIANT[variant] || "secondary"} size={size} iconLeft={left} iconRight={right} fullWidth={full} {...rest}>
      {React.isValidElement(iconLeft) ? iconLeft : null}
      {children}
      {React.isValidElement(iconRight) ? iconRight : null}
    </UI.Button>
  );
}

const ICONBUTTON_VARIANT: Record<string, "ghost" | "filled" | "outline" | "onPhoto"> = { ghost: "ghost", solid: "filled", outline: "outline", filled: "filled", onPhoto: "onPhoto" };
export function IconButton({ icon, children: _c, variant = "ghost", size = "md", round: _r, active = false, label, ...rest }: any) {
  void _c; void _r;
  return <UI.IconButton icon={iconName(icon)} label={label || String(icon)} variant={ICONBUTTON_VARIANT[variant] || "ghost"} size={size} active={active} {...rest} />;
}

const AVATAR_SIZE: Record<string, UI.AvatarSize> = { xs: "xs", sm: "sm", md: "md", lg: "lg", xl: "xl" };
export function Avatar({ name, src, tone: _t, size = "md", ring = false, style, onClick }: any) {
  void _t;
  return <UI.Avatar name={name} src={src} person={personFor(name)} size={AVATAR_SIZE[size] || "md"} ring={ring} style={style} onClick={onClick} />;
}

const STATUS_TONE: Record<string, UI.BadgeTone> = {
  pending: "warning", awaiting: "warning", "due soon": "warning", changed: "warning",
  confirmed: "positive", sent: "positive", done: "positive", "auto-confirmed": "accent",
  new: "info", over: "negative", "over budget": "negative", late: "negative", missed: "negative",
};
export function Badge({ children, tone, status, dot = false, size = "md", style }: any) {
  const resolved: UI.BadgeTone = (tone as UI.BadgeTone) || (status && STATUS_TONE[String(status).toLowerCase()]) || "neutral";
  if (dot) return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }}><UI.Badge tone={resolved} dot /><UI.Badge tone={resolved} size={size}>{children}</UI.Badge></span>;
  return <UI.Badge tone={resolved} size={size} style={style}>{children}</UI.Badge>;
}

export function Tag({ children, color, editable = false, onRemove, onClick, size = "md", style }: any) {
  return <UI.Tag color={color} onRemove={editable || onRemove ? onRemove : undefined} onClick={onClick} size={size} style={style}>{children}</UI.Tag>;
}

const toItems = (options: any[]) => options.map((o) => (typeof o === "string" ? { key: o, label: o } : { key: o.value, label: o.label, icon: o.icon ? iconName(o.icon) : undefined, count: o.count, disabled: o.disabled }));
export function Tabs({ options = [], value, defaultValue, onChange, style }: any) {
  return <UI.Tabs items={toItems(options)} value={value} defaultValue={defaultValue} onChange={onChange} style={style} />;
}
export function SegmentedControl({ options = [], value, defaultValue, onChange, size = "md", full = false, style, className }: any) {
  return <UI.SegmentedControl items={toItems(options)} value={value} defaultValue={defaultValue} onChange={onChange} size={size} className={className} style={{ ...(full ? { display: "flex", width: "100%" } : null), ...style }} />;
}

export function Select({ value, onChange, options = [], placeholder, label, disabled = false, style, name, id }: any) {
  const opts = options.map((o: any) => (typeof o === "string" ? { value: o, label: o } : { value: String(o.value), label: o.label, disabled: o.disabled }));
  return <UI.Select value={value} onChange={(e) => onChange && onChange(e.target.value, e)} options={opts} placeholder={placeholder} label={label} disabled={disabled} style={style} name={name} id={id} />;
}

export function TextInput({ value, onChange, placeholder, type = "text", label, error, prefix, inputMode, disabled = false, style, ...rest }: any) {
  return <UI.Input value={value} onChange={(e) => onChange && onChange(e.target.value, e)} placeholder={placeholder} type={type} label={label} error={error} prefix={prefix} inputMode={inputMode} disabled={disabled} style={style} {...rest} />;
}

export function Toggle({ checked, defaultChecked = false, onChange, disabled = false, size = "md", label, style }: any) {
  return <UI.Toggle checked={checked} defaultChecked={defaultChecked} onChange={onChange} disabled={disabled} size={size === "sm" ? "sm" : "md"} label={label} style={style} />;
}
export function Checkbox({ checked = false, onChange, label, disabled = false, size, style }: any) {
  return <UI.Checkbox checked={checked} onChange={onChange} label={label} disabled={disabled} size={typeof size === "number" && size >= 24 ? "lg" : "md"} style={style} />;
}

/* ---------- feedback ---------- */
export function Modal({ open, onClose, title, children, footer, width = 460 }: any) {
  const size = width <= 440 ? "sm" : width <= 600 ? "md" : "lg";
  return <UI.Modal open={!!open} onClose={onClose} title={title} footer={footer} size={size}>{children}</UI.Modal>;
}
export function EmptyState({ icon = "list", title, body, actionLabel, onAction, secondaryLabel, onSecondary, style }: any) {
  return (
    <UI.EmptyState
      icon={iconName(icon)} title={title} body={body} compact={false} style={style}
      action={actionLabel ? <UI.Button variant="primary" onClick={onAction}>{actionLabel}</UI.Button> : undefined}
      secondary={secondaryLabel ? <UI.Button variant="ghost" onClick={onSecondary}>{secondaryLabel}</UI.Button> : undefined}
    />
  );
}
export function Skeleton({ width = "100%", height = 14, radius, circle = false, style }: any) {
  return <UI.Skeleton variant={circle ? "circle" : "rect"} width={width} height={circle ? undefined : height} style={{ ...(radius != null && !circle ? { borderRadius: radius } : null), ...style }} />;
}

/* ---------- data ---------- */
export function Sparkline({ data = [], width = 88, height = 26, color, area = false, style }: any) {
  const c = String(color || "");
  const tone = /negative|red/.test(c) ? "negative" : /positive|green/.test(c) ? "positive" : /accent|coral/.test(c) ? "accent" : /tertiary|gray/.test(c) ? "neutral" : "auto";
  return <UI.Sparkline values={data} width={width} height={height} fill={area} tone={tone} style={style} />;
}
export function ProgressBar({ value = 0, max = 100, tone, height = 8, style }: any) {
  const t: UI.ProgressBarProps["tone"] = tone === "accent" ? "accent" : tone === "neutral" ? "info" : "budget";
  return <UI.ProgressBar value={max ? value / max : 0} tone={t} size={height <= 6 ? "sm" : height <= 8 ? "md" : "lg"} style={style} />;
}
