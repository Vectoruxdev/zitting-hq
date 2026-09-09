/**
 * The signed-in person as the app frame needs it. Server-safe (no "use client")
 * so server pages can build it and pass it to <AppFrame> as plain props.
 */
import type { Role } from "@/lib/modules";

export interface FrameUser {
  name: string;
  role: Role;
  /** 1–6 family hue for the avatar fallback. */
  person: number;
  src?: string | null;
}

/** Stable 1–6 hue from a member id/email — until profiles carry a chosen hue (Phase 1). */
export function personIndex(key: string | null | undefined): number {
  const s = key || "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

export function frameUser(user: { name: string; role: Role; memberId: string | null; email?: string } | null | undefined): FrameUser {
  return { name: user?.name || "there", role: user?.role || "owner", person: personIndex(user?.memberId || user?.email) };
}
