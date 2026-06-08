import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load local env for CLI commands (drizzle-kit runs outside Next).
config({ path: ".env.local" });

// For schema push/migrate prefer a direct (non-pooled) connection if provided
// (Supabase: port 5432). Falls back to DATABASE_URL.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: url ?? "" },
  strict: true,
  verbose: true,
});
