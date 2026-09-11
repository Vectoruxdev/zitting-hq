/**
 * Cleaning view models — pure (no database), shared by the server page, Home
 * and the client screens. Types for lists/tasks/completions/hand-offs, the
 * "what is open today and whose is it" resolver, per-person day stats and
 * streaks. The rhythm maths is in schedule.ts. Lives under lib/ (not db/) so client screens can import it.
 */
import { addDays, assigneeFor, occurrenceOn, type Occurrence, type Scheduled, type TimeOfDay } from "./schedule";

export type ListVisibility = "family" | "personal";
export interface CleaningList { id: string; name: string; icon: string | null; tint: string | null; visibility: ListVisibility; ownerMemberId: string | null; remindTime: string | null; sort: number; createdBy: string | null }
export interface CleaningTask extends Scheduled { listId: string; title: string; icon: string | null; notes: string | null; timeOfDay: TimeOfDay; points: number; needsCheck: boolean; sort: number; createdBy: string | null }
export interface CleaningCompletion { id: number; taskId: string; periodKey: string; memberId: string | null; doneAt: string | null; checkedBy: string | null; checkedAt: string | null }
export interface Handoff { taskId: string; periodKey: string; memberId: string; byMemberId: string | null }

export const TIME_ORDER: TimeOfDay[] = ["morning", "afternoon", "evening", "any"];
/** Icons the kit has (see ui/core/Icon.tsx). */
export const TASK_ICONS = ["sparkles", "droplets", "wind", "trash-2", "bed", "utensils", "cooking-pot", "refrigerator", "snowflake", "leaf", "car", "sun", "moon", "house", "book-open", "shopping-basket", "baby", "star", "heart", "activity", "clipboard-list", "folder", "lightbulb", "gift", "dumbbell", "school", "square-check"];
export const LIST_ICONS = ["sparkles", "house", "sun", "calendar-days", "user", "baby", "star", "clipboard-list", "leaf", "moon"];
export const LIST_TINTS = ["butter", "coral", "mint", "sky", "lilac", "rose"] as const;
export type ListTint = (typeof LIST_TINTS)[number];
/** Family-local HH:MM the morning digest goes out when a list has no time of its own. */
export const DEFAULT_REMIND_TIME = "08:00";

/** Family lists, plus the personal lists that belong to this person. */
export function visibleLists(lists: CleaningList[], memberId: string | null): CleaningList[] {
  return lists.filter((l) => l.visibility === "family" || (!!memberId && l.ownerMemberId === memberId));
}

export interface OpenItem { task: CleaningTask; list: CleaningList; occ: Occurrence; assignee: string | null; completion: CleaningCompletion | null; handoff: Handoff | null }

/** Every occurrence open on a day (for the lists given), with who it falls to and whether it's done. */
export function openOn(dayISO: string, tasks: CleaningTask[], lists: CleaningList[], completions: CleaningCompletion[], handoffs: Handoff[]): OpenItem[] {
  const listById = new Map(lists.map((l) => [l.id, l]));
  const out: OpenItem[] = [];
  for (const task of tasks) {
    const list = listById.get(task.listId);
    if (!list) continue;
    const occ = occurrenceOn(task, dayISO);
    if (!occ) continue;
    const handoff = handoffs.find((h) => h.taskId === task.id && h.periodKey === occ.periodKey) ?? null;
    const completion = completions.find((c) => c.taskId === task.id && c.periodKey === occ.periodKey) ?? null;
    out.push({ task, list, occ, assignee: assigneeFor(task, occ.periodKey, handoff?.memberId), completion, handoff });
  }
  const P = { day: 0, week: 1, month: 2, once: 0 };
  return out.sort((a, b) => P[a.occ.period] - P[b.occ.period] || a.list.sort - b.list.sort || a.list.name.localeCompare(b.list.name) || TIME_ORDER.indexOf(a.task.timeOfDay) - TIME_ORDER.indexOf(b.task.timeOfDay) || a.task.sort - b.task.sort || a.task.title.localeCompare(b.task.title));
}

/** A person's day-period tasks on a day: how many, how many done, points (a task that needs a check counts once checked). */
export function dayStats(items: OpenItem[], memberId: string): { due: number; done: number; points: number; possible: number } {
  const mine = items.filter((i) => i.occ.period === "day" && i.assignee === memberId);
  const done = mine.filter((i) => i.completion);
  const counted = done.filter((i) => !i.task.needsCheck || i.completion?.checkedAt);
  return { due: mine.length, done: done.length, points: counted.reduce((a, i) => a + i.task.points, 0), possible: mine.reduce((a, i) => a + i.task.points, 0) };
}

/** Consecutive days (ending today or yesterday) on which every day-period task assigned to the person was done. Days with nothing due don't break it. */
export function streak(tasks: CleaningTask[], lists: CleaningList[], completions: CleaningCompletion[], handoffs: Handoff[], memberId: string, todayISO: string, maxDays = 120): number {
  const complete = (iso: string) => { const st = dayStats(openOn(iso, tasks, lists, completions, handoffs), memberId); return st.due ? st.done === st.due : null; };
  let d = todayISO, n = 0;
  if (complete(todayISO) === false) d = addDays(todayISO, -1);
  for (let i = 0; i < maxDays; i++) {
    const r = complete(d);
    if (r === false) break;
    if (r === true) n++;
    d = addDays(d, -1);
  }
  return n;
}
