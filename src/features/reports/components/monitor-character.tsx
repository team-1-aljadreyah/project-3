import { useState, type ReactNode } from "react";
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
 * The monitoring officer's little character in her dashboard banner (monitor-summary.tsx): a young woman with a dark
 * ponytail, square glasses, a blush top and a wine scarf, holding a tablet with a small chart on it. She is drawn here
 * in code (shapes and soft gradients, no picture files) and the styles at the end of app/styles.css bring her to life:
 * she breathes, tilts her head, blinks, swipes the tablet, her glasses catch the light and her ponytail sways. When the
 * mouse goes over her she waves once. She is only decoration: hidden from screen readers, and only her own shape takes
 * the mouse. The drawing faces the page from the right; in Arabic the styles mirror her to the left side.
 *
 * Each moving part is its own layer, and only whole layers move (turn, slide, fade), so the graphics card moves them
 * and nothing is redrawn while she is idle.
 */
export function MonitorCharacter({ className }: { className?: string }) {
  const [waving, setWaving] = useState(false);

  return (
    // The mouse over her starts one wave; it plays to its end even if the mouse leaves, then she goes back to idle.
    <div
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
          <radialGradient id="mc-hair" cx="0.36" cy="0.2" r="0.9">
            <stop offset="0" stopColor="#6B3E4D" />
            <stop offset="0.45" stopColor="#351C27" />
            <stop offset="1" stopColor="#1C0E15" />
          </radialGradient>
          <linearGradient id="mc-pony" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4D2B39" />
            <stop offset="0.6" stopColor="#2A1520" />
            <stop offset="1" stopColor="#1A0C13" />
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
          <linearGradient id="mc-lens" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
            <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.06" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.14" />
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
          <clipPath id="mc-face-clip">
            <path d="M56 70C56 46 72 36 90 36C108 36 124 46 124 70C124 88 114 104 96 108Q90 110 84 108C66 104 56 88 56 70Z" />
          </clipPath>
          <clipPath id="mc-lens-clip">
            <rect x="63" y="66.5" width="25" height="20.5" rx="6.5" />
            <rect x="92" y="66.5" width="25" height="20.5" rx="6.5" />
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

        {/* The head tilts a little from side to side. */}
        <div className="mc-stack mc-head">
          {/* The ponytail swings from its tie at the back of the head. */}
          <Layer className="mc-pony">
            <g className="mc-hit">
              <use href="#mc-pony-shape" {...RIM} transform="translate(1.6 -1.2)" />
              <use href="#mc-pony-shape" fill="url(#mc-pony)" />
              <path d="M124 37C142 45 147 63 140 86" {...LINE} stroke="#6B3E4D" strokeOpacity="0.7" strokeWidth="1.2" />
              <path d="M137 29C149 35 152 48 150 59" {...LINE} stroke="#8C5A6A" strokeOpacity="0.55" strokeWidth="2.2" />
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
              <path d="M68 62Q76 58 84 61" {...LINE} stroke="#3A1F28" strokeWidth="2" />
              <path d="M96 61Q104 58 112 62" {...LINE} stroke="#3A1F28" strokeWidth="2" />
              <path d="M90 86q1.6 2 0 3.6" {...LINE} stroke="#D38D78" strokeWidth="1.3" />
            </g>
          </Layer>

          {/* Her usual face: open eyes (they blink) and a small smile. It steps aside while she waves. */}
          <div className="mc-stack mc-idle-face">
            <Layer className="mc-eyes">
              <ellipse cx="76" cy="78" rx="6" ry="7.4" fill="url(#mc-iris)" />
              <ellipse cx="76" cy="78.5" rx="2.8" ry="3.8" fill="#14060B" />
              <circle cx="78.3" cy="74.8" r="2.2" fill="#fff" />
              <circle cx="74" cy="81.6" r="0.9" fill="#fff" opacity="0.85" />
              <path d="M68.5 74Q76 67.5 83.5 73.5" {...LINE} stroke="#22101A" strokeWidth="2.4" />
              <path d="M68.8 74L66.4 72.4" {...LINE} stroke="#22101A" strokeWidth="1.6" />
              <ellipse cx="104" cy="78" rx="6" ry="7.4" fill="url(#mc-iris)" />
              <ellipse cx="104" cy="78.5" rx="2.8" ry="3.8" fill="#14060B" />
              <circle cx="106.3" cy="74.8" r="2.2" fill="#fff" />
              <circle cx="102" cy="81.6" r="0.9" fill="#fff" opacity="0.85" />
              <path d="M96.5 73.5Q104 67.5 111.5 74" {...LINE} stroke="#22101A" strokeWidth="2.4" />
              <path d="M111.2 74L113.6 72.4" {...LINE} stroke="#22101A" strokeWidth="1.6" />
            </Layer>
            <Layer>
              <path d="M85 96Q90 100.5 95 96" {...LINE} stroke="#A23A50" strokeWidth="1.8" />
            </Layer>
          </div>

          {/* Her happy face while she waves: smiling eyes and an open smile. */}
          <Layer className="mc-happy-face">
            <path d="M70 80Q76 72 82 80" {...LINE} stroke="#22101A" strokeWidth="2.4" />
            <path d="M98 80Q104 72 110 80" {...LINE} stroke="#22101A" strokeWidth="2.4" />
            <path d="M84.5 95Q90 104.5 95.5 95Q90 97 84.5 95Z" fill="#8E2B44" />
            <ellipse cx="90" cy="100.2" rx="2.6" ry="1.3" fill="#E58597" />
          </Layer>

          {/* A glint of light on each lens now and then: first the near lens, then the far one. */}
          <Layer className="mc-glint">
            <g clipPath="url(#mc-lens-clip)" fill="#fff">
              <path d="M66 87H71.5L81.5 66.5H76Z" opacity="0.8" />
              <path d="M73.5 87H75.5L85.5 66.5H83.5Z" opacity="0.6" />
            </g>
          </Layer>
          <Layer className="mc-glint mc-glint-far">
            <g clipPath="url(#mc-lens-clip)" fill="#fff">
              <path d="M95 87H100.5L110.5 66.5H105Z" opacity="0.8" />
              <path d="M102.5 87H104.5L114.5 66.5H112.5Z" opacity="0.6" />
            </g>
          </Layer>

          {/* The square glasses, then the fringe swept to one side, with a shine on top. */}
          <Layer>
            <g className="mc-hit">
              <g fill="none" stroke="#5B1F3A" strokeWidth="1.7" strokeLinecap="round">
                <rect x="63" y="66.5" width="25" height="20.5" rx="6.5" fill="url(#mc-lens)" />
                <rect x="92" y="66.5" width="25" height="20.5" rx="6.5" fill="url(#mc-lens)" />
                <path d="M88 75Q90 72.5 92 75" />
                <path d="M64 73L57.5 75" />
                <path d="M116 73L122.5 75" />
              </g>
              <use href="#mc-fringe" fill="url(#mc-hair)" />
              <path d="M78 45C86 40 98 40 108 44" {...LINE} stroke="#1C0E15" strokeOpacity="0.6" strokeWidth="1.2" />
              <path d="M93 47C104 50 114 56 120 64" {...LINE} stroke="#5A3240" strokeOpacity="0.8" strokeWidth="1.1" />
              <path d="M67 37C73 31 81 28.5 89 28" {...LINE} stroke="#A87485" strokeOpacity="0.55" strokeWidth="3.2" />
              <path d="M95 28C101 28 107 30 111 33" {...LINE} stroke="#A87485" strokeOpacity="0.4" strokeWidth="2.4" />
            </g>
          </Layer>
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

        {/* The waving arm: hidden until the mouse comes over her. The forearm turns at the elbow. */}
        <div className="mc-stack mc-wave-arm">
          <Layer>
            <path d="M60 130C49 136 41 142 36 152L46 158C50 150 56 144 66 140Z" {...SLEEVE} />
          </Layer>
          <Layer className="mc-forearm">
            <path d="M36 155C32 141 30 129 31 118H41C41 128 43 140 47 152Z" {...SLEEVE} />
            <g stroke="#F4C9B4" strokeWidth="3.4" strokeLinecap="round">
              <path d="M31.5 105L29.5 97" />
              <path d="M35 104L34.6 95" />
              <path d="M38.8 104.4L39.6 96" />
              <path d="M42 106.5L43.8 100" />
              <path d="M30.5 111.5L26 107.5" />
            </g>
            <ellipse cx="36" cy="110.5" rx="6.5" ry="7.5" fill="url(#mc-skin-hand)" />
          </Layer>
        </div>
      </div>
    </div>
  );
}
