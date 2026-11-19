import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";

/** Space kept between the river and a block of content (px). */
const PAD = 18;
/** The route is worked out every this many pixels down the page. */
const STEP = 20;

/**
 * Where an element sits in the page's layout (px from the page's top-left), ignoring transforms: a block that is still
 * sliding or growing into place (the plate, the cards that settle in) is avoided where it will end up.
 */
function layoutBox(el: HTMLElement) {
  let left = 0;
  let top = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) {
    left += e.offsetLeft;
    top += e.offsetTop;
  }
  return { left, top, width: el.offsetWidth, height: el.offsetHeight };
}

/**
 * A river of light that winds down the page **between** the content: through the gaps between the blocks (the headline,
 * the window, the cards…), never under them. The blocks it avoids are the elements matching `avoid` (by default
 * `[data-river-avoid]`, and the children of `[data-river-avoid-children]`). The route is drawn on the page itself, so it
 * travels with the content as you scroll. The motion is calm: the strands flow slowly and the light runs down them at a
 * steady, gentle pace, whatever the scroll does. `colors`: core → middle → edge → end (the brand palette). Pointer events
 * pass through; it pauses in a hidden tab, and with "reduce motion" the strands stay still (the route still follows the
 * page).
 */
export function LightRiver({
  colors,
  avoid = "[data-river-avoid], [data-river-avoid-children] > *",
  className,
}: {
  colors: [string, string, string, string];
  avoid?: string;
  className?: string;
}) {
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

    const narrow = () => w < 768;
    const half = () => (narrow() ? 6 : 16); // half the river's width
    const count = narrow() ? 8 : 18;
    const strands = Array.from({ length: count }, (_, i) => ({
      k: i / (count - 1) - 0.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 0.4,
      width: 0.6 + Math.random() * 0.9,
      shine: 0.35 + Math.random() * 0.4,
      // The light running down this strand: where it is on the page (px) and how fast it goes (px per frame).
      pulse: Math.random() * 3000,
      pace: 0.6 + Math.random() * 0.6,
    }));
    const dust = Array.from({ length: narrow() ? 10 : 26 }, () => ({
      y: Math.random() * 3000,
      off: (Math.random() - 0.5) * 3,
      r: 0.6 + Math.random() * 1.6,
      a: 0.2 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
    }));

    // The route: for every STEP px down the page, where the river's middle is (x, px).
    let route: number[] = [];
    let pageH = 0;

    /**
     * Works the route out from where the blocks are: at each height it takes the free space between the blocks, keeps
     * going straight while it fits there, and moves to the nearest free space when a block is in the way. Then it is
     * smoothed into long curves.
     */
    function plan() {
      pageH = document.documentElement.scrollHeight;
      const hw = half();
      const blocks = Array.from(document.querySelectorAll<HTMLElement>(avoid))
        .map(layoutBox)
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({ l: r.left - PAD, r: r.left + r.width + PAD, t: r.top - PAD, b: r.top + r.height + PAD }));
      const edge = narrow() ? 4 : 10;
      const need = hw * 2 + 6;
      const n = Math.ceil(pageH / STEP) + 2;
      const xs: number[] = new Array(n).fill(NaN);
      let prev = w / 2;
      // Rows with no block beside them, in a row: across open space the river is free to move to a better gap.
      let open = 0;
      for (let i = 0; i < n; i++) {
        const y = i * STEP;
        const here = blocks.filter((b) => y >= b.t && y <= b.b).sort((a, b) => a.l - b.l);
        if (!here.length) {
          open++;
          continue; // filled in below: a straight glide between the rows around it
        }
        // The free spaces across the screen at this height.
        const free: [number, number][] = [];
        let x = edge;
        for (const b of here) {
          if (b.l > x) free.push([x, b.l]);
          x = Math.max(x, b.r);
        }
        if (w - edge > x) free.push([x, w - edge]);
        const wide = free.filter(([a, b]) => b - a >= need);
        const widest = free.length ? free.reduce((m, f) => (f[1] - f[0] > m[1] - m[0] ? f : m)) : ([edge, edge + need] as [number, number]);
        const choices = wide.length ? wide : [widest];
        const isEdge = (g: [number, number]) => g[0] <= edge + 1 || g[1] >= w - edge - 1;
        const fresh = i === 0 || open >= 3;
        // Coming out of open space: the best gap BETWEEN the blocks (not the screen's edge), near the middle. Otherwise:
        // the nearest gap to where the river already is, so it runs on smoothly (a gap between blocks still preferred).
        const cost = fresh
          ? (g: [number, number]) => (isEdge(g) ? 1000 : 0) + Math.abs((g[0] + g[1]) / 2 - w / 2) * 0.5 - (g[1] - g[0]) * 0.05
          : (g: [number, number]) => Math.abs(Math.min(Math.max(prev, g[0] + hw), g[1] - hw) - prev) - (g[1] - g[0]) * 0.05 + (isEdge(g) ? 160 : 0);
        const [a, b] = choices.reduce((best, f) => (cost(f) < cost(best) ? f : best));
        const inset = Math.min(hw + 2, (b - a) / 2);
        prev = fresh ? (a + b) / 2 : Math.min(Math.max(prev, a + inset), b - inset);
        xs[i] = prev;
        open = 0;
      }
      // Across open space: a straight glide from the row before to the row after.
      for (let i = 0; i < n; i++) {
        if (!Number.isNaN(xs[i])) continue;
        let j = i;
        while (j < n && Number.isNaN(xs[j])) j++;
        const from = i > 0 ? xs[i - 1] : j < n ? xs[j] : w / 2;
        const to = j < n ? xs[j] : from;
        for (let k = i; k < j; k++) xs[k] = from + ((to - from) * (k - i + 1)) / (j - i + 1);
        i = j;
      }
      // Long, smooth curves instead of corners.
      let sm = xs;
      for (let pass = 0; pass < 6; pass++) {
        sm = sm.map((_, i) => {
          let sum = 0;
          let c = 0;
          for (let j = i - 4; j <= i + 4; j++) {
            if (j >= 0 && j < sm.length) {
              sum += sm[j];
              c++;
            }
          }
          return sum / c;
        });
      }
      route = sm;
    }

    const routeAt = (pageY: number) => {
      if (route.length < 2) return w / 2;
      const f = Math.max(0, pageY / STEP);
      const i = Math.min(route.length - 2, Math.floor(f));
      return route[i] + (route[i + 1] - route[i]) * Math.min(1, f - i);
    };

    let lastTime = 0;
    function draw(time: number) {
      const dt = Math.min(50, lastTime ? time - lastTime : 16) / 16; // 1 = one frame at 60 fps
      lastTime = time;
      const t = time * 0.001;
      const sy = window.scrollY;
      const hw = half();

      const line = (s: (typeof strands)[number] | null) => {
        const pts: [number, number][] = [];
        const top = Math.floor((sy - STEP * 2) / STEP) * STEP;
        for (let py = top; py <= sy + h + STEP * 2; py += STEP) {
          let x = routeAt(py);
          if (s) {
            // Each strand flows slowly around the river's middle (calm: it does not speed up with the scroll).
            const weave = still ? 0 : Math.sin(py * 0.006 + t * s.speed + s.phase * 0.35) * hw * 0.22;
            x += s.k * 2 * hw + weave;
          }
          pts.push([x, py - sy]);
        }
        return pts;
      };
      const stroke = (pts: [number, number][]) => {
        ctx!.beginPath();
        ctx!.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          ctx!.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
        }
        ctx!.stroke();
      };

      ctx!.clearRect(0, 0, w, h);
      if (route.length < 2) return;
      ctx!.globalCompositeOperation = "lighter";

      // The strands' colour: blush in the middle of the screen, deeper toward the top and the bottom.
      const body = ctx!.createLinearGradient(0, 0, 0, h);
      body.addColorStop(0, colors[2]);
      body.addColorStop(0.35, colors[0]);
      body.addColorStop(0.65, colors[1]);
      body.addColorStop(1, colors[2]);

      // A soft haze along the river.
      ctx!.strokeStyle = body;
      ctx!.globalAlpha = 0.06;
      ctx!.lineWidth = hw * 4;
      stroke(line(null));

      for (const s of strands) {
        const pts = line(s);
        const center = 1 - Math.abs(s.k) * 1.1;
        ctx!.strokeStyle = body;
        for (const [lineWidth, alpha] of [
          [s.width * 6, 0.06],
          [s.width, s.shine],
        ]) {
          ctx!.globalAlpha = Math.max(0.06, alpha * center);
          ctx!.lineWidth = lineWidth;
          stroke(pts);
        }

        // The light running gently down the strand, at its own steady pace.
        if (!still) s.pulse = (s.pulse + s.pace * dt) % Math.max(pageH, 1);
        const head = (s.pulse - sy) / h;
        const tail = 140 / h;
        if (head > 0 && head - tail < 1) {
          const glow = ctx!.createLinearGradient(0, 0, 0, h);
          const clamp = (v: number) => Math.min(1, Math.max(0, v));
          glow.addColorStop(clamp(head - tail), "transparent");
          glow.addColorStop(clamp(head), "#fff4ef");
          glow.addColorStop(clamp(head + 0.006), "transparent");
          ctx!.strokeStyle = glow;
          ctx!.globalAlpha = 0.7 * Math.max(0.4, center);
          ctx!.lineWidth = s.width * 2;
          stroke(pts);
        }
      }

      // Specks of light along the river, drifting slowly down the page.
      ctx!.fillStyle = colors[0];
      for (const d of dust) {
        if (!still) d.y = (d.y + 0.25 * dt) % Math.max(pageH, 1);
        const y = d.y - sy;
        if (y < -10 || y > h + 10) continue;
        ctx!.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * 1.5 + d.phase));
        ctx!.beginPath();
        ctx!.arc(routeAt(d.y) + d.off * hw, y, d.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
    }

    // Work the route out again whenever the page's layout changes (fonts, images, demo accounts, a resize…).
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
  }, [colors, avoid]);

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none fixed inset-0 h-full w-full", className)} />;
}
