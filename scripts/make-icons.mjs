// Makes the app icons (PNG) from the logo «لوحة», the light board columns of src/app/icon.svg, on the wine tile:
//   public/icons/icon-192.png, icon-512.png    the tile with round corners (Android, desktop), transparent around it
//   public/icons/icon-maskable-512.png         a full wine square, the logo well inside the middle 80% circle, so any
//                                              mask shape (circle, squircle, teardrop) keeps all of it
//   public/icons/apple-touch-icon.png (180)    a full wine square; iPhone and iPad round the corners themselves
//   public/icons/badge-96.png                  the columns alone in white, for Android's status bar (notifications)
// It draws them with Playwright's browser (already a dev dependency), so no image package is needed. Run it again
// after the logo changes and commit the PNGs:  node scripts/make-icons.mjs
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const WINE = "#7c0e44";
const source = readFileSync("src/app/icon.svg", "utf8");
// The columns of the logo (the rects inside the <g>), in the logo's own 64×64 grid.
const columns = /<g[^>]*>([\s\S]*?)<\/g>/.exec(source)?.[1];
if (!columns) throw new Error("No <g> with the logo's columns in src/app/icon.svg");
// The columns' box in that grid is x 7–57, y 7–55: its middle is (32, 31).
const logo = (scale) => `<g transform="translate(${32 - 32 * scale} ${32 - 31 * scale}) scale(${scale})">${columns}</g>`;

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;
const ICONS = [
  // The tab icon as it is (round wine tile, logo at 75%).
  { file: "icon-192.png", size: 192, svg: source },
  { file: "icon-512.png", size: 512, svg: source },
  // The logo's corners stay inside the 80% circle (half its diagonal × 0.6 ≈ 21 of 25.6).
  { file: "icon-maskable-512.png", size: 512, svg: svg(`<rect width="64" height="64" fill="${WINE}"/>${logo(0.6)}`) },
  { file: "apple-touch-icon.png", size: 180, svg: svg(`<rect width="64" height="64" fill="${WINE}"/>${logo(0.68)}`) },
  // Android's small icon in the status bar next to a notification: only the shape counts (white on transparent).
  { file: "badge-96.png", size: 96, svg: svg(logo(1.1).replace(/fill="#[0-9a-f]+"/gi, 'fill="#ffffff"')) },
];

const out = join("public", "icons");
mkdirSync(out, { recursive: true });

// Playwright's own Chromium if it is installed, else the computer's Chrome.
const browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  const markup = icon.svg.replace("<svg ", `<svg width="${icon.size}" height="${icon.size}" `);
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await page.screenshot({ path: join(out, icon.file), omitBackground: true, clip: { x: 0, y: 0, width: icon.size, height: icon.size } });
  console.log(`${join(out, icon.file)} (${icon.size}×${icon.size})`);
}
await browser.close();
