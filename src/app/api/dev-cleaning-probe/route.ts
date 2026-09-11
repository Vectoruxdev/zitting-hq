import { NextResponse } from "next/server";
import * as k from "@/db/cleaning";
import { touchedByJob } from "@/lib/cache";

// TEMPORARY (removed before merge): preview-deployment write-path probe for the
// cleaning tables — creates a list + task, exercises every writer, deletes it all.
export const dynamic = "force-dynamic";
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") return new NextResponse(null, { status: 404 });
  const out: Record<string, unknown> = {};
  const listId = `probe-${Date.now()}`;
  const taskId = `${listId}-t1`;
  try {
    await k.createList({ id: listId, name: "Probe list", icon: "sparkles", tint: "mint", visibility: "family", createdBy: null });
    await k.createTask({ id: taskId, listId, title: "Probe task", icon: "droplets", rhythm: { type: "every_weeks", n: 2, weekday: 6, anchor: "2026-09-08" }, assign: { mode: "rotation", memberIds: ["jared", "ececd060-fdc4-4d20-9d92-addb739394c9"], anchor: "2026-09-06" }, timeOfDay: "morning", points: 2, needsCheck: true, createdBy: null });
    touchedByJob("chores");
    const data = await k.loadCleaning("2026-09-10");
    out.readBack = { lists: data.lists.filter((l) => l.id === listId).length, task: data.tasks.find((t) => t.id === taskId) };
    const cid = await k.completeTask(taskId, "2026-09-06", "jared");
    const cid2 = await k.completeTask(taskId, "2026-09-06", "jared");
    await k.checkCompletion(cid, "jared", true);
    await k.setHandoff(taskId, "2026-09-20", "ececd060-fdc4-4d20-9d92-addb739394c9", "jared");
    await k.setHandoff(taskId, "2026-09-20", "jared", "jared");
    touchedByJob("chores");
    const after = await k.loadCleaning("2026-09-10");
    out.afterWrites = { completion: after.completions.find((c) => c.taskId === taskId), sameId: cid === cid2, handoff: after.handoffs.find((h) => h.taskId === taskId) };
    await k.uncompleteTask(taskId, "2026-09-06");
    await k.setHandoff(taskId, "2026-09-20", null, null);
    await k.updateTask(taskId, { title: "Probe task (renamed)", active: false, notes: "  trimmed  " });
    await k.updateList(listId, { name: "Probe list (renamed)", remindTime: "07:30" });
    touchedByJob("chores");
    const mid = await k.loadCleaning("2026-09-10");
    out.afterUpdates = { task: mid.tasks.find((t) => t.id === taskId), list: mid.lists.find((l) => l.id === listId), completions: mid.completions.filter((c) => c.taskId === taskId).length, handoffs: mid.handoffs.filter((h) => h.taskId === taskId).length };
  } catch (e) {
    out.error = e instanceof Error ? `${e.message} ${(e as { cause?: { message?: string } }).cause?.message ?? ""}` : String(e);
  } finally {
    await k.deleteList(listId).catch((e) => { out.cleanupError = String(e); });
    touchedByJob("chores");
    const end = await k.loadCleaning("2026-09-10");
    out.cleanedUp = { lists: end.lists.filter((l) => l.id === listId).length, tasks: end.tasks.filter((t) => t.id === taskId).length };
  }
  return NextResponse.json(out);
}
