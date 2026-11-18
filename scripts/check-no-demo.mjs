// Fails if the demo data reached a REAL build (VITE_USE_MOCK not "true").
// Run after `npm run build` of the real site: `node scripts/check-no-demo.mjs`.
// The demo accounts and password must never be in the files real visitors download.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "dist";
const FORBIDDEN = ["@demo.test", "DEMO_PASSWORD", "demoAccounts"];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (path.endsWith(".js")) yield path;
  }
}

const found = [];
for (const file of files(ROOT)) {
  const text = readFileSync(file, "utf8");
  for (const word of FORBIDDEN) if (text.includes(word)) found.push(`${file}: ${word}`);
}

if (found.length) {
  console.error("Demo data found in the real build:\n" + found.join("\n"));
  process.exit(1);
}
console.log("OK: no demo accounts in the real build.");
