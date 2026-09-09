/**
 * Guard: client components may import only TYPES from src/db. A runtime import
 * drags the Postgres client into the browser bundle ("Can't resolve 'fs'").
 * Bit us twice in the revamp — never again.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("client components", () => {
  it("import only types from @/db", () => {
    const files = walk(join(__dirname, "..", "app")).concat(walk(join(__dirname, "..", "components")), walk(join(__dirname, "..", "ui")));
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (!/^\s*["']use client["']/m.test(src)) continue;
      for (const m of src.matchAll(/^import\s+(?!type\s)([^;]*?)\s+from\s+["']@\/db\/[^"']+["']/gm)) {
        const spec = m[1];
        // `import { type A, type B }` is fine; anything without `type` on every name is not.
        const names = spec.replace(/[{}]/g, "").split(",").map((x) => x.trim()).filter(Boolean);
        if (names.some((n) => !n.startsWith("type "))) offenders.push(`${f.split("/src/")[1]}: ${m[0].trim().slice(0, 100)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
