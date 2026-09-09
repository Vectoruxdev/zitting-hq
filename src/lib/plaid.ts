/**
 * Plaid client + config. Reads credentials from env (never hard-coded — the
 * repo is public). Environment-switchable via PLAID_ENV (sandbox | production)
 * so we can prove the flow against a fake bank and flip to real banks by
 * changing one variable.
 */
import type { PlaidApi, Products, CountryCode } from "plaid";

const ENV = (process.env.PLAID_ENV || "production").toLowerCase();
// Mirrors PlaidEnvironments without importing the SDK at module load.
const BASE_PATHS: Record<string, string> = { production: "https://production.plaid.com", development: "https://development.plaid.com", sandbox: "https://sandbox.plaid.com" };
const basePath = BASE_PATHS[ENV] || BASE_PATHS.production;

export const isPlaidConfigured = Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);

export const PLAID_PRODUCTS: Products[] = ["transactions" as Products];
export const PLAID_COUNTRY_CODES: CountryCode[] = ["US" as CountryCode];

/** Public base URL (for the Plaid webhook + OAuth redirect). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zitting-hq.vercel.app";
export const PLAID_WEBHOOK_URL = `${SITE_URL}/api/plaid/webhook`;

let _client: PlaidApi | null = null;
/** The SDK (axios + a large generated client) loads on first use, not at import. */
export async function getPlaid(): Promise<PlaidApi | null> {
  if (!isPlaidConfigured) return null;
  if (!_client) {
    const { Configuration, PlaidApi } = await import("plaid");
    _client = new PlaidApi(
      new Configuration({
        basePath,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": process.env.PLAID_SECRET,
          },
          // Hard cap per Plaid call. Without it axios waits FOREVER: one hung
          // MACU balance pull ran the sync function into Vercel's kill switch,
          // so no catch fired, no status/error/lastSyncedAt was written, and
          // the bank sat "Active / last synced days ago" while every sync
          // (cron + manual) silently died. 30s lets the existing per-call
          // try/catch fallbacks actually run instead.
          timeout: 30_000,
        },
      })
    );
  }
  return _client;
}

export const PLAID_ENV = ENV;
