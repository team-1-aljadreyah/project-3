// Numbers and dates in Arabic or English. Pure functions (no React), so they are easy to test.
import { daysBetween, today } from "./utils";
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
  /** "20 تشرين الثاني، 10:30" */
  dateTime: (iso: string | undefined) => string;
  /** How long ago: "الآن", "قبل 5 دقائق", "قبل ساعتين", "أمس", then the date. */
  ago: (iso: string | undefined, now?: Date) => string;
}

/** Arabic counts for minutes and hours, like arDays. */
function arCount(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

/**
 * The forms an Arabic noun takes after a number: `one` and `two` are whole phrases ("مهمة واحدة", "مهمتان"), `few`
 * is the plural after 3–10 ("مهام"), `many` the singular after 11–99 ("مهمة", "عضواً").
 */
export interface ArWords {
  one: string;
  two: string;
  few: string;
  many: string;
}

/**
 * Arabic number agreement: 1 and 2 have their own words, 3–10 take the plural, 11–99 the singular (accusative, "عضواً"),
 * and 0, 100, 101, 102… the singular without its tanween ("100 عضو"). Only the last two digits decide, as in
 * "103 أعضاء" and "111 عضواً".
 */
export function arCountWords(n: number, w: ArWords, num: (n: number) => string = String) {
  if (n === 1) return w.one;
  if (n === 2) return w.two;
  const rest = n % 100;
  if (rest >= 3 && rest <= 10) return `${num(n)} ${w.few}`;
  if (rest >= 11) return `${num(n)} ${w.many}`;
  return `${num(n)} ${w.many.replace(/اً$/, "")}`;
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
  const locale = lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB";
  const dayF = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
  const dtF = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
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
    dateTime: (iso) => (iso ? dtF.format(new Date(iso)) : "-"),
    ago: (iso, now = new Date()) => {
      if (!iso) return "-";
      const s = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
      if (s < 60) return tr("الآن", "just now");
      const m = Math.floor(s / 60);
      if (m < 60) return tr(`قبل ${arCount(m, "دقيقة", "دقيقتين", "دقائق", "دقيقة")}`, `${m} min ago`);
      const h = Math.floor(m / 60);
      if (h < 24) return tr(`قبل ${arCount(h, "ساعة", "ساعتين", "ساعات", "ساعة")}`, `${h} h ago`);
      // Whole days by the calendar, not by hours: 11:00 two days ago is "2 days ago", not "yesterday".
      const d = daysBetween(today(0, new Date(iso)), today(0, now));
      if (d <= 1) return tr("أمس", "yesterday");
      if (d < 7) return tr(`قبل ${arDays(d)}`, `${d} days ago`);
      return dayF.format(new Date(iso));
    },
  };
}
