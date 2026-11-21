// The drawing maths of the admin page's small charts: where each number sits in the chart's box, the soft line through
// the numbers, and the whole-number steps of the side scale. Pure functions (no React), tested in tests/unit/admin.test.ts.

/** A place in a chart's box, from 0 to 1: `x` along the reading direction, `y` down from the top. */
export interface Dot {
  x: number;
  y: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Places numbers across a box, in order. The scale runs from `min` (the floor of the box) to `max` (its top); without
 * a scale it runs from the lowest number to the highest. Equal numbers sit on the middle line. With `columns` each
 * number sits in the middle of its own column (a chart with a label under every column); without it the first number
 * is at the start edge and the last at the end edge.
 */
export function place(values: number[], scale?: { min: number; max: number }, columns = false): Dot[] {
  const count = values.length;
  if (!count) return [];
  const min = scale?.min ?? Math.min(...values);
  const max = scale?.max ?? Math.max(...values);
  return values.map((v, i) => ({
    x: columns ? (i + 0.5) / count : count > 1 ? i / (count - 1) : 0.5,
    y: max > min ? Math.min(1, Math.max(0, 1 - (v - min) / (max - min))) : 0.5,
  }));
}

/**
 * A soft line through the dots, as an SVG path in a box `w` wide and `h` high. The line leaves and reaches every dot
 * level, so between two dots it never rises above the higher one or dips under the lower one: it never shows a number
 * that isn't there (a plain smooth curve would).
 */
export function softLine(dots: Dot[], w = 100, h = 100): string {
  return dots
    .map((d, i) => {
      const x = round(d.x * w);
      const y = round(d.y * h);
      if (i === 0) return `M${x} ${y}`;
      const beforeX = round(dots[i - 1].x * w);
      const beforeY = round(dots[i - 1].y * h);
      const middle = round((beforeX + x) / 2);
      return `C${middle} ${beforeY} ${middle} ${y} ${x} ${y}`;
    })
    .join(" ");
}

/** The same line, closed down to the floor of the box: the shape of the light fill under it. */
export function softArea(dots: Dot[], w = 100, h = 100): string {
  if (!dots.length) return "";
  return `${softLine(dots, w, h)} L${round(dots[dots.length - 1].x * w)} ${h} L${round(dots[0].x * w)} ${h} Z`;
}

/**
 * The side scale of a chart of counts: from 0 up in equal whole-number steps (of 1, 2, 5, 10, 20, 50…), the smallest
 * step that reaches the highest number in five steps or fewer. Never fewer than four steps, so one or two actions
 * don't look like a mountain. scaleSteps(7) is 0, 2, 4, 6, 8.
 */
export function scaleSteps(highest: number): number[] {
  let step = 1;
  for (let ten = 1; Math.ceil(highest / step) > 5; ten *= 10) {
    for (const m of [1, 2, 5]) {
      step = m * ten;
      if (Math.ceil(highest / step) <= 5) break;
    }
  }
  const parts = Math.max(4, Math.ceil(highest / step));
  return Array.from({ length: parts + 1 }, (_, i) => i * step);
}
