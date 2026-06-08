/**
 * Executes a .sql file against the database. Used to apply
 * supabase-categories-import.sql when a real connection string is available
 * locally (Vercel marks the integration's creds "sensitive", so they pull
 * blank — set DIRECT_URL or DATABASE_URL in .env.local first).
 *
 * Run: pnpm db:run supabase-categories-import.sql
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import postgres from "postgres";

const url =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

const file = process.argv[2];
if (!url) {
  console.error("✗ No DB URL. Add DIRECT_URL (or DATABASE_URL) to .env.local — Supabase → Connect → copy the connection string (with password).");
  process.exit(1);
}
if (!file) {
  console.error("✗ Usage: pnpm db:run <file.sql>");
  process.exit(1);
}

async function main() {
  const sqlText = readFileSync(file, "utf8");
  const client = postgres(url!, { prepare: false, max: 1 });
  console.log(`→ Running ${file} (${sqlText.length} chars)…`);
  await client.unsafe(sqlText);
  console.log("✓ SQL applied.");
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Failed:", err.message || err);
  process.exit(1);
});
