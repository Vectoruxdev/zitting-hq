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
  const w = 120;
  const h = 34;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 4 - ((v - min) / span) * (h - 8)}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
    </svg>
  );
}

function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="zt-eyebrow" style={{ display: "flex", alignItems: "center", gap: 8, color: color || "var(--text-tertiary)" }}>
      {children}
    </div>
  );
}

function OpenHint({ label }: { label: string }) {
  return (
    <span className="hq-card-open" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>
      {label} →
    </span>
  );
}

export default async function Home() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login");

  const role = (user?.role ?? "owner") as "owner" | "partner" | "member";
  const d = await getDashboardData({ memberId: user?.memberId ?? null, role });

  const hour = familyHour();
  const greeting = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user?.name || "there").split(" ")[0];
  const f = d.finance;
  const isMember = role === "member";

  const card = (href: string, body: React.ReactNode, gridColumn?: string) => (
    <Link key={href} href={href} className="hq-card" style={{ display: "block", gridColumn, background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg, 18px)", padding: "clamp(18px, 2.5vw, 24px)", minWidth: 0 }}>
      {body}
    </Link>
  );

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "clamp(22px, 4vw, 44px) 18px 64px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          {/* greeting */}
          <div style={{ marginBottom: "clamp(22px, 3.5vw, 34px)" }}>
            <p className="zt-eyebrow" style={{ marginBottom: 10 }}>{familyDateLabel()}</p>
            <h1 style={{ fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", lineHeight: 1.15 }}>
              {greeting}, {firstName}.
            </h1>
          </div>

          <div className="hq-grid">
            {/* ============ FINANCE (hero) ============ */}
            {card("/finance", (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <Eyebrow>Finance</Eyebrow>
                  <OpenHint label="Open finance" />
                </div>
                {isMember ? (
                  <>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 6 }}>Your spending money{f.monthLabel ? ` · ${f.monthLabel}` : ""}</div>
                      <div className="zt-num" style={{ fontSize: "clamp(34px, 5vw, 44px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: "var(--accent)" }}>
                        {f.remainingLabel || "—"}
                      </div>
                      {f.allowanceLabel ? <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 8 }}>of {f.allowanceLabel}/mo</div> : null}
                    </div>
                    {f.memberToReview ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "var(--warning)" }}>
                        {f.memberToReview} purchase{f.memberToReview === 1 ? "" : "s"} to review
                      </div>
                    ) : (
                      <div style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>All caught up — nice.</div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 6 }}>Cash across accounts</div>
                        <div className="zt-num" style={{ fontSize: "clamp(34px, 5vw, 46px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: "var(--text-primary)" }}>
                          {f.totalCash || "$0"}
                        </div>
                      </div>
                      <div style={{ paddingBottom: 4 }}><Spark values={f.spendTrend || []} /></div>
                    </div>
                    <div style={{ display: "flex", gap: "clamp(18px, 3vw, 34px)", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 3 }}>Spent in {f.monthLabel}</div>
                        <div className="zt-num" style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)" }}>{f.spending || "$0"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 3 }}>Income</div>
                        <div className="zt-num" style={{ fontSize: 19, fontWeight: 700, color: "var(--accent)" }}>{f.income || "$0"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 3 }}>Net worth</div>
                        <div className="zt-num" style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)" }}>{f.netWorth || "$0"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                      {f.transfersPending ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--accent)", background: "var(--green-glow, rgba(63,208,127,0.12))", border: "1px solid var(--green-tint, rgba(63,208,127,0.3))", borderRadius: 999, padding: "5px 11px" }}>
                          {f.transfersPending} transfer{f.transfersPending === 1 ? "" : "s"} ready · {f.transfersPendingTotal}
                        </span>
                      ) : null}
                      {f.toReview ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--warning)", border: "1px solid var(--border-hairline)", borderRadius: 999, padding: "5px 11px" }}>
                          {f.toReview} to review
                        </span>
                      ) : null}
                      {!f.transfersPending && !f.toReview ? (
                        <span style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>Everything's reviewed and routed.</span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ), "span 2")}

            {/* ============ CALENDAR ============ */}
            {card("/calendar", (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <Eyebrow>Calendar</Eyebrow>
                  <OpenHint label="Open" />
                </div>
                {d.calendar.events.length ? (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {d.calendar.events.map((ev, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "8px 0", borderBottom: i < d.calendar.events.length - 1 ? "1px solid var(--border-hairline)" : "none" }}>
                        <span className="zt-num" style={{ flex: "none", width: 74, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: ev.chip === "Today" ? "var(--accent)" : "var(--text-tertiary)" }}>{ev.chip}</span>
                        <span style={{ flex: "none", width: 7, height: 7, borderRadius: 999, background: ev.color, position: "relative", top: -1 }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                        {ev.time ? <span className="zt-num" style={{ flex: "none", fontSize: 12, color: "var(--text-tertiary)" }}>{ev.time}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13.5, color: "var(--text-tertiary)", lineHeight: 1.55 }}>
                    {d.calendar.feedCount ? "Nothing on the schedule this week." : "Connect a Google Calendar feed to see the week here."}
                  </p>
                )}
              </div>
            ))}

            {/* ============ MEALS ============ */}
            {card("/meals", (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <Eyebrow>Dinner</Eyebrow>
                  <OpenHint label="Plan" />
                </div>
                {d.meals.tonight ? (
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Tonight</div>
                    <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)", lineHeight: 1.25 }}>
                      {d.meals.tonight.emoji ? `${d.meals.tonight.emoji} ` : ""}{d.meals.tonight.name}
                    </div>
                    {d.meals.tonight.note ? <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 5 }}>{d.meals.tonight.note}</div> : null}
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>Tonight</div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-secondary)" }}>Nothing planned yet</div>
                  </div>
                )}
                {d.meals.upcoming.length ? (
                  <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
                    {d.meals.upcoming.map((m, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "7px 0", borderTop: "1px solid var(--border-hairline)" }}>
                        <span className="zt-num" style={{ flex: "none", width: 74, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>{m.chip}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.emoji ? `${m.emoji} ` : ""}{m.name}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {/* ============ GROCERIES ============ */}
            {card("/groceries", (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <Eyebrow>Groceries</Eyebrow>
                  <OpenHint label="Open list" />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span className="zt-num" style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: "var(--text-primary)" }}>{d.groceries.listCount}</span>
                  <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>item{d.groceries.listCount === 1 ? "" : "s"} on the list</span>
                </div>
                {d.groceries.lowCount ? (
                  <div style={{ fontSize: 12.5, color: "var(--warning)", lineHeight: 1.5 }}>
                    {d.groceries.lowCount} running low{d.groceries.lowNames.length ? ` — ${d.groceries.lowNames.join(", ")}${d.groceries.lowCount > d.groceries.lowNames.length ? "…" : ""}` : ""}
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>Pantry's stocked.</div>
                )}
              </div>
            ))}

            {/* ============ TASKS (coming soon) ============ */}
            <div className="hq-card" aria-disabled style={{ background: "var(--surface-card)", border: "1px dashed var(--border-hairline)", borderRadius: "var(--radius-lg, 18px)", padding: "clamp(18px, 2.5vw, 24px)", opacity: 0.55 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                <Eyebrow>Tasks</Eyebrow>
                <span className="zt-eyebrow" style={{ border: "1px solid var(--border-hairline)", borderRadius: 999, padding: "3px 9px" }}>Soon</span>
              </div>
              <p style={{ fontSize: 13.5, color: "var(--text-tertiary)", lineHeight: 1.55 }}>Chores, to-dos, and who owns what.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
