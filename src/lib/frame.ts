/**
 * Server-side context for the app frame: who is signed in (as the frame shows
 * them), their unread count, and their theme preference. One small query set,
 * all defensive — pages call this and pass the result to <AppFrame>.
 */
import type { CurrentUser } from "@/lib/auth";
import { frameUser, type FrameUser } from "@/lib/frame-user";
import { getPerson } from "@/db/profiles";
import { unreadCount } from "@/db/notifications";

export interface FrameContext extends FrameUser {
  unread: number;
  theme: "light" | "dark" | "system";
  kind: "adult" | "child";
}

export async function frameContext(user: CurrentUser | null | undefined): Promise<FrameContext> {
  const base = frameUser(user);
  const [person, unread] = await Promise.all([
    getPerson(user?.memberId).catch(() => null),
    unreadCount({ memberId: user?.memberId ?? null, role: user?.role ?? "owner" }).catch(() => 0),
  ]);
  return {
    ...base,
    name: person?.greetingName || base.name,
    person: person?.hue ?? base.person,
    src: person?.avatarUrl ?? null,
    unread,
    theme: person?.theme ?? "system",
    kind: person?.kind ?? "adult",
  };
}
