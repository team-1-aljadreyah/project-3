// Runs after `npm run build:static` (npm calls "postbuild:static" by itself).
// Next.js writes the small data files it preloads for each page into folders:
//   out/dashboard/__next.!KHNp…/dashboard/__PAGE__.txt
// but the browser asks for them with dots instead of the inner slashes:
//   /dashboard/__next.!KHNp….dashboard.__PAGE__.txt
// A Node server answers both; a static host (Cloudflare Pages) only has the files. This writes a copy of each one under
// the dotted name, next to its folder, so every preload finds its file (no 404s, no wasted requests).
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "out";
if (!existsSync(root)) {
  console.error(`No ${root} folder. Run \`npm run build:static\` first.`);
  process.exit(1);
}

function* filesIn(dir, parts = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* filesIn(path, [...parts, name]);
    else yield { path, parts: [...parts, name] };
  }
}

let copies = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      for (const f of filesIn(path)) {
        copyFileSync(f.path, join(dir, [name, ...f.parts].join(".")));
        copies++;
      }
    } else walk(path);
  }
}
walk(root);
console.log(`Preload files: ${copies} copies under the names the browser asks for.`);
