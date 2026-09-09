import type { Resend } from "resend";

/**
 * Resend email client (server-only). The API key is injected at runtime on
 * Vercel; blank locally, so sending degrades to a no-op (`skipped`) — mirroring
 * the push layer. Sender must be on a domain verified in Resend.
 */
const KEY = process.env.RESEND_API_KEY || "";

export const isEmailConfigured = Boolean(KEY);

// The SDK loads on first send, not at import: this module is reached from
// the finance model (isEmailConfigured), so a static import put Resend in
// every page's server bundle and on every cold start.
let _resend: Resend | null = null;
async function client(): Promise<Resend | null> {
  if (!KEY) return null;
  if (!_resend) { const { Resend } = await import("resend"); _resend = new Resend(KEY); }
  return _resend;
}
/** "Display Name <addr@verified-domain>". Sends from archaflow.com, which is
 *  already verified in Resend — so RESEND_API_KEY must be a key from that same
 *  Resend account. Override via EMAIL_FROM if you verify another domain. */
export const EMAIL_FROM = process.env.EMAIL_FROM || "Zitting HQ <noreply@archaflow.com>";
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "jared@vectorux.com";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zitting-hq.vercel.app";

export async function sendEmail(args: { to: string; subject: string; html: string; text?: string }) {
  const resend = await client();
  if (!resend) return { ok: false as const, skipped: true as const };
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: data?.id ?? null };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
