"use client";

/**
 * Cameras — Nest → Govee control room. Owner-only. Wire-up status, device
 * sync, rules (camera × event → light action), and the live event log.
 */
import React from "react";
import { useRouter } from "next/navigation";
import * as actions from "./actions";
import type { NestRuleAction } from "@/db/schema";

const card: React.CSSProperties = {
  background: "var(--surface-card)",
  border: "1px solid var(--border-hairline)",
  borderRadius: "var(--radius-lg, 18px)",
};

const EVENT_TYPES = [
  { id: "person", label: "Person seen", emoji: "🧍" },
  { id: "motion", label: "Motion", emoji: "🏃" },
  { id: "chime", label: "Doorbell press", emoji: "🔔" },
  { id: "sound", label: "Sound", emoji: "🔊" },
  { id: "any", label: "Any event", emoji: "✨" },
];

const COLORS = [
  { label: "Red", value: { r: 255, g: 0, b: 0 } },
  { label: "Orange", value: { r: 255, g: 120, b: 0 } },
  { label: "Green", value: { r: 0, g: 200, b: 80 } },
  { label: "Blue", value: { r: 0, g: 120, b: 255 } },
  { label: "Purple", value: { r: 160, g: 60, b: 255 } },
  { label: "White", value: { r: 255, g: 255, b: 255 } },
];

const STATUS_LABEL: Record<string, string> = {
  fired: "💡 fired",
  no_rule: "no rule",
  cooldown: "⏳ cooldown",
  quiet_hours: "🌙 quiet hours",
  disabled: "camera off",
  error: "⚠️ error",
  none: "logged",
};

export interface NestData {
  configured: boolean;
  nestConfigured: boolean;
  goveeConfigured: boolean;
  connected: boolean;
  connectedBy: string | null;
  devices: { id: string; displayName: string | null; room: string | null; type: string | null; enabled: boolean; lastEventAt: string | null }[];
  goveeDevices: { device: string; model: string; name: string | null; supportsColor: boolean }[];
  rules: {
    id: number;
    nestDeviceId: string;
    eventType: string;
    goveeDevice: string;
    action: NestRuleAction;
    enabled: boolean;
    activeStart: string | null;
    activeEnd: string | null;
    cooldownSeconds: number;
  }[];
  events: { id: number; nestDeviceId: string | null; eventType: string; eventAt: string | null; actionStatus: string; actionError: string | null }[];
}

function Check({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 14 }}>
      <span>{ok ? "✅" : "⭕"}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{label}</span>
      {!ok && hint ? <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{hint}</span> : null}
    </div>
  );
}

function Btn({ children, onClick, disabled, tone }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; tone?: "danger" | "primary" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        font: "inherit", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer",
        padding: "8px 14px", borderRadius: 10, minHeight: 36,
        border: "1px solid var(--border-hairline)",
        background: tone === "primary" ? "var(--accent)" : "var(--surface-sunken)",
        color: tone === "danger" ? "#e5484d" : tone === "primary" ? "#fff" : "var(--text-primary)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

const selStyle: React.CSSProperties = {
  font: "inherit", fontSize: 14, padding: "9px 10px", borderRadius: 10,
  border: "1px solid var(--border-hairline)", background: "var(--surface-sunken)",
  color: "var(--text-primary)", minHeight: 40,
};

export function NestClient({ data }: { data: NestData }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fn();
      if (!res.ok) setNotice(res.error || "Something went wrong");
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const deviceName = (id: string | null) =>
    data.devices.find((d) => d.id === id)?.displayName || "Unknown camera";
  const lightName = (device: string) =>
    data.goveeDevices.find((g) => g.device === device)?.name || device;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <p className="zt-eyebrow" style={{ marginBottom: 6 }}>Cameras</p>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
          Nest cameras → Govee lights
        </h1>
      </div>

      {!data.configured ? (
        <div style={{ ...card, padding: 22, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          The nest tables aren&apos;t set up yet — run <code style={{ color: "var(--accent)" }}>supabase-nest.sql</code> in the Supabase SQL Editor, then reload.
        </div>
      ) : null}

      {notice ? (
        <div style={{ ...card, padding: 14, fontSize: 13, color: "#e5484d" }}>{notice}</div>
      ) : null}

      {/* ---- Setup status ---- */}
      <section style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Setup</h2>
        <Check ok={data.nestConfigured} label="Google env vars" hint="GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / NEST_PROJECT_ID" />
        <Check ok={data.connected} label="Nest account linked" hint="connect below, sign in as the account that owns the cameras" />
        <Check ok={data.goveeConfigured} label="Govee API key" hint="GOVEE_API_KEY (Govee Home app → Apply for API Key)" />
        <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
          {!data.connected ? (
            // Plain navigation, not <Link>: prefetching an OAuth kickoff route
            // would set state cookies (and hit Google) before the click.
            <Btn tone="primary" onClick={() => (window.location.href = "/api/nest/auth")}>
              Connect Nest account
            </Btn>
          ) : (
            <>
              <span style={{ fontSize: 13, color: "var(--text-tertiary)", alignSelf: "center" }}>
                Linked{data.connectedBy ? ` by ${data.connectedBy}` : ""}
              </span>
              <Btn tone="danger" disabled={busy !== null} onClick={() => run("disconnect", actions.disconnect)}>
                Disconnect
              </Btn>
            </>
          )}
        </div>
      </section>

      {/* ---- Devices ---- */}
      <section style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Cameras</h2>
          <Btn disabled={!data.connected || busy !== null} onClick={() => run("sync-nest", actions.syncNestDevices)}>
            {busy === "sync-nest" ? "Syncing…" : "Sync cameras"}
          </Btn>
        </div>
        {data.devices.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>No cameras yet — connect, then sync.</p>
        ) : (
          data.devices.map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 14 }}>
              <span>📷</span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.displayName}</span>
              {d.room ? <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{d.room}</span> : null}
              <span style={{ marginLeft: "auto", color: "var(--text-tertiary)", fontSize: 12 }}>
                {d.lastEventAt ? `last event ${new Date(d.lastEventAt).toLocaleString()}` : "no events yet"}
              </span>
            </div>
          ))
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Lights</h2>
          <Btn disabled={!data.goveeConfigured || busy !== null} onClick={() => run("sync-govee", actions.syncGoveeDevices)}>
            {busy === "sync-govee" ? "Syncing…" : "Sync lights"}
          </Btn>
        </div>
        {data.goveeDevices.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>No Govee lights yet — add GOVEE_API_KEY, then sync.</p>
        ) : (
          data.goveeDevices.map((g) => (
            <div key={g.device} style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 14 }}>
              <span>💡</span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{g.name || g.device}</span>
              <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{g.model}</span>
            </div>
          ))
        )}
      </section>

      {/* ---- Rules ---- */}
      <RulesSection data={data} busy={busy} run={run} deviceName={deviceName} lightName={lightName} />

      {/* ---- Recent events ---- */}
      <section style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Recent events</h2>
        {data.events.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>
            Nothing yet. Events appear here once the Pub/Sub subscription is pointed at /api/nest/events.
          </p>
        ) : (
          data.events.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 13 }}>
              <span style={{ color: "var(--text-tertiary)", fontSize: 12, minWidth: 130 }}>
                {e.eventAt ? new Date(e.eventAt).toLocaleString() : "—"}
              </span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{deviceName(e.nestDeviceId)}</span>
              <span style={{ color: "var(--text-secondary)" }}>{e.eventType}</span>
              <span style={{ marginLeft: "auto", color: e.actionStatus === "error" ? "#e5484d" : "var(--text-tertiary)", fontSize: 12 }} title={e.actionError ?? undefined}>
                {STATUS_LABEL[e.actionStatus] ?? e.actionStatus}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function RulesSection({
  data, busy, run, deviceName, lightName,
}: {
  data: NestData;
  busy: string | null;
  run: (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => Promise<void>;
  deviceName: (id: string | null) => string;
  lightName: (device: string) => string;
}) {
  const canAdd = data.devices.length > 0 && data.goveeDevices.length > 0;
  const [camera, setCamera] = React.useState("");
  const [eventType, setEventType] = React.useState("person");
  const [light, setLight] = React.useState("");
  const [kind, setKind] = React.useState<NestRuleAction["kind"]>("flash");
  const [colorIdx, setColorIdx] = React.useState(3); // blue
  const [flashes, setFlashes] = React.useState(3);
  const [activeStart, setActiveStart] = React.useState("");
  const [activeEnd, setActiveEnd] = React.useState("");

  const describeAction = (a: NestRuleAction) => {
    const colorName = COLORS.find(
      (c) => c.value.r === a.color?.r && c.value.g === a.color?.g && c.value.b === a.color?.b
    )?.label ?? "custom color";
    if (a.kind === "off") return "turn off";
    if (a.kind === "color") return `turn ${colorName.toLowerCase()}`;
    return `flash ${colorName.toLowerCase()} ×${a.flashes ?? 3}`;
  };

  const add = () =>
    run("add-rule", () =>
      actions.createRule({
        nestDeviceId: camera || data.devices[0].id,
        eventType,
        goveeDevice: light || data.goveeDevices[0].device,
        action: {
          kind,
          color: COLORS[colorIdx].value,
          brightness: 100,
          ...(kind === "flash" ? { flashes } : {}),
        },
        activeStart: activeStart || null,
        activeEnd: activeEnd || null,
      })
    );

  return (
    <section style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Rules</h2>

      {data.rules.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>
          No rules yet. A rule is: when <em>camera</em> sees <em>event</em>, make <em>light</em> do something.
        </p>
      ) : (
        data.rules.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, flexWrap: "wrap", opacity: r.enabled ? 1 : 0.5 }}>
            <span>{EVENT_TYPES.find((t) => t.id === r.eventType)?.emoji ?? "✨"}</span>
            <span style={{ color: "var(--text-primary)" }}>
              <strong>{deviceName(r.nestDeviceId)}</strong> {EVENT_TYPES.find((t) => t.id === r.eventType)?.label.toLowerCase() ?? r.eventType} →{" "}
              <strong>{lightName(r.goveeDevice)}</strong> {describeAction(r.action)}
            </span>
            {r.activeStart && r.activeEnd ? (
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{r.activeStart}–{r.activeEnd}</span>
            ) : null}
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <Btn disabled={busy !== null} onClick={() => run(`test-${r.id}`, () => actions.testRule(r.id))}>
                {busy === `test-${r.id}` ? "Testing…" : "Test"}
              </Btn>
              <Btn disabled={busy !== null} onClick={() => run(`toggle-${r.id}`, () => actions.setRuleEnabled(r.id, !r.enabled))}>
                {r.enabled ? "Pause" : "Resume"}
              </Btn>
              <Btn tone="danger" disabled={busy !== null} onClick={() => run(`del-${r.id}`, () => actions.deleteRule(r.id))}>
                Delete
              </Btn>
            </span>
          </div>
        ))
      )}

      <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Add a rule</p>
        {!canAdd ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>Sync at least one camera and one light first.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select value={camera || data.devices[0].id} onChange={(e) => setCamera(e.target.value)} style={selStyle}>
                {data.devices.map((d) => (
                  <option key={d.id} value={d.id}>📷 {d.displayName}</option>
                ))}
              </select>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} style={selStyle}>
                {EVENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>
                ))}
              </select>
              <select value={light || data.goveeDevices[0].device} onChange={(e) => setLight(e.target.value)} style={selStyle}>
                {data.goveeDevices.map((g) => (
                  <option key={g.device} value={g.device}>💡 {g.name || g.device}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select value={kind} onChange={(e) => setKind(e.target.value as NestRuleAction["kind"])} style={selStyle}>
                <option value="flash">Flash</option>
                <option value="color">Change color</option>
                <option value="off">Turn off</option>
              </select>
              {kind !== "off" ? (
                <span style={{ display: "flex", gap: 6 }}>
                  {COLORS.map((c, i) => (
                    <button
                      key={c.label}
                      title={c.label}
                      onClick={() => setColorIdx(i)}
                      style={{
                        width: 30, height: 30, borderRadius: 999, cursor: "pointer",
                        background: `rgb(${c.value.r},${c.value.g},${c.value.b})`,
                        border: colorIdx === i ? "3px solid var(--accent)" : "2px solid var(--border-hairline)",
                      }}
                    />
                  ))}
                </span>
              ) : null}
              {kind === "flash" ? (
                <select value={flashes} onChange={(e) => setFlashes(Number(e.target.value))} style={selStyle}>
                  {[1, 2, 3, 4, 5].map((nf) => (
                    <option key={nf} value={nf}>×{nf}</option>
                  ))}
                </select>
              ) : null}
              <label style={{ fontSize: 13, color: "var(--text-tertiary)", display: "flex", gap: 6, alignItems: "center" }}>
                only between
                <input type="time" value={activeStart} onChange={(e) => setActiveStart(e.target.value)} style={selStyle} />
                –
                <input type="time" value={activeEnd} onChange={(e) => setActiveEnd(e.target.value)} style={selStyle} />
              </label>
              <Btn tone="primary" disabled={busy !== null} onClick={add}>
                {busy === "add-rule" ? "Adding…" : "Add rule"}
              </Btn>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
