import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors tsconfig's `@/*` → `src/*` so modules that import through the alias
// (the Phase 1 data layers and everything after) are testable.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
