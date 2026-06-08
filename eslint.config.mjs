import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored design-system prototype (components + screens authored by
    // Claude Design). Kept faithful to the handoff; not linted as app code.
    "src/finance/components/**",
    "src/finance/screens/**",
    "src/finance/assets/**",
  ]),
]);

export default eslintConfig;
