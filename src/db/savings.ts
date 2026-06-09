/**
 * Savings goal logic (pure). Two concerns:
 *
 *  1. `projectGoal` — the on-track math every savings app shares: given the
 *     amount saved, the target, an optional target date, and a planned monthly
 *     contribution, work out the required $/mo and an On-track / Ahead / At-risk
 *     status. (Same idea as YNAB/Monarch/Copilot.)
 *  2. `canViewGoal` — the per-goal visibility rule. A household goal is visible
 *     to everyone; a private goal only to its assigned members. Owners always
 *     see all (admin). Enforced server-side in getFinanceData so hidden goals
 *     never reach an unauthorized browser.
 *
 * Pure + deterministic (the caller passes `now`) so it's unit-testable, matching
 * the transfers.ts / detect.ts / categorize.ts pattern.
 */

export type GoalStatus = "complete" | "ahead" | "on-track" | "at-risk" | "none";

export interface GoalProjectionInput {
  saved: number;
  target: number;
  /** ISO YYYY-MM-DD, or null when the goal has no deadline. */
  targetDate?: string | null;
  /** Planned recurring monthly contribution. */
  autoContrib?: number;
}

export interface GoalProjection {
  pct: number; // 0..100, clamped
  remaining: number; // target − saved, floored at 0
  monthsLeft: number | null; // whole months until target date (null if no date)
  requiredPerMonth: number | null; // $/mo needed to hit the date (null if no date)
  status: GoalStatus;
}

/** Whole months from `now` to an ISO date, rounded up, floored at 0. */
export function monthsUntil(targetDate: string, now: Date): number {
  const t = new Date(targetDate + "T00:00:00");
  if (isNaN(t.getTime())) return 0;
  // Whole calendar months between the two month boundaries…
  const base = (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth());
  // …plus one if the target lands later in its month than today does (a partial
  // month still needs a contribution). An earlier day-of-month is already
  // accounted for by `base`.
  const extra = t.getDate() > now.getDate() ? 1 : 0;
  return Math.max(0, base + extra);
}

export function projectGoal(g: GoalProjectionInput, now: Date): GoalProjection {
  const saved = Number(g.saved) || 0;
  const target = Number(g.target) || 0;
  const autoContrib = Number(g.autoContrib) || 0;
  const remaining = Math.max(0, target - saved);
  const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

  if (saved >= target && target > 0) {
    return { pct: 100, remaining: 0, monthsLeft: null, requiredPerMonth: null, status: "complete" };
  }

  if (!g.targetDate) {
    return { pct, remaining, monthsLeft: null, requiredPerMonth: null, status: "none" };
  }

  const monthsLeft = monthsUntil(g.targetDate, now);
  // No time left but still short → at risk. Otherwise required = remaining/months.
  const requiredPerMonth = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;

  let status: GoalStatus;
  if (monthsLeft <= 0) {
    status = "at-risk"; // deadline reached/passed and not complete
  } else if (autoContrib <= 0) {
    status = "at-risk"; // no funding plan to reach a dated goal
  } else if (autoContrib >= requiredPerMonth * 1.1) {
    status = "ahead";
  } else if (autoContrib >= requiredPerMonth * 0.95) {
    status = "on-track";
  } else {
    status = "at-risk";
  }

  return { pct, remaining, monthsLeft, requiredPerMonth, status };
}

export interface ViewerLike {
  role?: "owner" | "partner" | "member" | null;
  memberId?: string | null;
}

export interface GoalVisibility {
  visibility?: string | null; // "household" | "private"
  /** Member ids assigned to a private goal. */
  memberIds?: string[];
}

/**
 * Whether `viewer` may see `goal`.
 *  - Owners see everything (admin).
 *  - Household goals are visible to everyone.
 *  - Private goals are visible only to their assigned members.
 *
 * Default (no viewer) sees all, so server call sites that don't pass a viewer
 * (and the owner-facing Savings tab) behave as before.
 */
export function canViewGoal(goal: GoalVisibility, viewer?: ViewerLike | null): boolean {
  if (!viewer) return true;
  if (viewer.role === "owner") return true;
  if ((goal.visibility ?? "household") !== "private") return true;
  return !!viewer.memberId && (goal.memberIds ?? []).includes(viewer.memberId);
}
