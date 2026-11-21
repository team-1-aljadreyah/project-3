import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/** Every layer of the drawing uses the same frame, so the layers sit exactly on top of each other. */
const VIEW = "12 8 156 172";

/** One layer of the drawing (a whole-size SVG). Only whole layers move, never shapes inside them: see styles.css. */
function Layer({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox={VIEW} className={cn("mc-layer", className)}>
      {children}
    </svg>
  );
}

const SLEEVE = { fill: "url(#mc-sleeve)", stroke: "#D49A9A", strokeOpacity: 0.7, strokeWidth: 1 };
const RIM = { fill: "#FFE1E8", opacity: 0.75 };
const LINE = { fill: "none", strokeLinecap: "round" } as const;

/**
 * The monitoring officer's little character in her dashboard banner (monitor-summary.tsx): a young woman with a blonde
 * ponytail, a blush top and a wine scarf, holding a tablet with a small chart on it (the client, 21 November 2026:
 * "make it blonde with no glasses, make the eyes follow the mouse, improve the hand waving, especially the arm"). She is drawn here
 * in code (shapes and soft gradients, no picture files) and the styles at the end of app/styles.css bring her to life:
 * she breathes, tilts her head, blinks, swipes the tablet and her ponytail sways. Her eyes (and a little her head)
 * follow the mouse anywhere on the page. When the mouse goes over her she waves once: the arm lifts at the shoulder,
 * waves at the elbow, and the hand follows a moment later at the wrist. She is only decoration: hidden from screen readers, and only her own shape takes
 * the mouse. The drawing faces the page from the right; in Arabic the styles mirror her to the left side.
 *
 * Each moving part is its own layer, and only whole layers move (turn, slide, fade), so the graphics card moves them
 * and nothing is redrawn while she is idle.
 */
export function MonitorCharacter({ className }: { className?: string }) {
  const [waving, setWaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Her eyes follow the mouse: where it is, as a direction from her eyes (-1 to 1 each way), written into two CSS
  // variables at most once a frame; the irises and the head move by them (styles.css: .mc-look, .mc-gaze). No React
  // update, so it costs nothing. In Arabic she is mirrored, so left and right swap. "Reduce motion": she stays still.
  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let px = 0;
    let py = 0;
    const look = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const dx = px - (r.left + r.width / 2);
      const dy = py - (r.top + r.height * 0.42);
      const far = Math.hypot(dx, dy) || 1;
      // Close to her face she looks only a little; from about her own height away, all the way.
      const k = Math.min(1, far / Math.max(80, r.height));
      const mirrored = el.closest("[dir]")?.getAttribute("dir") === "rtl";
      el.style.setProperty("--look-x", ((dx / far) * k * (mirrored ? -1 : 1)).toFixed(3));
      el.style.setProperty("--look-y", ((dy / far) * k).toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(look);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    // The mouse over her starts one wave; it plays to its end even if the mouse leaves, then she goes back to idle.
    <div
      ref={box}
      aria-hidden="true"
      className={cn("mc", waving && "is-waving", className)}
      onPointerEnter={() => setWaving(true)}
      onAnimationEnd={(e) => e.animationName === "mc-wave" && setWaving(false)}
    >
      <Layer>
        <defs>
          {/* Skin: light where the light falls (top left), warmer toward the edges, for a soft round look. */}
          <radialGradient id="mc-skin" cx="0.4" cy="0.32" r="0.75">
            <stop offset="0" stopColor="#FFF1E8" />
            <stop offset="0.55" stopColor="#FAD7C4" />
            <stop offset="1" stopColor="#EBB39B" />
          </radialGradient>
          <linearGradient id="mc-skin-hand" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#FCE0D0" />
            <stop offset="1" stopColor="#EDB8A0" />
          </linearGradient>
          {/* The neck is in the head's shadow at the top. */}
          <linearGradient id="mc-neck" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D8957E" />
            <stop offset="0.7" stopColor="#F3C8B3" />
          </linearGradient>
          {/* Blonde: pale gold where the light falls, honey toward the edges. */}
          <radialGradient id="mc-hair" cx="0.36" cy="0.2" r="0.9">
            <stop offset="0" stopColor="#FCEBB8" />
            <stop offset="0.45" stopColor="#E6BF6C" />
            <stop offset="1" stopColor="#B4843A" />
          </radialGradient>
          <linearGradient id="mc-pony" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F4D690" />
            <stop offset="0.6" stopColor="#D6A856" />
            <stop offset="1" stopColor="#A6752E" />
          </linearGradient>
          {/* The blush top: almost white in the light, dusty rose in the folds. */}
          <radialGradient id="mc-top" cx="0.38" cy="0.12" r="0.95">
            <stop offset="0" stopColor="#FFF6F1" />
            <stop offset="0.45" stopColor="#F2DACE" />
            <stop offset="1" stopColor="#D6A39E" />
          </radialGradient>
          <linearGradient id="mc-sleeve" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F8E6DD" />
            <stop offset="1" stopColor="#D7A6A0" />
          </linearGradient>
          {/* The waving arm's sleeve, shaded along the arm (in the drawing's own units, so a straight stroke gets it). */}
          <linearGradient id="mc-sleeve-arm" gradientUnits="userSpaceOnUse" x1="30" y1="120" x2="62" y2="150">
            <stop offset="0" stopColor="#FBEDE6" />
            <stop offset="1" stopColor="#E2B5AE" />
          </linearGradient>
          <linearGradient id="mc-scarf" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#A8396E" />
            <stop offset="0.5" stopColor="#7C0E44" />
            <stop offset="1" stopColor="#540729" />
          </linearGradient>
          <radialGradient id="mc-cheek">
            <stop offset="0" stopColor="#F2899C" stopOpacity="0.6" />
            <stop offset="1" stopColor="#F2899C" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mc-iris" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1E0B12" />
            <stop offset="0.55" stopColor="#4A2230" />
            <stop offset="1" stopColor="#8A4C5C" />
          </linearGradient>
          <linearGradient id="mc-tablet" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5A3046" />
            <stop offset="1" stopColor="#2A1420" />
          </linearGradient>
          <linearGradient id="mc-screen" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#F6E3E8" />
          </linearGradient>
          <radialGradient id="mc-glow">
            <stop offset="0" stopColor="#F2DACE" stopOpacity="0.42" />
            <stop offset="0.6" stopColor="#D49A9A" stopOpacity="0.12" />
            <stop offset="1" stopColor="#D49A9A" stopOpacity="0" />
          </radialGradient>
          <clipPath id="mc-eye-clip">
            <ellipse cx="76" cy="78.4" rx="7.2" ry="8" />
            <ellipse cx="104" cy="78.4" rx="7.2" ry="8" />
          </clipPath>
          <clipPath id="mc-face-clip">
            <path d="M56 70C56 46 72 36 90 36C108 36 124 46 124 70C124 88 114 104 96 108Q90 110 84 108C66 104 56 88 56 70Z" />
          </clipPath>
          {/* Shapes used twice: once as a pale rim (the light behind her) and once in colour on top. */}
          <path id="mc-pony-shape" d="M117 30C138 19 159 34 155 61C152 84 141 99 149 123C135 115 126 95 129 74C131 58 128 45 115 38Z" />
          <path id="mc-hair-shape" d="M50 79C44 42 66 15 92 15C120 15 141 40 134 79C132 87 128 92 123 95H58C54 91 51 86 50 79Z" />
          <path id="mc-torso-shape" d="M34 182C34 150 46 130 72 124C80 121 100 121 108 124C134 130 146 150 146 182Z" />
          <path
            id="mc-fringe"
            d="M53 77C50 46 68 23 92 23C116 23 133 42 130 76C127 67 122 61 116 58C115.5 60 114.5 61.5 112.5 63C109.5 58 105 54 100 51C99.5 52.5 98.5 54 96.5 55C91 50 84 46 77 45C70 50 62 58 58 72Z"
          />
        </defs>
        {/* A soft rose glow behind her, so she stands out from the wine banner. */}
        <ellipse cx="92" cy="112" rx="78" ry="74" fill="url(#mc-glow)" />
      </Layer>

      {/* Everything below breathes together. */}
      <div className="mc-stack mc-breathe">
        {/* Her body: the blush top with its rim light, the neck, the wine scarf, and the hand holding the tablet. */}
        <Layer>
          <g className="mc-hit">
            <use href="#mc-torso-shape" {...RIM} transform="translate(1.6 -1.4)" />
            <use href="#mc-torso-shape" fill="url(#mc-top)" />
            <path d="M58 146Q63 162 60 182" {...LINE} stroke="#D49A9A" strokeOpacity="0.55" strokeWidth="1.4" />
            <path d="M124 146Q119 162 122 182" {...LINE} stroke="#D49A9A" strokeOpacity="0.45" strokeWidth="1.4" />
            <path d="M82 100C82 108 81 116 80 124H100C99 116 98 108 98 100Z" fill="url(#mc-neck)" />
            <g transform="translate(0 -3)">
              <path d="M70 118C78 128 102 128 110 118C116 122 116 132 108 136C98 142 82 142 72 136C64 132 64 122 70 118Z" fill="url(#mc-scarf)" />
              <path d="M74 128C82 134 98 134 106 128" {...LINE} stroke="#C45B8B" strokeOpacity="0.7" strokeWidth="1.5" />
              {/* The knot on one side and its two ends hanging down, and a few small dots. */}
              <path d="M74 137C70 148 67 157 69 168L78 166C77 157 79 148 82 139Z" fill="url(#mc-scarf)" />
              <path d="M80 138C83 148 86 155 85 164L92 161C91 152 88 145 84 137Z" fill="#62082F" />
              <ellipse cx="78" cy="137" rx="6.5" ry="5" fill="#6E0B3B" />
              <ellipse cx="76.5" cy="135.5" rx="2.6" ry="1.6" fill="#B34A7C" opacity="0.8" />
              <g fill="#D49A9A" opacity="0.8">
                <circle cx="88" cy="131" r="1" />
                <circle cx="99" cy="130" r="1" />
                <circle cx="106" cy="125" r="1" />
                <circle cx="73" cy="152" r="0.9" />
              </g>
            </g>
            {/* The holding hand: its palm behind the tablet, the tablet with a small chart, then the thumb in front. */}
            <path d="M147 182C145 168 137 160 124 157L119 169C127 171 132 176 132 182Z" {...SLEEVE} />
            <ellipse cx="124" cy="160" rx="6" ry="7.5" fill="url(#mc-skin-hand)" />
            <g transform="rotate(-6 98 160)">
              <rect x="72" y="142" width="52" height="36" rx="5" fill="url(#mc-tablet)" />
              <rect x="72.5" y="142.5" width="51" height="35" rx="4.5" fill="none" stroke="#B07890" strokeOpacity="0.6" />
              <rect x="75.5" y="145.5" width="45" height="29" rx="2.5" fill="url(#mc-screen)" />
              <rect x="79" y="148.5" width="13" height="2" rx="1" fill="#E7C9D1" />
              <rect x="80" y="163" width="5" height="8" rx="1" fill="#D49A9A" />
              <rect x="88" y="159" width="5" height="12" rx="1" fill="#AA5E7A" />
              <rect x="96" y="161" width="5" height="10" rx="1" fill="#D49A9A" />
              <rect x="104" y="156" width="5" height="15" rx="1" fill="#7C0E44" />
              <polyline points="80,158 90,154 99,156 113,149" {...LINE} stroke="#AA5E7A" strokeWidth="1.2" strokeLinejoin="round" />
              <circle cx="113" cy="149" r="1.7" fill="#7C0E44" />
            </g>
            <path d="M121 151.5C117.5 152.5 116.5 156 118 158.5C120.5 158.5 122.5 156 122 153Z" fill="url(#mc-skin-hand)" />
          </g>
        </Layer>

        {/* The head turns a touch toward the mouse (mc-gaze) and tilts a little from side to side (mc-head). */}
        <div className="mc-stack mc-gaze">
        <div className="mc-stack mc-head">
          {/* The ponytail swings from its tie at the back of the head. */}
          <Layer className="mc-pony">
            <g className="mc-hit">
              <use href="#mc-pony-shape" {...RIM} transform="translate(1.6 -1.2)" />
              <use href="#mc-pony-shape" fill="url(#mc-pony)" />
              <path d="M124 37C142 45 147 63 140 86" {...LINE} stroke="#B98A3C" strokeOpacity="0.8" strokeWidth="1.2" />
              <path d="M137 29C149 35 152 48 150 59" {...LINE} stroke="#FFF3C9" strokeOpacity="0.7" strokeWidth="2.2" />
              <path d="M131 52C136 70 134 90 141 108" {...LINE} stroke="#C9963F" strokeOpacity="0.55" strokeWidth="1" />
            </g>
          </Layer>

          {/* The back of the hair, the hair tie, the ears and the face (without the eyes and the mouth). */}
          <Layer>
            <g className="mc-hit">
              <use href="#mc-hair-shape" {...RIM} transform="translate(1.6 -1.4)" />
              <use href="#mc-hair-shape" fill="url(#mc-hair)" />
              <ellipse cx="119" cy="29" rx="4.2" ry="5.2" fill="#AA5E7A" transform="rotate(28 119 29)" />
              <ellipse cx="118" cy="27.5" rx="1.6" ry="2.2" fill="#E3A9BC" transform="rotate(28 118 27.5)" />
              <ellipse cx="55.5" cy="81" rx="5.5" ry="7" fill="url(#mc-skin-hand)" />
              <ellipse cx="124.5" cy="81" rx="5.5" ry="7" fill="url(#mc-skin-hand)" />
              <path d="M54 78Q52 81 54.5 85" {...LINE} stroke="#DB9A84" strokeWidth="1.2" />
              <path d="M126 78Q128 81 125.5 85" {...LINE} stroke="#DB9A84" strokeWidth="1.2" />
              <path d="M56 70C56 46 72 36 90 36C108 36 124 46 124 70C124 88 114 104 96 108Q90 110 84 108C66 104 56 88 56 70Z" fill="url(#mc-skin)" />
              {/* The fringe's soft shadow on the forehead and a soft shine: what makes the face look round. */}
              <g clipPath="url(#mc-face-clip)">
                <use href="#mc-fringe" fill="#D9967F" opacity="0.45" transform="translate(0.6 3)" />
              </g>
              <ellipse cx="74" cy="58" rx="12" ry="6" fill="#fff" opacity="0.22" transform="rotate(-18 74 58)" />
              <ellipse cx="70" cy="93" rx="8.5" ry="5.5" fill="url(#mc-cheek)" />
              <ellipse cx="110" cy="93" rx="8.5" ry="5.5" fill="url(#mc-cheek)" />
              <path d="M68 62Q76 58 84 61" {...LINE} stroke="#9C6B32" strokeWidth="2.2" />
              <path d="M96 61Q104 58 112 62" {...LINE} stroke="#9C6B32" strokeWidth="2.2" />
              <path d="M90 86q1.6 2 0 3.6" {...LINE} stroke="#D38D78" strokeWidth="1.3" />
            </g>
          </Layer>

          {/* Her usual face: open eyes (they blink) and a small smile. It steps aside while she waves. */}
          <div className="mc-stack mc-idle-face">
            {/* The eyes blink together; inside them the irises look toward the mouse (--look-x/-y, set above). */}
            <div className="mc-stack mc-eyes">
              <Layer>
                {/* The whites, clipped to the eye shape, so the irises have room to move. */}
                <ellipse cx="76" cy="78.4" rx="7.2" ry="8" fill="#FFFDFB" />
                <ellipse cx="104" cy="78.4" rx="7.2" ry="8" fill="#FFFDFB" />
              </Layer>
              <Layer>
                {/* The irises move inside the whites (clipped to them), so looking aside hides part of the iris. */}
                <g clipPath="url(#mc-eye-clip)">
                  <g className="mc-look">
                    <ellipse cx="76" cy="78.6" rx="5.4" ry="6.6" fill="url(#mc-iris)" />
                    <ellipse cx="76" cy="79" rx="2.6" ry="3.4" fill="#14060B" />
                    <circle cx="78" cy="75.6" r="1.9" fill="#fff" />
                    <circle cx="74.2" cy="81.8" r="0.8" fill="#fff" opacity="0.85" />
                    <ellipse cx="104" cy="78.6" rx="5.4" ry="6.6" fill="url(#mc-iris)" />
                    <ellipse cx="104" cy="79" rx="2.6" ry="3.4" fill="#14060B" />
                    <circle cx="106" cy="75.6" r="1.9" fill="#fff" />
                    <circle cx="102.2" cy="81.8" r="0.8" fill="#fff" opacity="0.85" />
                  </g>
                </g>
              </Layer>
              <Layer>
                {/* The upper lids and lashes, on top of the irises: they stay put while the irises move. */}
                <path d="M68.5 74Q76 67.5 83.5 73.5" {...LINE} stroke="#3B2316" strokeWidth="2.4" />
                <path d="M68.8 74L66.4 72.4" {...LINE} stroke="#3B2316" strokeWidth="1.6" />
                <path d="M96.5 73.5Q104 67.5 111.5 74" {...LINE} stroke="#3B2316" strokeWidth="2.4" />
                <path d="M111.2 74L113.6 72.4" {...LINE} stroke="#3B2316" strokeWidth="1.6" />
              </Layer>
            </div>
            <Layer>
              <path d="M85 96Q90 100.5 95 96" {...LINE} stroke="#A23A50" strokeWidth="1.8" />
            </Layer>
          </div>

          {/* Her happy face while she waves: smiling eyes and an open smile. */}
          <Layer className="mc-happy-face">
            <path d="M70 80Q76 72 82 80" {...LINE} stroke="#3B2316" strokeWidth="2.4" />
            <path d="M98 80Q104 72 110 80" {...LINE} stroke="#3B2316" strokeWidth="2.4" />
            <path d="M84.5 95Q90 104.5 95.5 95Q90 97 84.5 95Z" fill="#8E2B44" />
            <ellipse cx="90" cy="100.2" rx="2.6" ry="1.3" fill="#E58597" />
          </Layer>

          {/* The fringe swept to one side, its strands, and a shine on top. */}
          <Layer>
            <g className="mc-hit">
              <use href="#mc-fringe" fill="url(#mc-hair)" />
              <path d="M78 45C86 40 98 40 108 44" {...LINE} stroke="#B98A3C" strokeOpacity="0.7" strokeWidth="1.2" />
              <path d="M93 47C104 50 114 56 120 64" {...LINE} stroke="#C9963F" strokeOpacity="0.85" strokeWidth="1.1" />
              <path d="M72 52C76 47 82 45 88 45" {...LINE} stroke="#C9963F" strokeOpacity="0.6" strokeWidth="1" />
              <path d="M67 37C73 31 81 28.5 89 28" {...LINE} stroke="#FFF6D6" strokeOpacity="0.8" strokeWidth="3.2" />
              <path d="M95 28C101 28 107 30 111 33" {...LINE} stroke="#FFF6D6" strokeOpacity="0.6" strokeWidth="2.4" />
            </g>
          </Layer>
        </div>
        </div>

        {/* The hand that swipes the tablet (it steps aside while she waves). */}
        <Layer className="mc-swipe">
          <g className="mc-hit">
            <path d="M38 182C44 170 59 164 73 163L76 174C64 176 56 179 54 182Z" {...SLEEVE} />
            <ellipse cx="78" cy="168" rx="6.5" ry="5.6" fill="url(#mc-skin-hand)" />
            <path d="M80 165L88.5 157.5" {...LINE} stroke="#F4C9B4" strokeWidth="4.4" />
            <path d="M81.5 170.5Q84 169 83.5 166.5" {...LINE} stroke="#DCA088" strokeWidth="1" />
          </g>
        </Layer>

        {/*
          The waving arm, hidden until the mouse comes over her. Three joints, each its own layer turning on its own
          point: the shoulder lifts the whole arm, the elbow waves the forearm, and the wrist follows a moment later, so
          the hand flaps like a real wave instead of the arm swinging like a stick.
        */}
        <div className="mc-stack mc-wave-arm">
          <Layer>
            {/* The upper arm: a soft sleeve from the shoulder to the elbow, outlined like the top. */}
            <path d="M64 133L42 154" {...LINE} stroke="#D49A9A" strokeOpacity="0.75" strokeWidth="14" />
            <path d="M64 133L42 154" {...LINE} stroke="url(#mc-sleeve-arm)" strokeWidth="12.4" />
            <path d="M58 132Q52 138 47 145" {...LINE} stroke="#FFF6F1" strokeOpacity="0.55" strokeWidth="2" />
          </Layer>
          <div className="mc-stack mc-forearm">
            <Layer>
              {/* The forearm in its sleeve, up to a cuff at the wrist. */}
              <path d="M42 154L37 123" {...LINE} stroke="#D49A9A" strokeOpacity="0.75" strokeWidth="12" />
              <path d="M42 154L37 123" {...LINE} stroke="url(#mc-sleeve-arm)" strokeWidth="10.4" />
              <path d="M37.6 126L36.6 119.5" stroke="#E7BBB4" strokeWidth="11.6" strokeLinecap="round" />
              <path d="M32 124.5Q37 126.5 42.4 124" {...LINE} stroke="#C98C8C" strokeOpacity="0.7" strokeWidth="1" />
            </Layer>
            <div className="mc-stack mc-hand">
              <Layer>
                {/* The hand, palm out: four fingers a little apart, the thumb toward her face, soft lines. */}
                <g strokeLinecap="round">
                  <g stroke="#E2A78F" strokeWidth="4.4">
                    <path d="M31 108.5L28.6 99.5" />
                    <path d="M34.6 106.5L33.8 96.2" />
                    <path d="M38.4 106.6L39.2 96.6" />
                    <path d="M41.6 108.4L43.6 100.6" />
                    <path d="M42.6 113.2L47.4 110" />
                  </g>
                  <g stroke="#F8D6C4" strokeWidth="3.3">
                    <path d="M31 108.5L28.6 99.5" />
                    <path d="M34.6 106.5L33.8 96.2" />
                    <path d="M38.4 106.6L39.2 96.6" />
                    <path d="M41.6 108.4L43.6 100.6" />
                    <path d="M42.6 113.2L47.4 110" />
                  </g>
                </g>
                <path
                  d="M30.4 110C30 104.6 33 103.4 36.4 103.4C40.6 103.4 43.6 105 43.2 110.6C42.9 115.4 40 118 36.6 118C33 118 30.6 115.2 30.4 110Z"
                  fill="url(#mc-skin-hand)"
                  stroke="#E2A78F"
                  strokeWidth="0.6"
                />
                <path d="M33.4 112.6Q36.6 114.6 40 112.2" {...LINE} stroke="#DCA088" strokeOpacity="0.8" strokeWidth="0.8" />
                <ellipse cx="34.6" cy="107.6" rx="2.4" ry="1.5" fill="#FFF1E8" opacity="0.6" />
              </Layer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
