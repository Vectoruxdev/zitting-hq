/**
 * Plaid client + config. Reads credentials from env (never hard-coded — the
 * repo is public). Environment-switchable via PLAID_ENV (sandbox | production)
 * so we can prove the flow against a fake bank and flip to real banks by
 * changing one variable.
 */
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

const ENV = (process.env.PLAID_ENV || "production").toLowerCase();
const basePath = PlaidEnvironments[ENV] || PlaidEnvironments.production;

export const isPlaidConfigured = Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);

export const PLAID_PRODUCTS: Products[] = [Products.Transactions];
export const PLAID_COUNTRY_CODES: CountryCode[] = [CountryCode.Us];

/** Public base URL (for the Plaid webhook + OAuth redirect). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zitting-hq.vercel.app";
export const PLAID_WEBHOOK_URL = `${SITE_URL}/api/plaid/webhook`;

let _client: PlaidApi | null = null;
export function getPlaid(): PlaidApi | null {
  if (!isPlaidConfigured) return null;
  if (!_client) {
    _client = new PlaidApi(
      new Configuration({
        basePath,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": process.env.PLAID_SECRET,
          },
        },
      })
    );
  }
  return _client;
}

export const PLAID_ENV = ENV;
