// The drawings at the top of each celebration card, drawn by hand in SVG in the brand's colours (no pictures to load):
// a trophy for a big achievement, a medal for good work, a cake with lit candles for a birthday, a bunch of balloons for
// "today is someone's birthday", and a gift for "a week before". Their small movements are in app/styles.css (.cel-*).
import type { Effect } from "../effects";

const GOLD = ["#fbe7ad", "#e7bf6a", "#b9843a"];

function Gold({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={GOLD[0]} />
      <stop offset="0.5" stopColor={GOLD[1]} />
      <stop offset="1" stopColor={GOLD[2]} />
    </linearGradient>
  );
}

function Trophy() {
  return (
    <svg viewBox="0 0 120 120" className="size-full">
      <defs>
        <Gold id="cel-gold-t" />
        <clipPath id="cel-cup">
          <path d="M36 20h48v24a24 24 0 0 1-48 0z" />
        </clipPath>
      </defs>
      {/* Handles, cup, stem and the two-step base. */}
      <path d="M37 27H27a11 11 0 0 0 12 19M83 27h10a11 11 0 0 1-12 19" fill="none" stroke="url(#cel-gold-t)" strokeWidth="5" strokeLinecap="round" />
      <path d="M36 20h48v24a24 24 0 0 1-48 0z" fill="url(#cel-gold-t)" />
      <rect x="35" y="17" width="50" height="6" rx="3" fill={GOLD[0]} />
      <path d="M55 67h10l2 13H53z" fill={GOLD[2]} />
      <rect x="44" y="80" width="32" height="8" rx="2.5" fill={GOLD[1]} />
      <rect x="37" y="88" width="46" height="13" rx="3.5" fill="#7c0e44" />
      <rect x="49" y="92" width="22" height="5" rx="1.5" fill="#e7bf6a" opacity="0.85" />
      {/* A star on the cup, and the light that runs across it. */}
      <path d="M60 30l3.2 6.6 7.2 1-5.2 5 1.3 7.2L60 46.4l-6.5 3.4 1.3-7.2-5.2-5 7.2-1z" fill="#fff8e6" opacity="0.92" />
      <g clipPath="url(#cel-cup)">
        <rect className="cel-shine" x="20" y="10" width="14" height="70" fill="#fff" opacity="0.45" transform="rotate(18 60 40)" />
      </g>
    </svg>
  );
}

function Medal() {
  return (
    <svg viewBox="0 0 120 120" className="size-full">
      <defs>
        <Gold id="cel-gold-m" />
      </defs>
      <g className="cel-swing">
        {/* Two ribbons meeting at the medal. */}
        <path d="M40 8h16l14 52H54z" fill="#aa5e7a" />
        <path d="M80 8H64L50 60h16z" fill="#7c0e44" />
        <path d="M44 8h4l14 52h-4zM72 8h4L62 60h-4z" fill="#f2dace" opacity="0.5" />
        <circle cx="60" cy="78" r="27" fill="url(#cel-gold-m)" />
        <circle cx="60" cy="78" r="20" fill="none" stroke="#fff3cf" strokeWidth="2" opacity="0.7" />
        <path d="M60 64l4.4 9 9.9 1.4-7.2 7 1.7 9.8L60 86.6l-8.8 4.6 1.7-9.8-7.2-7 9.9-1.4z" fill="#7c0e44" />
      </g>
    </svg>
  );
}

function Cake() {
  const candles = [44, 60, 76];
  return (
    <svg viewBox="0 0 120 120" className="size-full">
      <ellipse cx="60" cy="104" rx="46" ry="7" fill="#f2dace" opacity="0.25" />
      {/* The bottom layer with its icing running down, the top layer, the sprinkles. */}
      <rect x="22" y="70" width="76" height="32" rx="6" fill="#7c0e44" />
      <path d="M22 76c0-4 3-6 6-6h64c3 0 6 2 6 6v4c-4 0-4 7-8 7s-4-6-8-6-4 9-8 9-4-8-8-8-4 6-8 6-4-10-8-10-4 8-8 8-4-6-8-6-4 5-8 5z" fill="#f2dace" />
      <rect x="33" y="50" width="54" height="24" rx="5" fill="#aa5e7a" />
      <path d="M33 55c0-3 2-5 5-5h44c3 0 5 2 5 5v2c-3 0-3 5-6 5s-3-4-6-4-3 6-6 6-3-5-6-5-3 4-6 4-3-6-6-6-3 4-6 4-3-3-6-3z" fill="#faf3ef" />
      {[30, 48, 66, 84].map((x, i) => (
        <rect key={x} x={x} y={91 - (i % 2) * 6} width="5" height="2.4" rx="1.2" fill={i % 2 ? "#e7bf6a" : "#f2dace"} transform={`rotate(${i % 2 ? 30 : -25} ${x} 90)`} />
      ))}
      {candles.map((x, i) => (
        <g key={x}>
          <rect x={x - 2.5} y="31" width="5" height="20" rx="1.5" fill="#faf3ef" />
          <path d={`M${x - 2.5} 36l5 -3M${x - 2.5} 43l5 -3`} stroke="#d49a9a" strokeWidth="1.6" />
          <g className="cel-flame" style={{ animationDelay: `${i * 0.18}s` }}>
            <ellipse cx={x} cy="24" rx="4.2" ry="7" fill="#e7bf6a" />
            <ellipse cx={x} cy="26" rx="2" ry="3.6" fill="#fff6dc" />
          </g>
        </g>
      ))}
    </svg>
  );
}

/** One balloon (also used for the ones that rise over the page). */
export function Balloon({ color, className, style }: { color: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 92" className={className} style={style} aria-hidden="true">
      <path d="M20 50c-1 8 4 13 0 20s-3 13 1 21" fill="none" stroke="#f2dace" strokeOpacity="0.6" strokeWidth="1" />
      <ellipse cx="20" cy="22" rx="17" ry="21" fill={color} />
      <path d="M17 42h6l-3 5z" fill={color} />
      <ellipse cx="13" cy="14" rx="4" ry="6.5" fill="#fff" opacity="0.28" transform="rotate(-20 13 14)" />
    </svg>
  );
}

function Balloons() {
  return (
    <svg viewBox="0 0 120 120" className="size-full">
      <g className="cel-bob">
        <path d="M60 112c-2-12-14-24-26-40M60 112c0-14 0-30 0-52M60 112c3-12 14-26 27-40" fill="none" stroke="#f2dace" strokeOpacity="0.6" strokeWidth="1.2" />
        <ellipse cx="34" cy="50" rx="17" ry="21" fill="#aa5e7a" />
        <ellipse cx="86" cy="50" rx="17" ry="21" fill="#e7bf6a" />
        <ellipse cx="60" cy="36" rx="19" ry="23" fill="#7c0e44" />
        <ellipse cx="53" cy="27" rx="4.5" ry="7" fill="#fff" opacity="0.25" transform="rotate(-20 53 27)" />
        <ellipse cx="28" cy="42" rx="3.5" ry="6" fill="#fff" opacity="0.25" transform="rotate(-20 28 42)" />
        <ellipse cx="80" cy="42" rx="3.5" ry="6" fill="#fff" opacity="0.3" transform="rotate(-20 80 42)" />
      </g>
    </svg>
  );
}

function Gift() {
  return (
    <svg viewBox="0 0 120 120" className="size-full">
      <defs>
        <Gold id="cel-gold-g" />
      </defs>
      <ellipse cx="60" cy="106" rx="40" ry="6" fill="#f2dace" opacity="0.22" />
      <rect x="28" y="56" width="64" height="48" rx="5" fill="#aa5e7a" />
      <rect x="54" y="56" width="12" height="48" fill="url(#cel-gold-g)" />
      <g className="cel-lid">
        <rect x="23" y="44" width="74" height="15" rx="4" fill="#7c0e44" />
        <rect x="54" y="44" width="12" height="15" fill="url(#cel-gold-g)" />
        {/* The bow. */}
        <path d="M60 44c-6-12-24-16-24-6s16 7 24 6zM60 44c6-12 24-16 24-6s-16 7-24 6z" fill="url(#cel-gold-g)" />
        <circle cx="60" cy="43" r="4.5" fill={GOLD[2]} />
      </g>
      <g className="cel-twinkle" fill="#fbe7ad">
        <path d="M20 30l1.8 4.2 4.2 1.8-4.2 1.8L20 42l-1.8-4.2L14 36l4.2-1.8z" />
        <path d="M100 22l1.4 3.2 3.2 1.4-3.2 1.4-1.4 3.2-1.4-3.2-3.2-1.4 3.2-1.4z" style={{ animationDelay: "0.7s" }} />
      </g>
    </svg>
  );
}

/** The drawing for an effect. */
export function Art({ effect }: { effect: Effect }) {
  if (effect === "big") return <Trophy />;
  if (effect === "good") return <Medal />;
  if (effect === "birthday") return <Cake />;
  if (effect === "birthday-today") return <Balloons />;
  return <Gift />;
}
