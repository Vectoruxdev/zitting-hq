import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Hands the client the VAPID PUBLIC key so it can subscribe to push. Read at
 * runtime from env (no rebuild needed when the key is set in Vercel) — the
 * public key is safe to expose; the private key never leaves the server.
 */
export async function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
}
