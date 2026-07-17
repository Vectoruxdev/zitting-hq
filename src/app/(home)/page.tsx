import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getDashboardData, familyHour, familyDateLabel } from "@/db/dashboard";

export const metadata = { title: "Zitting HQ" };
export const dynamic = "force-dynamic";

/* The family home base — one glance at money, dinner, the schedule, and the
   shopping list, each card opening its module. */

function Spark({ values }: { values: number[] }) {
  if (!values || values.length < 2) return null;
  const w = 130;
  const h = 40;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 5 - ((v - min) / span) * (h - 10)}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: "block" }}>
      <polyline points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill="rgba(63,208,127,0.12)" stroke="none" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div style={{ height: 8, borderRadius: 999, background: "var(--surface-sunken, rgba(255,255,255,0.06))", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(2, pct)}%`, height: "100%", borderRadius: 999, background: "var(--accent)" }} />
    </div>
  );
}

function CardHead({ icon, label, hint }: { icon: string; label: string; hint: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
      <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
      <span className="zt-eyebrow">{label}</span>
      <span style={{ flex: 1 }} />
      {hint ? <span className="hq-card-open" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>{hint} →</span> : null}
    </div>
  );
}

// Quick-action shortcuts — the common "add something" jumps. Universal for
// every role; /finance lands on the member camera/receipt flow for members.
const QUICK_ACTIONS = [
  { icon: "📸", label: "Snap receipt", href: "/finance" },
  { icon: "🛒", label: "Add to list", href: "/groceries" },
  { icon: "🍽️", label: "Plan dinner", href: "/meals" },
  { icon: "📅", label: "Add event", href: "/calendar" },
];

const DayChip = ({ chip }: { chip: string }) => (
  <span className="zt-num" style={{ flex: "none", width: 78, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: chip === "Today" ? "var(--accent)" : "var(--text-tertiary)" }}>{chip}</span>
);

const pill = (tone: "good" | "warn") => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12.5,
  fontWeight: 600,
  borderRadius: 999,
  padding: "6px 12px",
  color: tone === "good" ? "var(--accent)" : "var(--warning)",
  background: tone === "good" ? "var(--green-glow, rgba(63,208,127,0.12))" : "transparent",
  border: `1px solid ${tone === "good" ? "var(--green-tint, rgba(63,208,127,0.3))" : "var(--border-hairline)"}`,
} as const);

const cardStyle = (span: number) => ({
  gridColumn: `span ${span}`,
  display: "block",
  background: "var(--surface-card)",
  border: "1px solid var(--border-hairline)",
  borderRadius: "var(--radius-lg, 18px)",
  padding: "clamp(18px, 2.5vw, 24px)",
  minWidth: 0,
} as const);

export default async function Home() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login");

  const role = (user?.role ?? "owner") as "owner" | "partner" | "member";
  const d = await getDashboardData({ memberId: user?.memberId ?? null, role });

  const hour = familyHour();
  const greeting = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (d.finance.memberName || user?.name || "there").split(" ")[0];
  const f = d.finance;
  const isMember = role === "member";

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "clamp(22px, 4vw, 44px) 18px 64px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          {/* greeting */}
          <div style={{ marginBottom: 18 }}>
            <p className="zt-eyebrow" style={{ marginBottom: 10 }}>{familyDateLabel()}</p>
            <h1 style={{ fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", lineHeight: 1.15 }}>
              {greeting}, {firstName}.
            </h1>
          </div>

          {/* quick actions — the most common "add something" jumps. Scrolls
              horizontally on phones instead of wrapping. */}
          <div className="zhq-hscroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href + a.label} href={a.href} className="hq-quick" style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 16px", borderRadius: "var(--radius-pill, 999px)", border: "1px solid var(--border-hairline)", background: "var(--surface-card)", color: "var(--text-primary)", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", textDecoration: "none" }}>
                <span aria-hidden style={{ fontSize: 17 }}>{a.icon}</span>
                {a.label}
              </Link>
            ))}
          </div>

          {/* action zone — Today's agenda + what needs doing */}
          <div className="hq-grid" style={{ marginBottom: 16 }}>
            {/* Today */}
            <div className="hq-card hq-static" style={{ ...cardStyle(3) }}>
              <CardHead icon="🗓️" label="Today" hint="" />
              {d.today.events.length || d.today.dinner ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {d.today.events.map((ev, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 9, padding: "7px 0", borderBottom: "1px solid var(--border-hairline)" }}>
                      <span className="zt-num" style={{ flex: "none", width: 58, fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>{ev.time || "All day"}</span>
                      <span style={{ flex: "none", width: 7, height: 7, borderRadius: 999, background: ev.color, position: "relative", top: -1 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                    </div>
                  ))}
                  {d.today.dinner ? (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 9, padding: "7px 0" }}>
                      <span className="zt-num" style={{ flex: "none", width: 58, fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>Dinner</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-primary)" }}>{d.today.dinner.emoji ? `${d.today.dinner.emoji} ` : ""}{d.today.dinner.name}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p style={{ fontSize: 13.5, color: "var(--text-tertiary)", lineHeight: 1.55 }}>
                  Nothing on the agenda today{d.calendar.feedCount ? "" : " — connect a calendar to see events"}.
                </p>
              )}
            </div>

            {/* Needs attention */}
            <div className="hq-card hq-static" style={{ ...cardStyle(3) }}>
              <CardHead icon="✅" label="Needs attention" hint="" />
              {d.needsAttention.length ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {d.needsAttention.map((it, i) => (
                    <Link key={it.key} href={it.href} className="hq-attn-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 2px", textDecoration: "none", borderBottom: i < d.needsAttention.length - 1 ? "1px solid var(--border-hairline)" : "none" }}>
                      <span style={{ flex: "none", width: 7, height: 7, borderRadius: 999, background: it.tone === "accent" ? "var(--accent)" : "var(--warning)" }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-primary)" }}>{it.label}</span>
                      <span style={{ flex: "none", color: "var(--text-tertiary)", fontSize: 15 }}>›</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "var(--accent)" }}>
                  ✓ All caught up — nothing needs you right now.
                </div>
              )}
            </div>
          </div>

          <div className="hq-grid">
            {/* ============ FINANCE / MY MONEY (hero) ============ */}
            <Link href="/finance" className="hq-card" style={{ ...cardStyle(4), position: "relative", overflow: "hidden" }}>
              {/* soft glow behind the headline number */}
              <div aria-hidden style={{ position: "absolute", top: -90, left: -60, width: 340, height: 250, background: "radial-gradient(closest-side, rgba(63,208,127,0.13), transparent)", pointerEvents: "none" }} />
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 18, height: "100%" }}>
                <CardHead icon="💰" label={isMember ? "My money" : "Finance"} hint={isMember ? "Open my money" : "Open finance"} />
                {isMember ? (
                  <>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 8 }}>
                          {f.remainingLabel ? `Spending money left${f.monthLabel ? ` · ${f.monthLabel}` : ""}` : `Spent in ${f.monthLabel ?? "this month"}`}
                        </div>
                        <div className="zt-num" style={{ fontSize: "clamp(38px, 5vw, 50px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: f.remainingLabel ? "var(--accent)" : "var(--text-primary)" }}>
                          {f.remainingLabel || f.memberSpentLabel || "$0"}
                        </div>
                      </div>
                      {f.remainingLabel && f.memberSpentLabel ? (
                        <div style={{ fontSize: 13, color: "var(--text-tertiary)", paddingBottom: 6 }}>
                          {f.memberSpentLabel} spent of {f.allowanceLabel}/mo
                        </div>
                      ) : null}
                    </div>
                    {f.remainingLabel ? <Bar value={f.memberSpent ?? 0} max={f.memberAllowance ?? 1} /> : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                      {f.memberToReview ? (
                        <span style={pill("warn")}>{f.memberToReview} purchase{f.memberToReview === 1 ? "" : "s"} to review</span>
                      ) : (
                        <span style={pill("good")}>✓ All caught up</span>
                      )}
                      {f.remainingLabel && f.memberUnlocked === false ? (
                        <span style={pill("warn")}>Allowance locked — finish reviewing</span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 8 }}>Cash across accounts</div>
                        <div className="zt-num" style={{ fontSize: "clamp(38px, 5vw, 50px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: "var(--text-primary)" }}>
                          {f.totalCash || "$0"}
                        </div>
                      </div>
                      <div style={{ paddingBottom: 4 }}><Spark values={f.spendTrend || []} /></div>
                    </div>
                    <div style={{ display: "flex", gap: "clamp(20px, 3vw, 38px)", flexWrap: "wrap", paddingTop: 2 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>Spent in {f.monthLabel}</div>
                        <div className="zt-num" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{f.spending || "$0"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>Income</div>
                        <div className="zt-num" style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>{f.income || "$0"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>Net worth</div>
                        <div className="zt-num" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{f.netWorth || "$0"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                      {f.transfersPending ? (
                        <span style={pill("good")}>{f.transfersPending} transfer{f.transfersPending === 1 ? "" : "s"} ready · {f.transfersPendingTotal}</span>
                      ) : null}
                      {f.toReview ? <span style={pill("warn")}>{f.toReview} to review</span> : null}
                      {!f.transfersPending && !f.toReview ? <span style={pill("good")}>✓ Reviewed &amp; routed</span> : null}
                    </div>
                  </>
                )}
              </div>
            </Link>

            {/* ============ CALENDAR ============ */}
            <Link href="/calendar" className="hq-card" style={cardStyle(2)}>
              <CardHead icon="📅" label="This week" hint="Calendar" />
              {d.calendar.events.length ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {d.calendar.events.map((ev, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 9, padding: "8px 0", borderBottom: i < d.calendar.events.length - 1 ? "1px solid var(--border-hairline)" : "none" }}>
                      <DayChip chip={ev.chip} />
                      <span style={{ flex: "none", width: 7, height: 7, borderRadius: 999, background: ev.color, position: "relative", top: -1 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                      {ev.time ? <span className="zt-num" style={{ flex: "none", fontSize: 11.5, color: "var(--text-tertiary)" }}>{ev.time}</span> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13.5, color: "var(--text-tertiary)", lineHeight: 1.55 }}>
                  {d.calendar.feedCount ? "Nothing on the schedule this week — enjoy the quiet." : "Connect a Google Calendar feed to see the week here."}
                </p>
              )}
            </Link>

            {/* ============ DINNER ============ */}
            <Link href="/meals" className="hq-card" style={cardStyle(3)}>
              <CardHead icon="🍽️" label="Dinner" hint="Plan meals" />
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span aria-hidden style={{ flex: "none", width: 52, height: 52, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 14, background: "var(--surface-sunken, rgba(255,255,255,0.05))", fontSize: 26 }}>
                  {d.meals.tonight?.emoji || "🍽️"}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 3 }}>Tonight</div>
                  <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", color: d.meals.tonight ? "var(--text-primary)" : "var(--text-secondary)", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.meals.tonight ? d.meals.tonight.name : "Nothing planned yet"}
                  </div>
                  {d.meals.tonight?.note ? <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 3 }}>{d.meals.tonight.note}</div> : null}
                </div>
              </div>
              {d.meals.upcoming.length ? (
                <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
                  {d.meals.upcoming.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 9, padding: "7px 0", borderTop: "1px solid var(--border-hairline)" }}>
                      <DayChip chip={m.chip} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.emoji ? `${m.emoji} ` : ""}{m.name}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </Link>

            {/* ============ CAMERAS (owner only) ============ */}
            {role === "owner" ? (
              <Link href="/nest" className="hq-card" style={cardStyle(3)}>
                <CardHead icon="📷" label="Cameras" hint="Open cameras" />
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span aria-hidden style={{ flex: "none", width: 52, height: 52, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 14, background: "var(--surface-sunken, rgba(255,255,255,0.05))", fontSize: 26 }}>
                    💡
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Nest → Govee</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 3, lineHeight: 1.5 }}>
                      Person, motion, and doorbell events light up the house.
                    </div>
                  </div>
                </div>
              </Link>
            ) : null}

            {/* ============ GROCERIES ============ */}
            <Link href="/groceries" className="hq-card" style={cardStyle(3)}>
              <CardHead icon="🛒" label="Groceries" hint="Open list" />
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="zt-num" style={{ flex: "none", width: 52, height: 52, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 14, background: "var(--surface-sunken, rgba(255,255,255,0.05))", fontSize: 23, fontWeight: 700, color: d.groceries.listCount ? "var(--accent)" : "var(--text-tertiary)" }}>
                  {d.groceries.listCount}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                    {d.groceries.listCount === 1 ? "item on the list" : "items on the list"}
                  </div>
                  <div style={{ fontSize: 12.5, color: d.groceries.lowCount ? "var(--warning)" : "var(--text-tertiary)", marginTop: 3, lineHeight: 1.5 }}>
                    {d.groceries.lowCount
                      ? `${d.groceries.lowCount} running low${d.groceries.lowNames.length ? ` — ${d.groceries.lowNames.join(", ")}${d.groceries.lowCount > d.groceries.lowNames.length ? "…" : ""}` : ""}`
                      : "Pantry's stocked."}
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
