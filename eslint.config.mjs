import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "coverage/**", "playwright-report/**", "test-results/**"]),
  // Next.js: its own rules (links, images, scripts), React, the rules of hooks, imports, and basic accessibility.
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended, // plain JavaScript mistakes
      tseslint.configs.recommended, // TypeScript mistakes
    ],
    // Next.js already loads the hooks and accessibility plugins: these turn on ALL their recommended rules (stricter
    // than Next's defaults), as before the move to Next.js.
    rules: {
      ...reactHooks.configs.flat.recommended.rules, // hooks only at the top of a component, the right deps
      ...jsxA11y.flatConfigs.recommended.rules, // accessibility: labels, roles, keyboard
      // An empty catch is on purpose here: the browser may refuse storage (private mode), and the app carries on.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
    languageOptions: { globals: globals.browser },
  },
  {
    // Config files and scripts run in Node, not the browser.
    files: ["*.{ts,mts,mjs}", "scripts/**", "tests/**"],
    languageOptions: { globals: globals.node },
  },
]);
