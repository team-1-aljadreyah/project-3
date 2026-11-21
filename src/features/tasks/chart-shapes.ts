// The shapes of the summary's two charts (components/my-charts.tsx) as plain numbers: points on a circle, SVG arcs,
// and the pieces of a ring. Pure functions, tested in tests/unit/my-summary.test.ts.
// Angles are in turns: 0 is the top of the circle, 0.25 the right, 0.5 the bottom, always clockwise.

/** Two decimals are enough for a drawing, and keep the paths short. */
const round = (n: number) => Math.round(n * 100) / 100;

/** The point at `turn` on a circle of radius `r` around (cx, cy). */
export function pointAt(cx: number, cy: number, r: number, turn: number) {
  const angle = turn * 2 * Math.PI;
  return { x: round(cx + r * Math.sin(angle)), y: round(cy - r * Math.cos(angle)) };
}

/** An SVG path along the circle from one turn to another, clockwise. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const a = pointAt(cx, cy, r, from);
  const b = pointAt(cx, cy, r, to);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

/**
 * Splits a ring between `shares` (they add up to 1): where each piece starts and ends, one after the other all the
 * way round. Every piece first gets `pad` turns (the room for its rounded ends and the gap, so even the smallest one
 * shows), then its share of what is left, so the pieces stay in proportion however many there are.
 */
export function ringSegments(shares: number[], pad: number) {
  // With so many pieces that the pads alone would not fit, they share the ring equally.
  const each = Math.min(pad, 1 / shares.length);
  const left = 1 - shares.length * each;
  let at = 0;
  return shares.map((share) => {
    const from = at;
    at += each + share * left;
    return { from, to: at };
  });
}

/**
 * One piece of a ring as a closed SVG path: from turn `from` to `to`, between the radii `inner` and `outer`. Its two
 * straight ends are moved in by `inset` and stay parallel to the cut between two pieces, so the gap between
 * neighbours is as wide near the hole as at the rim.
 */
export function ringPiece(cx: number, cy: number, inner: number, outer: number, from: number, to: number, inset: number) {
  // How far (in turns) an end moves along a circle of radius `r` to sit `inset` away from the cut.
  const shift = (r: number) => Math.asin(Math.min(1, inset / r)) / (2 * Math.PI);
  const large = (r: number) => (to - from - 2 * shift(r) > 0.5 ? 1 : 0);
  const a = pointAt(cx, cy, outer, from + shift(outer));
  const b = pointAt(cx, cy, outer, to - shift(outer));
  const c = pointAt(cx, cy, inner, to - shift(inner));
  const d = pointAt(cx, cy, inner, from + shift(inner));
  return `M ${a.x} ${a.y} A ${outer} ${outer} 0 ${large(outer)} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 ${large(inner)} 0 ${d.x} ${d.y} Z`;
}
