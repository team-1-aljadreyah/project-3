import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";

type P = [number, number];
interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
  cx: number;
}

/** The river's points are this far apart along it (px). */
const STEP = 14;

/**
 * Where an element sits in the page's layout (px from the page's top-left), ignoring transforms: a block that is still
 * sliding or growing into place (the plate, the cards that settle in) counts where it will end up.
 */
function layoutBox(el: HTMLElement): Box {
  let l = 0;
  let t = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) {
    l += e.offsetLeft;
    t += e.offsetTop;
  }
  return { l, r: l + el.offsetWidth, t, b: t + el.offsetHeight, cx: l + el.offsetWidth / 2 };
}

const find = (name: string) => document.querySelector<HTMLElement>(`[data-river="${name}"]`);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The river's path down the page, as Yasser drew it: from the top corner on the window's side it sweeps across into the
 * gap between the window and the text, down that gap, out under the window to its side, back across past the demo
 * accounts to the far side beside the plate, down beside it, back under the plate into the gap between the cards, down
 * that gap, and out at the bottom on the far side. The places come from the page's own blocks (`data-river="window"`,
 * `"text"`, `"plate"`, `"grid"`), so it fits any screen. Without them, or when the blocks are stacked (a phone), it is a
 * plain wide wave from side to side.
 */
function plannedPath(w: number, pageH: number): P[] {
  const els = { win: find("window"), text: find("text"), plate: find("plate"), grid: find("grid") };
  if (!els.win || !els.text || !els.plate || !els.grid) return wave(w, pageH, true);
  const W = layoutBox(els.win);
  const T = layoutBox(els.text);
  const PL = layoutBox(els.plate);
  const G = layoutBox(els.grid);
  const left = W.cx < w / 2; // the window is on the left (an Arabic page)
  // A phone or a tablet: the window sits under the text, not beside it.
  if (W.l < T.r && T.l < W.r) return wave(w, pageH, left);

  const cards = Array.from(els.grid.children).map((c) => layoutBox(c as HTMLElement));
  const colA = cards.filter((c) => c.cx < G.cx);
  const colB = cards.filter((c) => c.cx >= G.cx);
  const gridGap = colA.length && colB.length ? (Math.max(...colA.map((c) => c.r)) + Math.min(...colB.map((c) => c.l))) / 2 : G.cx;
  const startX = left ? w * 0.075 : w * 0.925;
  const gapX = left ? (W.r + T.l) / 2 : (T.r + W.l) / 2;
  const winSide = left ? W.l * 0.7 : w - (w - W.r) * 0.7;
  const farSide = left ? (PL.r + w) / 2 : PL.l / 2;
  const exitX = left ? w * 0.9 : w * 0.1;
  // The turn at the window's side, below the window and level with the end of the demo accounts.
  const turnY = Math.max(W.b + 330, T.b + 20);
  return [
    // Across the top, from the corner to just above the window's inner corner.
    [startX, -80],
    [lerp(startX, gapX, 0.32), W.t * 0.29],
    [lerp(startX, gapX, 0.52), W.t * 0.47],
    [lerp(startX, gapX, 0.81), W.t * 0.71],
    [lerp(startX, gapX, 0.94), W.t - 40],
    // Down the gap between the window and the text.
    [gapX, W.t + 110],
    [gapX, W.b + 10],
    // Out under the window to its side, then down that side.
    [lerp(gapX, winSide, 0.3), W.b + 145],
    [lerp(gapX, winSide, 0.73), W.b + 175],
    [winSide, W.b + 235],
    [winSide, turnY],
    // Across, just under the demo accounts, and down beside the plate on the far side.
    [lerp(winSide, farSide, 0.45), turnY + 75],
    [lerp(winSide, farSide, 0.8), turnY + 105],
    [farSide, PL.t + 140],
    [farSide, PL.b - 100],
    // Back under the plate into the gap between the cards, down it, and out at the bottom on the far side.
    [lerp(farSide, gridGap, 0.4), PL.b + 25],
    [lerp(farSide, gridGap, 0.8), PL.b + 45],
    [gridGap, G.t + 70],
    [gridGap, G.b - 40],
    [lerp(gridGap, exitX, 0.45), G.b + 40],
    [lerp(gridGap, exitX, 0.8), G.b + 70],
    [exitX, pageH + 120],
  ];
}

/** A plain wide wave from one side to the other, every 620 px down the page. */
function wave(w: number, pageH: number, leftFirst: boolean): P[] {
  const pts: P[] = [];
  let side = leftFirst;
  for (let y = -120; y < pageH + 740; y += 620) {
    pts.push([side ? w * 0.16 : w * 0.84, y]);
    side = !side;
  }
  return pts;
}

/** A smooth curve through the points (centripetal Catmull–Rom: no loops, no overshoot at sharp turns). */
function smoothCurve(pts: P[]): P[] {
  if (pts.length < 2) return pts;
  const n = pts.length;
  const ext: P[] = [
    [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]],
    ...pts,
    [2 * pts[n - 1][0] - pts[n - 2][0], 2 * pts[n - 1][1] - pts[n - 2][1]],
  ];
  const knot = (a: P, b: P) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  const at = (a: P, b: P, ta: number, tb: number, t: number): P => {
    const k = (t - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  const out: P[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]];
    const t1 = knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    const steps = Math.max(8, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 6));
    for (let s = 0; s < steps; s++) {
      const t = t1 + ((t2 - t1) * s) / steps;
      const a1 = at(p0, p1, 0, t1, t);
      const a2 = at(p1, p2, t1, t2, t);
      const a3 = at(p2, p3, t2, t3, t);
      out.push(at(at(a1, a2, 0, t2, t), at(a2, a3, t1, t3, t), t1, t2, t));
    }
  }
  out.push(pts[n - 1]);
  return out;
}

/** The same curve with a point every STEP px along it. */
function evenly(line: P[]): P[] {
  const out: P[] = [line[0]];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const seg = Math.hypot(bx - ax, by - ay);
    let d = STEP - carry;
    while (d <= seg) {
      out.push([ax + ((bx - ax) * d) / seg, ay + ((by - ay) * d) / seg]);
      d += STEP;
    }
    carry = seg - (d - STEP);
  }
  return out;
}

/**
 * A wide river of light that snakes across the page along a set path (see `plannedPath`), behind the content, moving
 * with the page like a background. Light runs gently along its strands, and specks of light drift with it.
 *
 * Built to stay smooth on any computer:
 * - The river itself (its glow and strands) is drawn ONCE onto a canvas as tall as the page, placed in the page. When
 *   you scroll, the browser simply moves it with the content: nothing is drawn again (only when the layout changes).
 * - Only the moving light (a short streak on some strands, and the specks) is drawn each frame, on a second, small canvas
 *   the size of the screen.
 * The parent element must be `relative` (the river is placed at its top-left) and should clip its overflow.
 * `colors`: core → middle → edge → end (the brand palette). Pointer events pass through; it pauses in a hidden tab, and
 * with "reduce motion" the light stays still.
 */
export function LightRiver({ colors, className }: { colors: [string, string, string, string]; className?: string }) {
  const bodyRef = useRef<HTMLCanvasElement>(null);
  const lightRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const body = bodyRef.current;
    const light = lightRef.current;
    const bctx = body?.getContext("2d");
    const lctx = light?.getContext("2d");
    const host = body?.parentElement;
    if (!body || !light || !bctx || !lctx || !host) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    const half = () => (w < 640 ? 16 : Math.min(58, Math.max(30, w * 0.028)));
    const soft = () => (w < 1024 ? 0.7 : 1);
    const sizeLight = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      light.width = Math.round(w * dpr);
      light.height = Math.round(h * dpr);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeLight();

    const count = w < 640 ? 12 : 30;
    const strands = Array.from({ length: count }, (_, i) => ({
      k: i / (count - 1) - 0.5,
      width: 0.6 + Math.random() * 1,
      shine: 0.3 + Math.random() * 0.4,
      // Every other strand carries a streak of light: where it is along the river (px) and how fast (px per frame, gentle).
      pulse: i % 2 === 0 ? Math.random() * 4000 : -1,
      pace: 0.7 + Math.random() * 0.6,
    }));
    const dust = Array.from({ length: w < 640 ? 12 : 30 }, () => ({
      at: Math.random() * 4000,
      off: (Math.random() - 0.5) * 3.2,
      r: 0.6 + Math.random() * 1.8,
      a: 0.2 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
    }));

    // The river: points every STEP px along it (page coordinates), and the direction across it at each point.
    let pts: P[] = [];
    let across: P[] = [];
    const strandAt = (k: number, i: number, dy = 0): P => {
      const off = k * 2 * half();
      return [pts[i][0] + across[i][0] * off, pts[i][1] + across[i][1] * off - dy];
    };
    const stroke = (ctx: CanvasRenderingContext2D, k: number, from: number, to: number, dy = 0) => {
      if (to - from < 1) return;
      ctx.beginPath();
      let p = strandAt(k, from, dy);
      ctx.moveTo(p[0], p[1]);
      for (let i = from + 1; i < to; i++) {
        const q = strandAt(k, i + 1, dy);
        p = strandAt(k, i, dy);
        ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      p = strandAt(k, to, dy);
      ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    };

    /** Places the path from the page's blocks and draws the river once, on the page-tall canvas. */
    function plan() {
      const pageH = host!.offsetHeight;
      pts = evenly(smoothCurve(plannedPath(w, pageH)));
      across = pts.map((_, i) => {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
      });
      // A page-tall canvas: sharp enough for a soft glow, but never more than about 9 million pixels.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(9e6 / Math.max(1, w * pageH)));
      body!.width = Math.round(w * dpr);
      body!.height = Math.round(pageH * dpr);
      body!.style.height = `${pageH}px`;
      bctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx!.clearRect(0, 0, w, pageH);
      if (pts.length < 2) return;
      const last = pts.length - 1;
      const hw = half();
      bctx!.globalCompositeOperation = "lighter";
      bctx!.lineCap = "round";
      // The colour along the page: deeper at the very top and bottom, blush and dusty rose in between.
      const tone = bctx!.createLinearGradient(0, 0, 0, pageH);
      tone.addColorStop(0, colors[2]);
      tone.addColorStop(0.15, colors[0]);
      tone.addColorStop(0.5, colors[1]);
      tone.addColorStop(0.75, colors[0]);
      tone.addColorStop(1, colors[2]);
      bctx!.strokeStyle = tone;
      // A wide, soft glow under the strands.
      for (const [width, alpha] of [
        [hw * 5, 0.035],
        [hw * 2.4, 0.05],
      ]) {
        bctx!.globalAlpha = alpha * soft();
        bctx!.lineWidth = width;
        stroke(bctx!, 0, 0, last);
      }
      for (const s of strands) {
        const center = 1 - Math.abs(s.k) * 1.1;
        for (const [width, alpha] of [
          [s.width * 6, 0.05],
          [s.width, s.shine],
        ]) {
          bctx!.globalAlpha = Math.max(0.05, alpha * center) * soft();
          bctx!.lineWidth = width;
          stroke(bctx!, s.k, 0, last);
        }
      }
      bctx!.globalAlpha = 1;
      bctx!.globalCompositeOperation = "source-over";
    }

    /** The moving light, on the screen-sized canvas: a short streak on some strands, and the specks. */
    let lastTime = 0;
    function drawLight(time: number) {
      const dt = Math.min(50, lastTime ? time - lastTime : 16) / 16; // 1 = one frame at 60 fps
      lastTime = time;
      const sy = window.scrollY;
      lctx!.clearRect(0, 0, w, h);
      if (pts.length < 2) return;
      // Only the part of the river on the screen.
      const top = pts.findIndex((p) => p[1] >= sy - 200);
      if (top < 0) return;
      let bottom = top;
      for (let i = top; i < pts.length && pts[i][1] <= sy + h + 200; i++) bottom = i;
      lctx!.globalCompositeOperation = "lighter";
      lctx!.lineCap = "round";
      lctx!.strokeStyle = "#fff4ef";
      const tail = Math.round(150 / STEP);
      for (const s of strands) {
        if (s.pulse < 0) continue;
        if (!still) s.pulse = (s.pulse + s.pace * dt) % (pts.length * STEP);
        const head = Math.floor(s.pulse / STEP);
        if (head < top || head - tail > bottom) continue;
        const center = 1 - Math.abs(s.k) * 1.1;
        lctx!.lineWidth = s.width * 1.8;
        const parts = 5;
        for (let c = 0; c < parts; c++) {
          const from = Math.max(0, head - tail + Math.floor((tail * c) / parts));
          const to = Math.min(pts.length - 1, head - tail + Math.floor((tail * (c + 1)) / parts));
          lctx!.globalAlpha = ((c + 1) / parts) * 0.75 * Math.max(0.4, center) * soft();
          stroke(lctx!, s.k, from, to, sy);
        }
      }
      lctx!.fillStyle = colors[0];
      const t = time * 0.001;
      const hw = half();
      for (const d of dust) {
        if (!still) d.at = (d.at + 0.3 * dt) % (pts.length * STEP);
        const i = Math.floor(d.at / STEP);
        if (i < top || i > bottom) continue;
        lctx!.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * 1.5 + d.phase)) * soft();
        lctx!.beginPath();
        lctx!.arc(pts[i][0] + across[i][0] * d.off * hw, pts[i][1] + across[i][1] * d.off * hw - sy, d.r, 0, Math.PI * 2);
        lctx!.fill();
      }
      lctx!.globalAlpha = 1;
      lctx!.globalCompositeOperation = "source-over";
    }

    // Draw the river again only when the page's layout changes (fonts, the demo accounts, a resize…).
    let planned = 0;
    let lastSize = "";
    const replan = () => {
      cancelAnimationFrame(planned);
      planned = requestAnimationFrame(() => {
        const size = `${window.innerWidth}x${host.offsetHeight}`;
        if (size === lastSize) return;
        lastSize = size;
        plan();
        if (still) drawLight(0);
      });
    };
    lastSize = `${w}x${host.offsetHeight}`;
    plan();
    const watcher = new ResizeObserver(replan);
    watcher.observe(host);
    const later = [setTimeout(() => ((lastSize = ""), replan()), 600), setTimeout(() => ((lastSize = ""), replan()), 1800)];

    let frame = 0;
    const loop = (time: number) => {
      drawLight(time);
      frame = requestAnimationFrame(loop);
    };
    const onScroll = () => {
      if (still) drawLight(0);
    };
    if (still) drawLight(0);
    else frame = requestAnimationFrame(loop);
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => {
      sizeLight();
      replan();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(planned);
      later.forEach(clearTimeout);
      watcher.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [colors]);

  return (
    <>
      <canvas ref={bodyRef} aria-hidden="true" className={cn("pointer-events-none absolute top-0 left-0 w-full", className)} />
      <canvas ref={lightRef} aria-hidden="true" className={cn("pointer-events-none fixed inset-0 h-full w-full", className)} />
    </>
  );
}
