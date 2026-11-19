// Fails if the demo data reached a REAL build (NEXT_PUBLIC_USE_MOCK not "true").
// Run after `npm run build` of the real site: `node scripts/check-no-demo.mjs`.
// The demo accounts and password must never be in the real site's files: not in what visitors download
// (.next/static) and not in what the server runs (.next/server).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = [".next/static", ".next/server"];
const FORBIDDEN = ["@demo.test", "DEMO_PASSWORD", "demoAccounts"];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|html|rsc)$/.test(path)) yield path;
  }
}

const missing = ROOTS.filter((r) => !existsSync(r));
if (missing.length) {
  console.error(`No build found (${missing.join(", ")}). Run \`npm run build\` first.`);
  process.exit(1);
}

const found = [];
let count = 0;
for (const root of ROOTS) {
  for (const file of files(root)) {
    count++;
    const text = readFileSync(file, "utf8");
    for (const word of FORBIDDEN) if (text.includes(word)) found.push(`${file}: ${word}`);
  }
}

if (found.length) {
  console.error("Demo data found in the real build:\n" + found.join("\n"));
  process.exit(1);
}
console.log(`OK: no demo accounts in the real build (${count} files checked).`);
