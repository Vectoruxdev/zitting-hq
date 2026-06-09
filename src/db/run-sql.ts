/**
 * Executes a .sql file against the database. Used to apply
 * supabase-categories-import.sql when a real connection string is available
 * locally (Vercel marks the integration's creds "sensitive", so they pull
 * blank — set DIRECT_URL or DATABASE_URL in .env.local first).
 *
 * Run: pnpm db:run supabase-categories-import.sql
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

// Parse .env.local directly. We don't use dotenv's process.env injection here:
// Vercel-style vars are often present-but-blank in the shell (which dotenv
// won't override), and we want the real values the file holds. Reading the file
// ourselves is deterministic regardless of the dotenv variant installed.
function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = parseEnvFile(".env.local");
const pick = (k: string) => {
  const fromShell = process.env[k];
  if (fromShell && fromShell.length) return fromShell;
  return fileEnv[k] || undefined;
};

// Prefer a direct (non-pooled) connection for DDL.
const url =
  pick("DIRECT_URL") ||
  pick("POSTGRES_URL_NON_POOLING") ||
  pick("DATABASE_URL") ||
  pick("POSTGRES_URL");

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
