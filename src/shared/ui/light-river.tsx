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
 * A wide river of light that snakes across the page along a set path (see `plannedPath`), behind the content. It is
 * drawn on the page itself, so it moves with the page as you scroll, like a background. The motion is calm: the strands
 * sway slowly and the light runs along them at a gentle, steady pace, whatever the scroll does. `colors`: core → middle →
 * edge → end (the brand palette). Pointer events pass through; it pauses in a hidden tab, and with "reduce motion" it
 * stays still.
 */
export function LightRiver({ colors, className }: { colors: [string, string, string, string]; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const narrow = () => w < 1024;
    // Half the river's width: wide on a computer, narrower on a phone.
    const half = () => (w < 640 ? 16 : Math.min(58, Math.max(30, w * 0.028)));
    const count = w < 640 ? 12 : 30;
    const strands = Array.from({ length: count }, (_, i) => ({
      k: i / (count - 1) - 0.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.35,
      width: 0.6 + Math.random() * 1,
      shine: 0.3 + Math.random() * 0.4,
      // The light running along this strand: where it is along the river (px) and how fast (px per frame, gentle).
      pulse: Math.random() * 4000,
      pace: 0.7 + Math.random() * 0.6,
    }));
    const dust = Array.from({ length: w < 640 ? 14 : 40 }, () => ({
      at: Math.random() * 4000,
      off: (Math.random() - 0.5) * 3.2,
      r: 0.6 + Math.random() * 1.8,
      a: 0.2 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
    }));

    // The river: points every STEP px along it (page coordinates), and the direction across it at each point.
    let pts: P[] = [];
    let across: P[] = [];
    function plan() {
      const pageH = document.documentElement.scrollHeight;
      pts = evenly(smoothCurve(plannedPath(w, pageH)));
      across = pts.map((_, i) => {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
      });
    }

    let lastTime = 0;
    function draw(time: number) {
      const dt = Math.min(50, lastTime ? time - lastTime : 16) / 16; // 1 = one frame at 60 fps
      lastTime = time;
      const t = time * 0.001;
      const sy = window.scrollY;
      const hw = half();
      const soft = narrow() ? 0.7 : 1;
      ctx!.clearRect(0, 0, w, h);
      if (pts.length < 2) return;

      // Only the part of the river on the screen (and a little around it).
      const margin = hw * 4 + 60;
      let i0 = pts.findIndex((p) => p[1] >= sy - margin);
      if (i0 < 0) return;
      let i1 = i0;
      for (let i = i0; i < pts.length && pts[i][1] <= sy + h + margin; i++) i1 = i;
      i0 = Math.max(0, i0 - 2);
      i1 = Math.min(pts.length - 1, i1 + 2);
      if (i1 - i0 < 2) return;

      const strandAt = (s: (typeof strands)[number] | null, i: number): P => {
        const off = s ? s.k * 2 * hw + (still ? 0 : Math.sin(i * STEP * 0.004 + t * s.speed + s.phase * 0.35) * hw * 0.16) : 0;
        return [pts[i][0] + across[i][0] * off, pts[i][1] + across[i][1] * off - sy];
      };
      const stroke = (s: (typeof strands)[number] | null, from: number, to: number) => {
        if (to - from < 1) return;
        ctx!.beginPath();
        let p = strandAt(s, from);
        ctx!.moveTo(p[0], p[1]);
        for (let i = from + 1; i < to; i++) {
          const q = strandAt(s, i + 1);
          p = strandAt(s, i);
          ctx!.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
        }
        p = strandAt(s, to);
        ctx!.lineTo(p[0], p[1]);
        ctx!.stroke();
      };

      ctx!.globalCompositeOperation = "lighter";
      ctx!.lineCap = "round";
      // The colour: blush in the middle of the screen, deeper toward the top and the bottom.
      const body = ctx!.createLinearGradient(0, 0, 0, h);
      body.addColorStop(0, colors[2]);
      body.addColorStop(0.4, colors[0]);
      body.addColorStop(0.7, colors[1]);
      body.addColorStop(1, colors[2]);

      // A wide, soft glow under the strands: the river feels like part of the background.
      ctx!.strokeStyle = body;
      for (const [width, alpha] of [
        [hw * 5, 0.035],
        [hw * 2.4, 0.05],
      ]) {
        ctx!.globalAlpha = alpha * soft;
        ctx!.lineWidth = width;
        stroke(null, i0, i1);
      }

      for (const s of strands) {
        const center = 1 - Math.abs(s.k) * 1.1;
        ctx!.strokeStyle = body;
        for (const [width, alpha] of [
          [s.width * 6, 0.05],
          [s.width, s.shine],
        ]) {
          ctx!.globalAlpha = Math.max(0.05, alpha * center) * soft;
          ctx!.lineWidth = width;
          stroke(s, i0, i1);
        }

        // The light running gently along the strand: a short streak that fades behind it.
        if (!still) s.pulse = (s.pulse + s.pace * dt) % (pts.length * STEP);
        const head = Math.floor(s.pulse / STEP);
        const tail = Math.round(150 / STEP);
        if (head >= i0 && head - tail <= i1) {
          ctx!.strokeStyle = "#fff4ef";
          ctx!.lineWidth = s.width * 1.8;
          const parts = 6;
          for (let c = 0; c < parts; c++) {
            const from = Math.max(i0, head - tail + Math.floor((tail * c) / parts));
            const to = Math.min(i1, head - tail + Math.floor((tail * (c + 1)) / parts));
            ctx!.globalAlpha = ((c + 1) / parts) * 0.75 * Math.max(0.4, center) * soft;
            stroke(s, from, to);
          }
        }
      }

      // Specks of light along the river, drifting slowly with it.
      ctx!.fillStyle = colors[0];
      for (const d of dust) {
        if (!still) d.at = (d.at + 0.3 * dt) % (pts.length * STEP);
        const i = Math.floor(d.at / STEP);
        if (i < i0 || i > i1) continue;
        const x = pts[i][0] + across[i][0] * d.off * hw;
        const y = pts[i][1] + across[i][1] * d.off * hw - sy;
        ctx!.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * 1.5 + d.phase)) * soft;
        ctx!.beginPath();
        ctx!.arc(x, y, d.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
    }

    // Place the path again whenever the page's layout changes (fonts, the demo accounts, a resize…).
    let planned = 0;
    const replan = () => {
      cancelAnimationFrame(planned);
      planned = requestAnimationFrame(() => {
        plan();
        if (still) draw(0);
      });
    };
    plan();
    const watcher = new ResizeObserver(replan);
    watcher.observe(document.body);
    const later = [setTimeout(replan, 600), setTimeout(replan, 1800)];

    let frame = 0;
    const loop = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(loop);
    };
    const onScroll = () => {
      if (still) draw(0);
    };
    if (still) draw(0);
    else frame = requestAnimationFrame(loop);
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => {
      resize();
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

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none fixed inset-0 h-full w-full", className)} />;
}
