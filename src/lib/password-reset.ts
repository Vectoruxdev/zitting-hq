/**
 * Password reset by email — the same recovery link Supabase would send, but
 * mailed by us (Resend) with our own words, and handed back as a copyable
 * link when email isn't set up. Server only.
 */
import { getAdminClient, SITE_URL } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export async function sendPasswordResetEmail(emailArg: string, opts?: { name?: string | null }): Promise<{ ok: boolean; sent: boolean; link: string | null; error: string | null }> {
  const to = (emailArg || "").trim().toLowerCase();
  if (!to) return { ok: false, sent: false, link: null, error: "No email on file." };
  const admin = getAdminClient();
  if (!admin) return { ok: false, sent: false, link: null, error: "Sign-in admin isn't configured on the server." };
  const redirectTo = `${SITE_URL}/auth/set-password`;
  const gen = await admin.auth.admin.generateLink({ type: "recovery", email: to, options: { redirectTo } });
  const link = gen.data?.properties?.action_link ?? null;
  if (!link) return { ok: false, sent: false, link: null, error: gen.error?.message || "Couldn't create a reset link." };
  if (!isEmailConfigured) return { ok: true, sent: false, link, error: "Email isn't set up yet — copy the link and send it yourself." };
  const first = (opts?.name || "").split(" ")[0];
  const subject = "Reset your Zitting HQ password";
  const html = `<!doctype html><html><body style="margin:0;background:#FBFAF7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
    <div style="font-size:20px;font-weight:700;color:#1B1A22;margin-bottom:10px;">Zitting <span style="color:#C8452F">HQ</span></div>
    <div style="background:#fff;border:1px solid #E8E4DC;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 10px;font-size:20px;color:#1B1A22;">${first ? `Hi ${first}, ` : ""}here’s your reset link</h1>
      <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#4A4855;">Tap below to choose a new password for Zitting HQ. If you didn’t ask for this, you can ignore it — nothing changes until you set a new one.</p>
      <a href="${link}" style="display:inline-block;background:#C8452F;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:999px;">Choose a new password</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#8A8794;">If the button doesn’t work, copy and paste this link:<br><span style="word-break:break-all;color:#4A4855;">${link}</span></p>
      <p style="margin:14px 0 0;font-size:12px;color:#8A8794;">The link expires after a while — if it has, ask for a fresh one from the sign-in page.</p>
    </div>
  </div></body></html>`;
  const text = `Reset your Zitting HQ password.\n\nChoose a new one here:\n${link}\n\nIf you didn't ask for this, ignore it — nothing changes until you set a new password.`;
  const res = await sendEmail({ to, subject, html, text });
  if (!res.ok) return { ok: true, sent: false, link, error: ("error" in res && res.error) || "Email couldn't be sent — copy the link and send it yourself." };
  return { ok: true, sent: true, link, error: null };
}
