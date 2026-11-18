import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**", "coverage/**", "playwright-report/**", "test-results/**"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended, // plain JavaScript mistakes
      tseslint.configs.recommended, // TypeScript mistakes
      reactHooks.configs.flat.recommended, // the rules of hooks (only at the top of a component, the right deps)
      reactRefresh.configs.vite, // files that fast refresh can update without a full reload
      jsxA11y.flatConfigs.recommended, // accessibility: labels, roles, keyboard
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      // An empty catch is on purpose here: the browser may refuse storage (private mode), and the app carries on.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // Config files and scripts run in Node, not the browser.
    files: ["*.{ts,mts,mjs}", "scripts/**", "tests/**"],
    languageOptions: { globals: globals.node },
  },
]);
