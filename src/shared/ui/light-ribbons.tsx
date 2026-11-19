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
 * The bundle's shapes down the page: at the top it falls down the side, in the middle it crosses the screen, at the
 * bottom it flows along the floor. Every shape starts and ends just outside the screen (and so does every shape in
 * between), so the strands always enter from the edge, never from a point in the middle.
 *
 * They are written for a left-to-right page (text on the left, the picture on the right). On an Arabic page they are
 * mirrored, so the strands fall behind the picture side and never behind the text.
 */
const SHAPES: Shape[] = [
  { at: 0, path: [[0.64, -0.15], [0.8, 0.3], [0.54, 0.62], [0.88, 1.15]], spread: 0.26 },
  { at: 0.33, path: [[1.1, 0.02], [0.72, 0.3], [0.38, 0.42], [-0.12, 0.98]], spread: 0.3 },
  { at: 0.66, path: [[1.12, 0.52], [0.7, 0.3], [0.34, 0.86], [-0.12, 0.6]], spread: 0.24 },
  { at: 1, path: [[1.12, 0.9], [0.66, 0.68], [0.36, 1.02], [-0.12, 0.8]], spread: 0.2 },
];

/** How far each point of a strand sits from the bundle's middle: tight at the start, wide at the end. */
const FAN = [0.04, 0.38, 0.72, 1];
/** How much each point of a strand weaves: little at the start, most in the middle, so strands cross each other there. */
const WEAVE = [0.15, 1, 1, 0.7];

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
 * background). It is always alive:
 * - light pulses run down every strand, each at its own speed;
 * - the strands weave and cross each other, and the whole bundle sways slowly;
 * - scrolling throws the bundle into its next shape on a spring (it overshoots a little and settles), and a fast scroll
 *   whips and spreads the strands and speeds the pulses up, then it calms down;
 * - it leans a little toward the mouse.
 * `colors`: core → middle → edge → end (the brand palette). Pointer events pass through. It pauses by itself in a hidden
 * tab, and with "reduce motion" it is drawn once and stays still.
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
      speed: 0.6 + Math.random() * 0.9,
      width: 0.6 + Math.random() * 1.1,
      shine: 0.3 + Math.random() * 0.45,
      // The light pulse running down this strand.
      pulse: Math.random() * 1.4,
      pulseSpeed: 0.12 + Math.random() * 0.22,
    }));
    const dust = Array.from({ length: w < 640 ? 20 : 40 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 2.2,
      rise: 0.00004 + Math.random() * 0.0001,
      a: 0.15 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
    }));

    // The scroll, followed on a spring: `pos` chases `target` with a little overshoot ("thrown" into place).
    let target = 0;
    let pos = 0;
    let vel = 0;
    // How fast the page is scrolling right now, 0 (still) – 1 (fast), smoothed. It whips and speeds up the strands.
    let rush = 0;
    let lastTarget = 0;
    // The mouse, -0.5 – 0.5 from the middle of the screen, smoothed.
    let mx = 0;
    let my = 0;
    let lean = { x: 0, y: 0 };
    let lastTime = 0;

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target = max > 0 ? window.scrollY / max : 0;
      if (still) draw(0);
    };
    const onPointer = (e: PointerEvent) => {
      mx = e.clientX / w - 0.5;
      my = e.clientY / h - 0.5;
    };

    function draw(time: number) {
      const dt = Math.min(50, lastTime ? time - lastTime : 16) / 16; // 1 = one frame at 60 fps
      lastTime = time;
      if (still) {
        pos = target;
      } else {
        vel += (target - pos) * 0.022 * dt;
        vel *= Math.pow(0.86, dt);
        pos += vel * dt;
        rush += (Math.min(1, Math.abs(target - lastTarget) * 45) - rush) * 0.08 * dt;
        lastTarget = target;
        lean = { x: lean.x + (mx - lean.x) * 0.04 * dt, y: lean.y + (my - lean.y) * 0.04 * dt };
      }
      const t = time * 0.001;

      const shape = shapeAt(pos);
      const rtl = document.documentElement.dir === "rtl";
      const sway = (j: number) => (still ? [0, 0] : [Math.sin(t * 0.35 + j * 1.9) * 0.03, Math.cos(t * 0.28 + j * 2.4) * 0.022]);
      const path = shape.path.map(([x, y], j) => {
        const [sx, sy] = sway(j);
        const px = (rtl ? 1 - x : x) + (sx + lean.x * 0.07) * FAN[j];
        return [px, y + (sy + lean.y * 0.05) * FAN[j]] as Pt;
      }) as Shape["path"];
      const spread = shape.spread * (1 + rush * 0.45);
      const [s0, , , s3] = path;
      // Across the bundle: at right angles to its overall direction.
      const dx = s3[0] - s0[0];
      const dy = s3[1] - s0[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      // A fast scroll whips the middle of the bundle sideways (and it springs back with the scroll).
      const whip = Math.max(-0.12, Math.min(0.12, vel * 6));

      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";

      // A soft haze along the middle of the bundle: the glow the strands sit in.
      const mid = path.map(([x, y], j) => [(x + nx * whip * WEAVE[j]) * w, (y + ny * whip * WEAVE[j]) * h] as Pt);
      const haze = ctx!.createLinearGradient(mid[0][0], mid[0][1], mid[3][0], mid[3][1]);
      haze.addColorStop(0, "transparent");
      haze.addColorStop(0.35, colors[1]);
      haze.addColorStop(0.75, colors[2]);
      haze.addColorStop(1, "transparent");
      ctx!.strokeStyle = haze;
      for (const [lineWidth, alpha] of [
        [Math.min(w, h) * spread * 0.9, 0.035 + rush * 0.02],
        [Math.min(w, h) * spread * 0.35, 0.05 + rush * 0.03],
      ]) {
        ctx!.globalAlpha = alpha;
        ctx!.lineWidth = lineWidth;
        stroke(mid);
      }

      const amp = 0.028 + rush * 0.05;
      for (const s of strands) {
        // Each point of the strand weaves on its own rhythm: the strands cross over each other.
        const pts = path.map(([x, y], j) => {
          const weave = still ? 0 : Math.sin(t * s.speed + s.phase + j * 1.7) * amp * WEAVE[j];
          const off = s.k * spread * FAN[j] + weave + whip * WEAVE[j];
          return [(x + nx * off) * w, (y + ny * off) * h] as Pt;
        });
        const center = 1 - Math.abs(s.k) * 1.2; // the middle of the bundle shines most

        const grad = ctx!.createLinearGradient(pts[0][0], pts[0][1], pts[3][0], pts[3][1]);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.12, colors[0]);
        grad.addColorStop(0.45, colors[1]);
        grad.addColorStop(0.8, colors[2]);
        grad.addColorStop(1, colors[3]);
        ctx!.strokeStyle = grad;
        for (const [lineWidth, alpha] of [
          [s.width * 7, 0.07],
          [s.width, s.shine],
        ]) {
          ctx!.globalAlpha = Math.max(0.04, alpha * center);
          ctx!.lineWidth = lineWidth;
          stroke(pts);
        }

        // The light pulse running down the strand (faster while the page scrolls).
        if (!still) s.pulse = (s.pulse + s.pulseSpeed * (1 + rush * 3) * 0.016 * dt) % 1.4;
        const u = s.pulse - 0.2;
        if (u > 0.02 && u < 0.98) {
          const glow = ctx!.createLinearGradient(pts[0][0], pts[0][1], pts[3][0], pts[3][1]);
          glow.addColorStop(Math.max(0, u - 0.07), "transparent");
          glow.addColorStop(u, "#fff4ef");
          glow.addColorStop(Math.min(1, u + 0.03), "transparent");
          ctx!.strokeStyle = glow;
          ctx!.globalAlpha = 0.85 * Math.max(0.3, center);
          ctx!.lineWidth = s.width * 1.6;
          stroke(pts);
        }
      }

      // Specks of light drifting up (faster, and slanting, while the page scrolls).
      ctx!.fillStyle = colors[0];
      for (const d of dust) {
        if (!still) {
          d.y -= d.rise * 16 * dt * (1 + rush * 6);
          d.x += whip * 0.002 * dt;
        }
        if (d.y < -0.05) d.y = 1.05;
        if (d.x < -0.05) d.x = 1.05;
        if (d.x > 1.05) d.x = -0.05;
        ctx!.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * 2 + d.phase));
        ctx!.beginPath();
        ctx!.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
    }

    function stroke(p: Pt[]) {
      ctx!.beginPath();
      ctx!.moveTo(p[0][0], p[0][1]);
      ctx!.bezierCurveTo(p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]);
      ctx!.stroke();
    }

    let frame = 0;
    const loop = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(loop);
    };
    onScroll();
    pos = target;
    lastTarget = target;
    if (still) draw(0);
    else frame = requestAnimationFrame(loop);
    window.addEventListener("scroll", onScroll, { passive: true });
    if (!still) window.addEventListener("pointermove", onPointer, { passive: true });
    const onResize = () => {
      resize();
      onScroll();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
    };
  }, [colors]);

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none fixed inset-0 h-full w-full", className)} />;
}
