// The moving part of a celebration, drawn on one <canvas> over the page: confetti shot from the two bottom corners,
// confetti falling from the top, and fireworks. No library: a few hundred small shapes with gravity, air and a flutter,
// in the brand's colours (wine, rose, blush) with gold and cream. It stops by itself when everything has landed or faded.
// The overlay does not start it at all for "reduce motion".

export type Effect = "good" | "big" | "birthday" | "birthday-today" | "birthday-soon";

const COLORS = ["#7c0e44", "#aa5e7a", "#d49a9a", "#f2dace", "#e7bf6a", "#faf3ef", "#c9445f"];
const SPARKS = ["#f7d88a", "#ffd1dc", "#f2dace", "#ffffff", "#e7bf6a", "#ff9fb5"];

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Turning on the page (radians) and how fast. */
  rot: number;
  spin: number;
  /** The flutter: a piece of paper shows its face, then its edge. */
  flip: number;
  flipSpeed: number;
  w: number;
  h: number;
  color: string;
  shape: "paper" | "dot" | "streamer" | "spark";
  /** Frames left (sparks fade out over their life). */
  life: number;
  max: number;
  gravity: number;
  drag: number;
}

interface Rocket {
  x: number;
  y: number;
  vy: number;
  top: number;
  color: string;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** Starts the effect on the canvas (sized to the window). Returns a function that stops it at once. */
export function startEffect(canvas: HTMLCanvasElement, effect: Effect): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;
  const size = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * ratio);
    canvas.height = Math.round(H * ratio);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  size();
  window.addEventListener("resize", size);

  // Smaller screens get fewer pieces (a phone stays smooth).
  const scale = Math.min(1, Math.max(0.55, (W * H) / (1440 * 900)));
  const bits: Bit[] = [];
  const rockets: Rocket[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

  const paper = (x: number, y: number, vx: number, vy: number, colors = COLORS): Bit => {
    const shape = Math.random() < 0.14 ? "streamer" : Math.random() < 0.22 ? "dot" : "paper";
    return {
      x,
      y,
      vx,
      vy,
      rot: rand(0, Math.PI * 2),
      spin: rand(-0.2, 0.2),
      flip: rand(0, Math.PI * 2),
      flipSpeed: rand(0.08, 0.22),
      w: shape === "streamer" ? rand(3, 4) : rand(7, 11),
      h: shape === "streamer" ? rand(16, 24) : shape === "dot" ? 0 : rand(4, 7),
      color: pick(colors),
      shape,
      life: 420,
      max: 420,
      gravity: 0.16,
      drag: 0.985,
    };
  };

  /** A burst from one bottom corner, aimed up and inwards. */
  const cannon = (side: "start" | "end", count: number) => {
    const fromLeft = side === "start";
    const x = fromLeft ? -10 : W + 10;
    for (let i = 0; i < count * scale; i++) {
      const angle = rand(52, 76) * (Math.PI / 180);
      const speed = rand(11, 19) * Math.min(1.15, Math.max(0.75, H / 800));
      bits.push(paper(x, H + 10, Math.cos(angle) * speed * (fromLeft ? 1 : -1), -Math.sin(angle) * speed));
    }
  };

  /** Confetti falling from the top across the whole width. */
  const rain = (count: number, colors = COLORS) => {
    for (let i = 0; i < count * scale; i++) {
      const b = paper(rand(0, W), rand(-H * 0.6, -10), rand(-1, 1), rand(1, 3), colors);
      b.gravity = 0.05;
      b.drag = 0.99;
      bits.push(b);
    }
  };

  const launch = () => {
    rockets.push({ x: rand(W * 0.18, W * 0.82), y: H + 10, vy: -rand(9, 12.5) * Math.min(1.2, H / 800), top: rand(H * 0.16, H * 0.42), color: pick(SPARKS) });
  };

  const explode = (r: Rocket) => {
    const n = Math.round(rand(56, 80) * scale) + 20;
    const power = rand(4.2, 6.2);
    const second = pick(SPARKS);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05);
      const s = power * rand(0.55, 1);
      const life = Math.round(rand(55, 85));
      bits.push({ x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: 0, spin: 0, flip: 0, flipSpeed: 0, w: rand(2.2, 3.4), h: 0, color: i % 3 ? r.color : second, shape: "spark", life, max: life, gravity: 0.045, drag: 0.972 });
    }
  };

  // The program of each effect.
  if (effect === "good") {
    cannon("start", 110);
    cannon("end", 110);
    later(650, () => {
      cannon("start", 60);
      cannon("end", 60);
    });
  } else if (effect === "big") {
    for (let i = 0; i < 9; i++) later(i * 420 + (i % 2) * 120, launch);
    later(250, () => {
      cannon("start", 90);
      cannon("end", 90);
    });
    later(2600, () => rain(140, [...COLORS, "#e7bf6a", "#e7bf6a"]));
  } else if (effect === "birthday") {
    cannon("start", 90);
    cannon("end", 90);
    later(900, () => rain(120));
  } else if (effect === "birthday-today") {
    rain(110);
  } else {
    // A week before: a light shower only.
    rain(55, ["#d49a9a", "#f2dace", "#e7bf6a", "#aa5e7a"]);
  }

  let frame = 0;
  let stopped = false;
  const started = performance.now();
  let last = started;
  const step = (now: number) => {
    if (stopped) return;
    // Moves by the time that passed, not by frames: the same speed on a 60 Hz laptop, a 120 Hz phone or a slow one
    // (t = 1 is one frame at 60 Hz; a long pause counts as at most 3).
    const t = Math.min(3, Math.max(0.25, (now - last) / 16.667));
    last = now;
    ctx.clearRect(0, 0, W, H);

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.y += r.vy * t;
      r.vy *= 0.985 ** t;
      // The rising trail.
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.fillRect(r.x - 1, r.y, 2, 14);
      if (r.y <= r.top || r.vy > -2) {
        explode(r);
        rockets.splice(i, 1);
      }
    }

    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      const air = b.drag ** t;
      b.vx *= air;
      b.vy = b.vy * air + b.gravity * t;
      b.x += (b.vx + (b.shape === "spark" ? 0 : Math.sin(b.flip) * 0.6)) * t;
      b.y += b.vy * t;
      b.rot += b.spin * t;
      b.flip += b.flipSpeed * t;
      b.life -= t;
      if (b.life <= 0 || b.y > H + 40 || b.x < -60 || b.x > W + 60) {
        bits.splice(i, 1);
        continue;
      }
      const fade = b.shape === "spark" ? b.life / b.max : Math.min(1, b.life / 60);
      ctx.globalAlpha = fade;
      ctx.fillStyle = b.color;
      if (b.shape === "spark") {
        // A bright point with a soft halo, added on top of what is under it (light adds up, as in real fireworks).
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.w * (0.6 + fade * 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade * 0.25;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.w * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        continue;
      }
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      if (b.shape === "dot") {
        ctx.scale(1, Math.abs(Math.cos(b.flip)) * 0.7 + 0.3);
        ctx.beginPath();
        ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Paper and streamers flutter: they narrow to an edge and open again.
        ctx.scale(1, Math.cos(b.flip));
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    frame++;
    // Still busy while pieces fly, rockets rise, or a later burst is still to come (the last starts before 5 s).
    const busy = bits.length > 0 || rockets.length > 0 || now - started < 5000;
    if (busy || frame < 30) requestAnimationFrame(step);
    else ctx.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(step);

  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
    window.removeEventListener("resize", size);
    ctx.clearRect(0, 0, W, H);
  };
}
