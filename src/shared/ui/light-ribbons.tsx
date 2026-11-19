import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";

/** A point of the bundle's path, as fractions of the screen (0–1, a little outside is fine). */
type Pt = [number, number];
interface Shape {
  /** Where in the page's scroll (0 = top, 1 = bottom) the bundle takes this shape. */
  at: number;
  /** Start, two bends, end. */
  path: [Pt, Pt, Pt, Pt];
  /** How far the strands fan apart at the end (fraction of the screen). */
  spread: number;
}

/**
 * Every shape starts and ends just outside the screen (and so does every shape in between while it drops), so the
 * strands always enter from the edge, never from a point in the middle.
 *
 * The bundle's shapes down the page: at the top it falls down the side, in the middle it crosses the screen, at the
 * bottom it flows along the floor. Scrolling moves it from one to the next, and it falls into place a moment after the
 * page moves (the "drop").
 */
const SHAPES: Shape[] = [
  { at: 0, path: [[0.64, -0.15], [0.8, 0.3], [0.54, 0.62], [0.88, 1.15]], spread: 0.26 },
  { at: 0.33, path: [[1.1, 0.02], [0.72, 0.3], [0.38, 0.42], [-0.12, 0.98]], spread: 0.3 },
  { at: 0.66, path: [[1.12, 0.52], [0.7, 0.3], [0.34, 0.86], [-0.12, 0.6]], spread: 0.24 },
  { at: 1, path: [[1.12, 0.9], [0.66, 0.68], [0.36, 1.02], [-0.12, 0.8]], spread: 0.2 },
]
/**
 * The shapes are written for a left-to-right page (text on the left, the picture on the right). On an Arabic page they
 * are mirrored, so the strands always fall behind the picture side and never behind the text.
 */

/** How much each point of a strand moves away from the bundle's middle: tight at the start, wide at the end. */
const FAN = [0.04, 0.38, 0.72, 1];

const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function shapeAt(p: number) {
  let i = 0;
  while (i < SHAPES.length - 2 && p > SHAPES[i + 1].at) i++;
  const a = SHAPES[i];
  const b = SHAPES[i + 1];
  const t = smooth(Math.min(1, Math.max(0, (p - a.at) / (b.at - a.at))));
  return {
    path: a.path.map((pt, j) => [mix(pt[0], b.path[j][0], t), mix(pt[1], b.path[j][1], t)] as Pt),
    spread: mix(a.spread, b.spread, t),
  };
}

/**
 * Many thin glowing strands of light, bundled and fanning out, drawn on a canvas behind the page (the front door's
 * background). They wave gently, specks of light drift around them, and the whole bundle drops into a new shape as the
 * page scrolls. `colors`: core → middle → edge → end (the brand palette). Pointer events pass through. It pauses by itself
 * in a hidden tab, and with "reduce motion" it is drawn once and stays still.
 */
export function LightRibbons({ colors, className }: { colors: [string, string, string, string]; className?: string }) {
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

    // Fewer strands on a phone, so it stays smooth.
    const count = w < 640 ? 30 : 64;
    const strands = Array.from({ length: count }, (_, i) => ({
      k: i / (count - 1) - 0.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.4,
      width: 0.6 + Math.random() * 1.1,
      shine: 0.35 + Math.random() * 0.5,
    }));
    const dust = Array.from({ length: w < 640 ? 18 : 34 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 2.2,
      rise: 0.00003 + Math.random() * 0.00008,
      a: 0.15 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
    }));

    let target = 0;
    let scroll = 0;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target = max > 0 ? window.scrollY / max : 0;
      if (still) draw(0);
    };

    function draw(time: number) {
      // The bundle follows the scroll a moment late: it "drops" into its new shape.
      scroll = still ? target : scroll + (target - scroll) * 0.06;
      const shape = shapeAt(scroll);
      const rtl = document.documentElement.dir === "rtl";
      const path = rtl ? (shape.path.map(([x, y]) => [1 - x, y]) as Shape["path"]) : shape.path;
      const { spread } = shape;
      const [s0, , , s3] = path;
      // Across the bundle: at right angles to its overall direction.
      const dx = s3[0] - s0[0];
      const dy = s3[1] - s0[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";
      // A soft haze along the middle of the bundle: the glow the strands sit in.
      const mid = path.map(([x, y]) => [x * w, y * h] as Pt);
      const haze = ctx!.createLinearGradient(mid[0][0], mid[0][1], mid[3][0], mid[3][1]);
      haze.addColorStop(0, "transparent");
      haze.addColorStop(0.35, colors[1]);
      haze.addColorStop(0.75, colors[2]);
      haze.addColorStop(1, "transparent");
      ctx!.strokeStyle = haze;
      for (const [lineWidth, alpha] of [
        [Math.min(w, h) * spread * 0.9, 0.035],
        [Math.min(w, h) * spread * 0.35, 0.05],
      ]) {
        ctx!.globalAlpha = alpha;
        ctx!.lineWidth = lineWidth;
        ctx!.beginPath();
        ctx!.moveTo(mid[0][0], mid[0][1]);
        ctx!.bezierCurveTo(mid[1][0], mid[1][1], mid[2][0], mid[2][1], mid[3][0], mid[3][1]);
        ctx!.stroke();
      }
      for (const s of strands) {
        const wave = Math.sin(time * 0.001 * s.speed + s.phase);
        const pts = path.map(([x, y], j) => {
          const off = s.k * spread * FAN[j] + wave * 0.012 * FAN[j];
          return [(x + nx * off) * w, (y + ny * off) * h] as Pt;
        });
        const grad = ctx!.createLinearGradient(pts[0][0], pts[0][1], pts[3][0], pts[3][1]);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.12, colors[0]);
        grad.addColorStop(0.45, colors[1]);
        grad.addColorStop(0.8, colors[2]);
        grad.addColorStop(1, colors[3]);
        ctx!.strokeStyle = grad;
        const center = 1 - Math.abs(s.k) * 1.2; // the middle of the bundle shines most
        for (const [lineWidth, alpha] of [
          [s.width * 7, 0.07],
          [s.width, s.shine],
        ]) {
          ctx!.globalAlpha = Math.max(0.04, alpha * center);
          ctx!.lineWidth = lineWidth;
          ctx!.beginPath();
          ctx!.moveTo(pts[0][0], pts[0][1]);
          ctx!.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
          ctx!.stroke();
        }
      }
      // Specks of light drifting up.
      ctx!.fillStyle = colors[0];
      for (const d of dust) {
        if (!still) d.y -= d.rise * 16;
        if (d.y < -0.05) d.y = 1.05;
        ctx!.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(time * 0.002 + d.phase));
        ctx!.beginPath();
        ctx!.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
    }

    let frame = 0;
    const loop = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(loop);
    };
    onScroll();
    if (still) draw(0);
    else frame = requestAnimationFrame(loop);
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => {
      resize();
      onScroll();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [colors]);

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none fixed inset-0 h-full w-full", className)} />;
}
