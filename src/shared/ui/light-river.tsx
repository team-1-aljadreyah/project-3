import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";

/** The page's content is at most this wide (max-w-6xl); the river runs in the margin beside it. */
const CONTENT = 1152;

/**
 * A river of light down the side of the page, beside the content (never under it): a narrow bundle of thin glowing
 * strands from the top of the screen to the bottom, in the side margin (the left on an Arabic page, the right on an
 * English one). Its bends are tied to the page, so they travel with the content as you scroll. Scrolling sends light
 * racing along the strands in the same direction (down when you scroll down, up when you scroll up), faster and brighter
 * the faster you scroll; at rest the light drifts slowly and the strands keep weaving. On a narrow screen it is a slim
 * line at the very edge. `colors`: core → middle → edge → end (the brand palette). Pointer events pass through; it pauses
 * in a hidden tab, and with "reduce motion" it is drawn once and stays still.
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
    const count = narrow() ? 12 : 30;
    const strands = Array.from({ length: count }, (_, i) => ({
      k: i / (count - 1) - 0.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.8,
      width: 0.5 + Math.random() * 1,
      shine: 0.3 + Math.random() * 0.45,
      // Where the light pulse on this strand is, 0 (top of the screen) – 1 (bottom); it can run either way.
      pulse: Math.random(),
      pace: 0.6 + Math.random() * 0.8,
    }));
    const dust = Array.from({ length: narrow() ? 8 : 22 }, () => ({
      off: (Math.random() - 0.5) * 2.4,
      y: Math.random(),
      r: 0.6 + Math.random() * 1.8,
      a: 0.2 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    }));

    let scrollY = window.scrollY;
    let lastScrollY = scrollY;
    // How fast and which way the page moves, in screens per frame, smoothed: + down, − up.
    let flow = 0;
    let lastTime = 0;
    const onScroll = () => {
      scrollY = window.scrollY;
      if (still) draw(0);
    };

    function draw(time: number) {
      const dt = Math.min(50, lastTime ? time - lastTime : 16) / 16; // 1 = one frame at 60 fps
      lastTime = time;
      const t = time * 0.001;
      if (!still) {
        flow += ((scrollY - lastScrollY) / h - flow) * 0.25 * dt;
        lastScrollY = scrollY;
      }
      const rush = Math.min(1, Math.abs(flow) * 25);

      // Where the river runs: the middle of the side margin, on the picture side (left in Arabic).
      const rtl = document.documentElement.dir === "rtl";
      const gutter = Math.max(0, (w - CONTENT) / 2);
      const thin = narrow() || gutter < 60;
      const half = thin ? 7 : Math.min(70, gutter * 0.32); // half the river's width
      const fromEdge = thin ? 10 : Math.max(half + 14, gutter * 0.5);
      const base = rtl ? fromEdge : w - fromEdge;

      // The river's bends are tied to the page (they move with the content), and they breathe a little over time.
      const bend = (y: number) => {
        const py = y + scrollY;
        const amp = thin ? 4 : Math.min(gutter * 0.18, 40);
        return amp * Math.sin(py * 0.0042 + t * 0.15) + amp * 0.6 * Math.sin(py * 0.0013 + 1.3);
      };
      const STEP = 22;
      const line = (s: (typeof strands)[number] | null) => {
        const pts: [number, number][] = [];
        for (let y = -STEP; y <= h + STEP; y += STEP) {
          let x = base + bend(y);
          if (s) {
            // Each strand weaves around the river's middle on its own rhythm (more while the page moves).
            // Long, slow waves with close phases, so the strands flow together like water instead of tangling.
            const weave = still ? 0 : Math.sin(y * 0.005 + t * s.speed * 0.6 * (1 + rush * 2) + s.phase * 0.35) * half * (0.12 + rush * 0.3);
            x += s.k * 2 * half + weave;
          }
          pts.push([x, y]);
        }
        return pts;
      };
      const stroke = (pts: [number, number][]) => {
        ctx!.beginPath();
        ctx!.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx!.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        ctx!.stroke();
      };

      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";

      // The strands fade in at the top of the screen and out at the bottom.
      const body = ctx!.createLinearGradient(0, 0, 0, h);
      body.addColorStop(0, colors[3]);
      body.addColorStop(0.15, colors[1]);
      body.addColorStop(0.5, colors[0]);
      body.addColorStop(0.85, colors[2]);
      body.addColorStop(1, colors[3]);

      // A soft haze along the river: the glow the strands sit in.
      ctx!.strokeStyle = body;
      ctx!.globalAlpha = 0.05 + rush * 0.05;
      ctx!.lineWidth = half * 3;
      stroke(line(null));

      for (const s of strands) {
        const pts = line(s);
        const center = 1 - Math.abs(s.k) * 1.1;
        ctx!.strokeStyle = body;
        for (const [lineWidth, alpha] of [
          [s.width * 6, 0.06],
          [s.width, s.shine],
        ]) {
          ctx!.globalAlpha = Math.max(0.05, alpha * center * (thin ? 0.8 : 1));
          ctx!.lineWidth = lineWidth;
          stroke(pts);
        }

        // The light racing along the strand: with the scroll (down or up), slowly downward at rest.
        if (!still) s.pulse += (0.0012 * s.pace + flow * 1.6 * s.pace) * dt;
        if (s.pulse > 1.2) s.pulse -= 1.4;
        if (s.pulse < -0.2) s.pulse += 1.4;
        const p = s.pulse;
        if (p > -0.1 && p < 1.1) {
          const up = flow < -0.0005;
          const tail = 0.08 + rush * 0.16; // a longer streak the faster it goes
          const clamp = (v: number) => Math.min(1, Math.max(0, v));
          // The bright head leads; the tail trails behind it (above it going down, below it going up).
          const head = p;
          const tailEnd = up ? p + tail : p - tail;
          if (Math.max(head, tailEnd) > 0 && Math.min(head, tailEnd) < 1) {
            const glow = ctx!.createLinearGradient(0, 0, 0, h);
            if (up) {
              glow.addColorStop(clamp(head - 0.006), "transparent");
              glow.addColorStop(clamp(head), "#fff4ef");
              glow.addColorStop(clamp(tailEnd), "transparent");
            } else {
              glow.addColorStop(clamp(tailEnd), "transparent");
              glow.addColorStop(clamp(head), "#fff4ef");
              glow.addColorStop(clamp(head + 0.006), "transparent");
            }
            ctx!.strokeStyle = glow;
            ctx!.globalAlpha = (0.75 + rush * 0.25) * Math.max(0.4, center);
            ctx!.lineWidth = s.width * (2.2 + rush * 1.5);
            stroke(pts);
          }
        }
      }

      // Specks of light beside the river, carried along with the page.
      ctx!.fillStyle = colors[0];
      for (const d of dust) {
        if (!still) d.y += (0.0006 + flow * 1.2) * dt;
        if (d.y > 1.05) d.y -= 1.1;
        if (d.y < -0.05) d.y += 1.1;
        const y = d.y * h;
        ctx!.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * 2 + d.phase)) * (thin ? 0.6 : 1);
        ctx!.beginPath();
        ctx!.arc(base + bend(y) + d.off * half, y, d.r, 0, Math.PI * 2);
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
    if (still) draw(0);
    else frame = requestAnimationFrame(loop);
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => {
      resize();
      if (still) draw(0);
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
