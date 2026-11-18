// Numbers and dates in Arabic or English. Pure functions (no React), so they are easy to test.
// Digits are always Latin (1 2 3) for now; the client has not decided yet (see the private DESIGN notes).

export type Lang = "ar" | "en";
export type Tr = (ar: string, en: string) => string;

export interface Fmt {
  lang: Lang;
  tr: Tr;
  num: (n: number | undefined | null) => string;
  /** 0.64 -> "64%" */
  pct: (ratio: number) => string;
  /** "2026-11-20" -> "20 نوفمبر" / "20 Nov" */
  day: (iso: string | undefined) => string;
  /** How far a due day is from today: "متأخرة يومين", "اليوم", "بعد 3 أيام". */
  due: (days: number) => string;
}

/** Arabic count words: 1 يوم، 2 يومان، 3–10 أيام، 11+ يوماً. */
export function arDays(n: number) {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومين";
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يوماً`;
}

export function makeFmt(lang: Lang): Fmt {
  const tr: Tr = (ar, en) => (lang === "ar" ? ar : en);
  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const dayF = new Intl.DateTimeFormat(lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB", { day: "numeric", month: "long" });
  return {
    lang,
    tr,
    num: (n) => (n === undefined || n === null ? "-" : nf.format(n)),
    pct: (ratio) => `${Math.round(ratio * 100)}%`,
    day: (iso) => (iso ? dayF.format(new Date(iso.slice(0, 10) + "T00:00:00")) : "-"),
    due: (days) => {
      if (days === 0) return tr("اليوم", "today");
      if (days === 1) return tr("غداً", "tomorrow");
      if (days < 0) return tr(`متأخرة ${arDays(-days)}`, `${-days} day${days === -1 ? "" : "s"} late`);
      return tr(`بعد ${arDays(days)}`, `in ${days} days`);
    },
  };
}
