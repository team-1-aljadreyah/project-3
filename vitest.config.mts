import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the rules and helpers (no browser). Browser tests are in tests/e2e (Playwright).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
