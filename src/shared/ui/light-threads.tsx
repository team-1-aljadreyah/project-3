import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";

/** One point along the ribbon: its centre, then the direction and reach of its width there (px). */
type Station = [cx: number, cy: number, ux: number, uy: number];
interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}

/** The threads are drawn as points this far apart (px). */
const STEP = 7;
/** How long the soft end of the threads is, where they fade out as they drop (px). Also in app/styles.css. */
const FADE = 220;
const TAU = Math.PI * 2;

// The knot and its two arms, as measured on the reference: px at the reference's size, from the knot, with +x toward the
// side the window is on. The fan arrives from above, every thread turns round the knot, and the arm leaves in an S.
const FAN: Station[] = [
  [600, -500, 235, 280],
  [290, -265, 100, 125],
  [142, -166, 58, 48],
  [78, -103, 33, 15],
  [36, -53, 14, 5],
];
const KNOT: Station = [-4, 0, 9, 1];
const ARM: Station[] = [
  [20, 22, 10, -10],
  [65, 42, 15, -15],
  [125, 62, 25, -20],
  [210, 90, 40, -22],
  [290, 132, 60, -20],
  [348, 206, 92, -24],
  [371, 315, 113, 0],
  [364, 410, 114, 0],
  [350, 505, 105, 0],
];

// The brand palette. Most threads are blush and dusty rose; a few run in mauve and wine, the way the reference mixes a
// second colour into the bundle.
const MAIN = ["#d49a9a", "#d49a9a", "#e6b5ae", "#f2dace", "#c98795"];
const ACCENT = ["#aa5e7a", "#b8387a", "#aa5e7a", "#8f1f58"];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const find = (name: string) => document.querySelector<HTMLElement>(`[data-threads="${name}"]`);

/**
 * Where an element sits in the page's layout (px from the page's top-left), ignoring transforms: a block that is still
 * sliding, tilting or growing into place counts where it will end up.
 */
function layoutBox(el: HTMLElement): Box {
  let l = 0;
  let t = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) {
    l += e.offsetLeft;
    t += e.offsetTop;
  }
  return { l, r: l + el.offsetWidth, t, b: t + el.offsetHeight };
}

/** The same "random" numbers every time, so the threads don't reshuffle when the page is measured again. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The ribbon's route down the page, placed from the page's own blocks (`data-threads="text" | "window" | "soft" |
 * "grid"`), so it fits any screen:
 * a fan comes in from the top corner on the window's side, every thread turns round a bright knot between the text and
 * the window, and the arm drops away in an S under the window. It crosses back through the soft (frosted) section to a
 * second knot on the text's side, swoops across the last section, loops off the edge, and comes back as a wavy band
 * along the bottom. Returned in page px, with the two knots.
 */
function route(w: number, pageH: number): { stations: Station[]; knots: [number, number, number][] } {
  const T = find("text");
  const W = find("window");
  const Z = find("soft");
  const G = find("grid");
  const tb = T ? layoutBox(T) : { l: w * 0.08, r: w * 0.45, t: 120, b: 600 };
  const wb = W ? layoutBox(W) : { l: w * 0.55, r: w * 0.92, t: 140, b: 430 };
  const u = clamp(w / 1480, 0.5, 1.35);
  // Side by side (a computer) or stacked (a phone)?
  const beside = wb.l >= tb.r - 4 || wb.r <= tb.l + 4;
  const rtl = getComputedStyle(document.documentElement).direction === "rtl";
  // +1: the window's side is the right-hand side; -1: the left (Arabic). Everything below is worked out as if it were
  // +1, measured from the text's edge of the page, and flipped at the end. Stacked (a phone), the knot goes in the
  // top corner the text does not start from, under the header, so the bright part stays off the headline.
  const side = beside ? (wb.l >= tb.r - 4 ? 1 : -1) : rtl ? 1 : -1;
  const local = (x: number) => (side > 0 ? x : w - x);

  const kx = beside ? (local(side > 0 ? tb.r : tb.l) + local(side > 0 ? wb.l : wb.r)) / 2 : w * 0.1;
  // Beside the window's lower part (measured from its top and width: its height can change with what it shows).
  const ky = beside ? wb.t + (wb.r - wb.l) * 0.46 : tb.t - 10 * u;
  const st: Station[] = [];
  const add = (cx: number, cy: number, ux: number, uy: number) => st.push([cx, cy, ux, uy]);
  for (const [cx, cy, ux, uy] of [...FAN, KNOT, ...ARM]) add(kx + cx * u, ky + cy * u, ux * u, uy * u);

  // The soft section and the last section (sensible places if the page has not marked them).
  const armEnd: [number, number] = [kx + 350 * u, ky + 505 * u];
  const zb = Z ? layoutBox(Z) : { l: 0, r: w, t: armEnd[1] + 120, b: armEnd[1] + 700 };
  const gb = G ? layoutBox(G) : { l: 0, r: w, t: zb.b, b: pageH - 80 };
  const zt = Math.max(zb.t, armEnd[1] + 60);
  const zh = Math.max(360, zb.b - zt);

  // The second knot: low in the soft section, on the text's side.
  const s2 = u * 1.1;
  const k2x = Math.max(70, w * 0.085);
  const k2y = zt + zh * 0.84;
  const fanIn: [number, number] = [k2x + FAN[2][0] * s2, k2y + FAN[2][1] * s2];
  // From the arm's end to the second knot's fan: a wide, loose stretch (it is the soft glow behind the middle of the
  // page), swinging from side to side when there is a long way to go (a phone).
  const gap = fanIn[1] - armEnd[1];
  const hops = Math.max(1, Math.round(gap / 520));
  for (let i = 1; i <= hops; i++) {
    const t = i / (hops + 1);
    const swing = hops > 1 ? Math.sin(t * Math.PI * hops) * w * 0.16 : 0;
    const x = lerp(armEnd[0], fanIn[0], t) + swing;
    const y = lerp(armEnd[1], fanIn[1], t);
    const dx = fanIn[0] - armEnd[0];
    const len = Math.hypot(dx, gap) || 1;
    // Across the flow, on the same side as before (so the ribbon turns without flipping over).
    add(x, y, (gap / len) * 150 * u, (-dx / len) * 150 * u);
  }
  for (const [cx, cy, ux, uy] of [...FAN.slice(2), KNOT, ...ARM.slice(0, 5)]) add(k2x + cx * s2, k2y + cy * s2, ux * s2, uy * s2);

  // The last section: a swoop that dips and rises to the window's side, a loop off the edge, and a wavy band back
  // along the bottom, between the last cards and the footer.
  const x1 = Math.max(w * 0.45, k2x + 420 * s2);
  const x2 = Math.max(w * 0.72, x1 + w * 0.22);
  const x3 = Math.max(w * 1.08, x2 + w * 0.25);
  const dip = k2y + 232 * s2;
  const band = Math.max(G ? gb.b - 50 : pageH - 150, dip + 300 * s2);
  add(x1, dip, 14 * s2, -92 * s2);
  add(x2, k2y + 196 * s2, -20 * s2, -120 * s2);
  add(x3, k2y + 70 * s2, -36 * s2, -140 * s2);
  add(x3 + w * 0.16, lerp(k2y + 70 * s2, band, 0.55), 60 * s2, 0);
  add(x3 + w * 0.02, band + 10 * s2, 0, 56 * s2);
  add(w * 0.82, band - 26 * s2, 0, 64 * s2);
  add(w * 0.55, band + 30 * s2, 0, 72 * s2);
  add(w * 0.28, band - 22 * s2, 0, 64 * s2);
  add(w * 0.02, band + 20 * s2, 0, 58 * s2);
  add(-w * 0.16, band - 8 * s2, 0, 54 * s2);

  const flip = (x: number) => (side > 0 ? x : w - x);
  return {
    stations: st.map(([cx, cy, ux, uy]) => [flip(cx), cy, side * ux, uy]),
    knots: [
      [flip(kx), ky, u],
      [flip(k2x), k2y, s2],
    ],
  };
}

/** A smooth line through the stations (a centripetal Catmull–Rom curve), as points about STEP px apart. */
function sample(st: Station[]): Float32Array[] {
  const out: number[][] = [[], [], [], []];
  const at = (i: number) => st[clamp(i, 0, st.length - 1)];
  const gapOf = (a: Station, b: Station) => Math.max(0.001, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
  for (let i = 0; i < st.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const t1 = gapOf(p0, p1);
    const t2 = t1 + gapOf(p1, p2);
    const t3 = t2 + gapOf(p2, p3);
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / STEP));
    for (let k = 0; k < steps; k++) {
      const t = t1 + ((t2 - t1) * k) / steps;
      for (let c = 0; c < 4; c++) {
        const a1 = ((t1 - t) / t1) * p0[c] + (t / t1) * p1[c];
        const a2 = ((t2 - t) / (t2 - t1)) * p1[c] + ((t - t1) / (t2 - t1)) * p2[c];
        const a3 = ((t3 - t) / (t3 - t2)) * p2[c] + ((t - t2) / (t3 - t2)) * p3[c];
        const b1 = ((t2 - t) / t2) * a1 + (t / t2) * a2;
        const b2 = ((t3 - t) / (t3 - t1)) * a2 + ((t - t1) / (t3 - t1)) * a3;
        out[c].push(((t2 - t) / (t2 - t1)) * b1 + ((t - t1) / (t2 - t1)) * b2);
      }
    }
  }
  return out.map((a) => Float32Array.from(a));
}

const canBlur = typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;

/** A smaller, blurred copy of a picture: `scale` times smaller, blurred by about `radius` of the original's pixels. */
function blurred(src: HTMLCanvasElement, scale: number, radius: number, under?: string, gain = 1): HTMLCanvasElement {
  const shrink = (from: HTMLCanvasElement, by: number) => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(from.width / by));
    c.height = Math.max(1, Math.round(from.height / by));
    const x = c.getContext("2d")!;
    x.imageSmoothingQuality = "high";
    x.drawImage(from, 0, 0, c.width, c.height);
    return c;
  };
  // Halve step by step (one big jump would skip pixels and leave the thin threads dotted).
  let small = src;
  let left = scale;
  while (left > 1.01) {
    const by = Math.min(2, left);
    small = shrink(small, by);
    left /= by;
  }
  const out = document.createElement("canvas");
  out.width = small.width;
  out.height = small.height;
  const x = out.getContext("2d")!;
  if (under) {
    x.fillStyle = under;
    x.fillRect(0, 0, out.width, out.height);
  }
  x.globalCompositeOperation = under ? "lighter" : "source-over";
  x.imageSmoothingQuality = "high";
  let soft = small;
  if (canBlur) x.filter = `blur(${(radius / scale).toFixed(2)}px)`;
  // No blur filter in this browser: shrink further and stretch back, which blurs about as much.
  else soft = shrink(small, clamp(radius / scale / 1.6, 1, 8));
  for (let g = gain; g > 0.01; g -= 1) {
    x.globalAlpha = Math.min(1, g);
    x.drawImage(soft, 0, 0, out.width, out.height);
  }
  return out;
}

/**
 * A bundle of fine threads of light behind the page, in the brand colours: a fan of threads turns round a bright knot
 * beside the hero's text, drops away in an S, and winds on down the whole page (see `route`). Specks of light sit among
 * them, a few twinkle, and now and then a glint runs along a thread. The threads' ends drop down the page as you
 * scroll, with a soft tip.
 *
 * Built to stay smooth on any computer:
 * - The threads are drawn ONCE onto a canvas as tall as the page; scrolling just moves the page.
 * - Frosted glass (`<Frost />` inside a card or a section) is a small blurred picture of the threads behind it, made
 *   once: no live blur.
 * - While scrolling, the only moving parts are a few "curtains" (blocks of the page's colour) that slide to uncover the
 *   threads, which the graphics card does for free, and a small canvas with the twinkles and glints.
 * The parent element must be `relative`, clip its overflow and set `--bg` (the page's colour).
 * `start`: the threads begin to drop when it turns true (after an intro, say). With "reduce motion" they are simply there.
 */
export function LightThreads({ start = true, className }: { start?: boolean; className?: string }) {
  const bodyRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const go = useRef(start);

  useEffect(() => {
    go.current = start;
  }, [start]);

  useEffect(() => {
    const body = bodyRef.current;
    const live = liveRef.current;
    const curtain = curtainRef.current;
    const bctx = body?.getContext("2d");
    const lctx = live?.getContext("2d");
    const host = body?.parentElement;
    if (!body || !live || !curtain || !bctx || !lctx || !host) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let pageH = 0;
    // What the moving parts need from the last drawing.
    let path: Float32Array[] = [];
    let runners: Float32Array[] = [];
    let specks: { x: number; y: number; r: number; a: number; phase: number; depth: number }[] = [];
    let frosts: { el: HTMLElement; curtain: HTMLElement | null; box: Box; at: number }[] = [];
    let drawn = false;

    const sizeLive = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = host.clientWidth;
      h = window.innerHeight;
      live.width = Math.round(w * dpr);
      live.height = Math.round(h * dpr);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** Measures the page, then draws the threads once and the frosted pictures. */
    function plan() {
      pageH = host!.offsetHeight;
      const phone = w < 640;
      // On a phone the threads run behind the text itself, so they are drawn fainter.
      const dim = phone ? 0.6 : 1;
      const rnd = seeded(11);
      const { stations, knots } = route(w, pageH);
      path = sample(stations);
      const [cx, cy, ux, uy] = path;
      const n = cx.length;

      // The threads: where each sits across the ribbon (they bunch into strands), how deep, how bright, which colour.
      const bunches = Array.from({ length: 9 }, () => ({ at: rnd() * 2 - 1, spread: 0.02 + rnd() * 0.07 }));
      const threads = Array.from({ length: phone ? 40 : 76 }, () => {
        const bunch = bunches[Math.floor(rnd() * bunches.length)];
        const a = rnd() < 0.3 ? rnd() * 2 - 1 : clamp(bunch.at + (rnd() + rnd() + rnd() - 1.5) * bunch.spread * 2, -1, 1);
        const tier = rnd();
        const accent = a > 0.02 && a < 0.42 && rnd() < 0.7;
        const palette = accent ? ACCENT : MAIN;
        return {
          a,
          b: rnd() * 2 - 1,
          phase: [rnd() * TAU, rnd() * TAU, 0, rnd() * 0.9],
          alpha: (tier < 0.16 ? 0.82 : tier < 0.6 ? 0.5 : 0.26) * (accent ? 1.2 : 1) * dim,
          width: tier < 0.16 ? 1.3 : tier < 0.6 ? 1 : 0.8,
          color: palette[Math.floor(rnd() * palette.length)],
          xy: new Float32Array(n * 2),
        };
      });
      for (const t of threads) {
        for (let i = 0; i < n; i++) {
          const s = i * STEP;
          // Each thread wanders a little across the ribbon and weaves round its neighbours, so they cross like hair.
          const a = t.a + 0.07 * Math.sin(s / 210 + t.phase[0]) + 0.03 * Math.sin(s / 117 + t.phase[1]);
          const weave = 0.07 * Math.hypot(ux[i], uy[i]) * t.b;
          const turn = s / 300 + t.phase[3];
          t.xy[i * 2] = cx[i] + a * ux[i] + weave * Math.cos(turn);
          t.xy[i * 2 + 1] = cy[i] + a * uy[i] + weave * Math.sin(turn);
        }
      }
      threads.sort((p, q) => p.alpha - q.alpha);
      runners = threads.filter((t) => t.width >= 1).map((t) => t.xy);

      // A page-tall canvas: sharp enough for hair-thin lines, but never more than about 10 million pixels.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(10e6 / Math.max(1, w * pageH)));
      body!.width = Math.round(w * dpr);
      body!.height = Math.round(pageH * dpr);
      body!.style.height = `${pageH}px`;
      const c = bctx!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, pageH);
      c.globalCompositeOperation = "lighter";
      c.lineJoin = "round";
      const trace = (xy: Float32Array) => {
        c.beginPath();
        c.moveTo(xy[0], xy[1]);
        for (let i = 2; i < xy.length; i += 2) c.lineTo(xy[i], xy[i + 1]);
        c.stroke();
      };
      // A soft halo under each of the brighter threads, then the threads themselves. Where many cross (the knots),
      // the light adds up to white.
      for (const t of threads) {
        if (t.width < 1) continue;
        c.strokeStyle = t.color;
        c.globalAlpha = t.alpha * 0.085;
        c.lineWidth = 5;
        trace(t.xy);
      }
      for (const t of threads) {
        c.strokeStyle = t.color;
        c.globalAlpha = Math.min(1, t.alpha);
        c.lineWidth = t.width;
        trace(t.xy);
      }
      // The glow of each knot: a wide wine haze, a rose halo, a white-hot core stretched along the turn.
      for (const [x, y, s] of knots) {
        for (const [radius, color, alpha, sx, sy] of [
          [330 * s, "124, 14, 68", 0.3, 1, 1],
          [140 * s, "212, 154, 154", 0.2, 1, 1.15],
          [30 * s, "255, 240, 232", 0.5, 0.6, 1.5],
        ] as const) {
          c.save();
          c.translate(x, y);
          c.scale(sx, sy);
          const glow = c.createRadialGradient(0, 0, 0, 0, 0, radius);
          glow.addColorStop(0, `rgba(${color}, ${alpha * dim})`);
          glow.addColorStop(0.4, `rgba(${color}, ${alpha * 0.34 * dim})`);
          glow.addColorStop(1, `rgba(${color}, 0)`);
          c.globalAlpha = 1;
          c.fillStyle = glow;
          c.fillRect(-radius, -radius, radius * 2, radius * 2);
          c.restore();
        }
      }
      // Bloom: two blurred copies of the whole drawing laid back over it, so the light spills softly.
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.imageSmoothingQuality = "high";
      c.globalAlpha = 0.4;
      c.drawImage(blurred(body!, 4 * dpr, 7 * dpr), 0, 0, body!.width, body!.height);
      c.globalAlpha = 0.45;
      c.drawImage(blurred(body!, 12 * dpr, 34 * dpr), 0, 0, body!.width, body!.height);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Specks of light among the threads (drawn after the bloom, so they stay crisp), and a few big soft ones.
      const dots = phone ? 520 : 1300;
      specks = [];
      for (let k = 0; k < dots; k++) {
        const i = Math.floor(rnd() * n);
        const wide = Math.hypot(ux[i], uy[i]);
        const a = (rnd() + rnd() + rnd() - 1.5) * 1.5;
        const x = cx[i] + a * ux[i] + (rnd() - 0.5) * 14;
        const y = cy[i] + a * uy[i] + (rnd() - 0.5) * 14;
        const big = rnd() < 0.045;
        const r = big ? 4 + rnd() * 8 : rnd() < 0.2 ? 1.2 + rnd() * 1.2 : 0.6 + rnd() * 0.6;
        const alpha = (big ? 0.05 + rnd() * 0.09 : 0.4 + rnd() * 0.6) * (phone ? 0.75 : 1);
        // Where the ribbon is pinched tight there is no room for specks.
        if (wide < 24 || rnd() > Math.min(1, wide / 90)) continue;
        // Some are kept for the moving canvas (they twinkle); the rest are drawn here for good.
        if (!big && !still && specks.length < (phone ? 26 : 70) && rnd() < 0.2) {
          specks.push({ x, y, r: r + 0.3, a: alpha, phase: rnd() * TAU, depth: 0.82 + rnd() * 0.4 });
          continue;
        }
        const dot = c.createRadialGradient(x, y, 0, x, y, r * 2.4);
        dot.addColorStop(0, `rgba(255, 238, 230, ${alpha})`);
        dot.addColorStop(big ? 0.7 : 0.35, `rgba(242, 218, 206, ${alpha * (big ? 0.8 : 0.3)})`);
        dot.addColorStop(1, "rgba(212, 154, 154, 0)");
        c.globalAlpha = 1;
        c.fillStyle = dot;
        c.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";

      // Frosted glass: each `<Frost />` gets a small blurred picture of exactly what is behind it, on the page's
      // colour. "glass" (a card) is lightly blurred; "soft" (a whole section) heavily, and brighter.
      const bg = getComputedStyle(host!).getPropertyValue("--bg").trim() || "#170d12";
      const pictures: Record<string, { img: HTMLCanvasElement; scale: number } | undefined> = {};
      frosts = [];
      for (const el of host!.querySelectorAll<HTMLElement>(".frost")) {
        const kind = el.dataset.frost === "soft" ? "soft" : "glass";
        const scale = kind === "soft" ? 8 : 4;
        const pic = (pictures[kind] ??= { img: blurred(body!, scale * dpr, (kind === "soft" ? 46 : 15) * dpr, bg, kind === "soft" ? 1.7 : 1.1), scale });
        const box = layoutBox(el);
        const canvas = el.querySelector("canvas");
        const x = canvas?.getContext("2d");
        if (canvas && x) {
          canvas.width = Math.max(1, Math.ceil((box.r - box.l) / scale));
          canvas.height = Math.max(1, Math.ceil((box.b - box.t) / scale));
          x.drawImage(pic.img, box.l / scale, box.t / scale, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        }
        const cover = el.querySelector<HTMLElement>("i");
        if (cover && !still) cover.style.display = "block";
        frosts.push({ el, curtain: cover, box, at: NaN });
      }
      drawn = true;
      body!.dataset.drawn = "true";
    }

    // ── The moving parts ──
    // `front`: how far down the page the threads have dropped (px). It follows the bottom of the screen like a weight
    // on a soft spring, so when you scroll the ends drop after you and settle.
    let front = NaN;
    let speed = 0;
    let lastTime = 0;
    const glints = Array.from({ length: 7 }, () => ({ thread: 0, at: -1, pace: 0, wait: Math.random() * 2500 }));

    const uncover = (target: number, dt: number) => {
      if (still) return;
      if (Number.isNaN(front)) front = Math.min(target, window.scrollY) - FADE;
      const pull = 4.6; // how stiff the spring is (per second)
      speed += (pull * pull * (target - front) - 2 * pull * speed) * dt;
      front += speed * dt;
      const sy = window.scrollY;
      // The page's curtain: a block of the page's colour with a soft top edge, moved to hide what has not dropped yet.
      // It is only about a screen and a half tall, so it is kept over the screen when the threads are far behind.
      curtain.style.transform = `translate3d(0, ${Math.round(Math.max(front - FADE, sy - FADE - h * 0.3))}px, 0)`;
      // Each frosted picture has its own small curtain, moved the same way.
      for (const f of frosts) {
        if (!f.curtain) continue;
        const at = Math.round(clamp(front - FADE - f.box.t, -FADE, f.box.b - f.box.t));
        if (at === f.at) continue;
        f.at = at;
        f.curtain.style.transform = `translate3d(0, ${at}px, 0)`;
      }
    };

    function drawLive(time: number) {
      const dt = Math.min(0.05, lastTime ? (time - lastTime) / 1000 : 0.016);
      lastTime = time;
      const sy = window.scrollY;
      if (drawn && go.current) uncover(sy + h * 1.08, dt);
      lctx!.clearRect(0, 0, w, h);
      if (!drawn || still) return;
      lctx!.globalCompositeOperation = "lighter";
      // Twinkling specks. Each sits at its own depth: near ones slide a little faster than the page, far ones slower.
      for (const s of specks) {
        const y = s.y - sy + (s.y - sy - h / 2) * (s.depth - 1);
        if (y < -10 || y > h + 10) continue;
        const beat = 0.5 + 0.5 * Math.sin(time * 0.0016 + s.phase);
        lctx!.globalAlpha = s.a * (0.25 + 0.75 * beat * beat);
        lctx!.fillStyle = "#fff0e8";
        lctx!.beginPath();
        lctx!.arc(s.x, y, s.r, 0, TAU);
        lctx!.fill();
      }
      // Glints: a short streak of light running along a thread, on the part of the ribbon that is on the screen.
      const cy = path[1];
      lctx!.strokeStyle = "#fff4ee";
      lctx!.lineCap = "round";
      for (const g of glints) {
        if (g.at < 0) {
          g.wait -= dt * 1000;
          if (g.wait > 0 || !runners.length) continue;
          // Start somewhere on the screen.
          const i = Math.floor(Math.random() * cy.length);
          if (cy[i] < sy + 40 || cy[i] > sy + h - 40) {
            g.wait = 60;
            continue;
          }
          g.thread = Math.floor(Math.random() * runners.length);
          g.at = i;
          g.pace = 16 + Math.random() * 14; // points per second
        }
        g.at += g.pace * dt;
        const xy = runners[g.thread];
        const head = Math.floor(g.at);
        const tail = 16;
        if (head >= xy.length / 2 - 1 || xy[head * 2 + 1] < sy - 60 || xy[head * 2 + 1] > sy + h + 60) {
          g.at = -1;
          g.wait = 400 + Math.random() * 2600;
          continue;
        }
        for (let k = 0; k < 4; k++) {
          const from = Math.max(0, head - tail + k * 4);
          const to = Math.max(0, head - tail + (k + 1) * 4);
          lctx!.globalAlpha = ((k + 1) / 4) * 0.7;
          lctx!.lineWidth = 1.4;
          lctx!.beginPath();
          lctx!.moveTo(xy[from * 2], xy[from * 2 + 1] - sy);
          for (let i = from + 1; i <= to; i++) lctx!.lineTo(xy[i * 2], xy[i * 2 + 1] - sy);
          lctx!.stroke();
        }
      }
      lctx!.globalAlpha = 1;
      lctx!.globalCompositeOperation = "source-over";
    }

    // Draw again only when the page's layout really changes (fonts, the demo accounts, a resize…), once it has settled.
    let waiting = 0;
    let lastKey = "";
    const key = () =>
      [w, host.offsetHeight, document.documentElement.dir, ...["text", "window", "soft", "grid"].map((nm) => `${find(nm)?.offsetLeft}:${find(nm)?.offsetTop}`)].join("x");
    const replan = () => {
      clearTimeout(waiting);
      waiting = window.setTimeout(() => {
        sizeLive();
        const k = key();
        if (k === lastKey) return;
        lastKey = k;
        plan();
      }, 140);
    };
    sizeLive();
    replan();
    const watcher = new ResizeObserver(replan);
    watcher.observe(host);
    const later = [window.setTimeout(replan, 700), window.setTimeout(replan, 1900)];
    window.addEventListener("resize", replan);

    let frame = 0;
    if (!still) {
      curtain.style.display = "block";
      const loop = (time: number) => {
        drawLive(time);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(waiting);
      later.forEach(clearTimeout);
      watcher.disconnect();
      window.removeEventListener("resize", replan);
    };
  }, []);

  return (
    <>
      <canvas ref={bodyRef} aria-hidden="true" className={cn("pointer-events-none absolute top-0 left-0 w-full", className)} />
      <canvas ref={liveRef} aria-hidden="true" className={cn("pointer-events-none fixed inset-0 h-full w-full", className)} />
      <div ref={curtainRef} aria-hidden="true" className="threads-curtain" />
    </>
  );
}

/**
 * Frosted glass for a card or a section over the threads: put it inside the element, which needs `relative isolate`.
 * It shows a blurred picture of the threads behind the element (painted once by `LightThreads`), under a tint
 * (`--frost-tint`). `kind`: "glass" for a card (lightly blurred), "soft" for a whole section (a soft glow). Until it is
 * painted, and without scripts, the element just keeps its own background.
 */
export function Frost({ kind = "glass" }: { kind?: "glass" | "soft" }) {
  return (
    <span aria-hidden="true" data-frost={kind} className="frost">
      <canvas />
      <i />
    </span>
  );
}
