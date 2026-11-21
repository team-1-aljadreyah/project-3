// Serves the plain-files build (out/) the way Cloudflare Pages does, so it can be tried and tested on this computer:
// files as they are, "/x" also as x.html or x/index.html, the rewrite rules of out/_redirects ("200" rules only),
// and 404.html for anything else; the headers of out/_headers, and text files compressed (gzip) like Cloudflare does,
// so Lighthouse measures what real visitors get. No packages needed.
// usage: node scripts/serve-static.mjs [port=3100] [folder=out]
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { createGzip } from "node:zlib";

const port = Number(process.argv[2] ?? 3100);
const root = resolve(process.argv[3] ?? "out");
if (!existsSync(root)) {
  console.error(`No ${root} folder. Run \`npm run build:static\` first.`);
  process.exit(1);
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff" };

// The "200" rules of _redirects: "/projects/:id/*  /projects/_/:splat  200". A ":name" is one part of the address,
// a "*" at the end is the rest (":splat" in the target), like Cloudflare.
const rules = existsSync(join(root, "_redirects"))
  ? readFileSync(join(root, "_redirects"), "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split(/\s+/))
      .filter((p) => p[2] === "200")
      .map(([from, to]) => ({ re: new RegExp("^" + from.replace(/:([a-z]+)/gi, "(?<$1>[^/]+)").replace(/\*$/, "(?<splat>.*)") + "/?$"), to }))
  : [];
// out/_headers: a "/path" or "/path/*" line, then indented "Name: value" lines for those addresses.
const headerRules = [];
if (existsSync(join(root, "_headers"))) {
  for (const line of readFileSync(join(root, "_headers"), "utf8").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      const pattern = line.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      headerRules.push({ re: new RegExp(`^${pattern}$`), set: {} });
    } else if (headerRules.length) {
      const at = line.indexOf(":");
      headerRules.at(-1).set[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
  }
}
const headersFor = (path) => Object.assign({}, ...headerRules.filter((r) => r.re.test(path)).map((r) => r.set));
const TEXT = new Set([".html", ".js", ".css", ".json", ".txt", ".svg"]);

const target = (rule, path) => rule.to.replace(/:([a-z]+)/gi, (_, name) => rule.re.exec(path).groups?.[name] ?? "");

/** The file for an address: as it is, then .html, then /index.html. */
function fileFor(path) {
  const base = normalize(join(root, decodeURIComponent(path)));
  if (!base.startsWith(root)) return null;
  for (const f of [base, base + ".html", join(base, "index.html")]) if (existsSync(f) && statSync(f).isFile()) return f;
  return null;
}

createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  let file = fileFor(path);
  if (!file) {
    const rule = rules.find((r) => r.re.test(path));
    if (rule) file = fileFor(target(rule, path));
  }
  const status = file ? 200 : 404;
  file ??= fileFor("/404");
  if (!file) return res.writeHead(404).end("Not found");
  const headers = { ...headersFor(path), "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" };
  if (TEXT.has(extname(file)) && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
    res.writeHead(status, { ...headers, "Content-Encoding": "gzip", Vary: "Accept-Encoding" });
    return createReadStream(file).pipe(createGzip()).pipe(res);
  }
  res.writeHead(status, headers);
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
