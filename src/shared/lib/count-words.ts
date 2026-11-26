// The nouns the platform counts, in their Arabic forms after a number, with the English pair. Used inside the two
// halves of tr(), so any line can count without a hook:
//   tr(`${arN(n, W.member)}`, `${enN(n, W.member)}`)  → "عضو واحد"، "عضوان"، "5 أعضاء"، "12 عضواً" / "1 person", "5 people"
//   arN(n, G.task) after من، إلى، لـ…                     → "مهمة واحدة"، "مهمتين"، "5 مهام"
import { arCountWords, type ArWords } from "./format";

type Pair = readonly [ar: ArWords, en: readonly [one: string, many: string]];

const pair = (one: string, two: string, few: string, many: string, en: readonly [string, string]): Pair => [{ one, two, few, many }, en];

/** The forms on their own (a label, the subject of a sentence). */
export const W = {
  member: pair("عضو واحد", "عضوان", "أعضاء", "عضواً", ["person", "people"]),
  person: pair("شخص واحد", "شخصان", "أشخاص", "شخصاً", ["person", "people"]),
  otherPerson: pair("شخص آخر", "شخصان آخران", "أشخاص آخرون", "شخصاً آخر", ["other person", "other people"]),
  project: pair("مشروع واحد", "مشروعان", "مشاريع", "مشروعاً", ["project", "projects"]),
  task: pair("مهمة واحدة", "مهمتان", "مهام", "مهمة", ["task", "tasks"]),
  team: pair("فريق واحد", "فريقان", "فرق", "فريقاً", ["team", "teams"]),
  account: pair("حساب واحد", "حسابان", "حسابات", "حساباً", ["account", "accounts"]),
  employee: pair("موظف واحد", "موظفان", "موظفين", "موظفاً", ["person", "people"]),
  session: pair("جلسة واحدة", "جلستان", "جلسات", "جلسة", ["session", "sessions"]),
  day: pair("يوم واحد", "يومان", "أيام", "يوماً", ["day", "days"]),
  minute: pair("دقيقة واحدة", "دقيقتان", "دقائق", "دقيقة", ["minute", "minutes"]),
  letter: pair("حرف واحد", "حرفان", "أحرف", "حرفاً", ["letter", "letters"]),
  rating: pair("تقييم واحد", "تقييمان", "تقييمات", "تقييماً", ["rating", "ratings"]),
  notification: pair("إشعار واحد", "إشعاران", "إشعارات", "إشعاراً", ["notification", "notifications"]),
  attempt: pair("محاولة واحدة", "محاولتان", "محاولات", "محاولة", ["attempt", "attempts"]),
  line: pair("سطر واحد", "سطران", "أسطر", "سطراً", ["line", "lines"]),
} as const;

type Words = keyof typeof W;

/** After a preposition (من، إلى، لـ، بعد…) or as an object: the dual and the sound plural take "ين" ("مهمتين"، "آخرين"). */
const genitive = ([ar, en]: Pair): Pair => [{ ...ar, two: ar.two.replace(/ان(?=\s|$)/g, "ين"), few: ar.few.replace(/ون$/, "ين") }, en];

export const G = Object.fromEntries(Object.entries(W).map(([k, v]) => [k, genitive(v)])) as Record<Words, Pair>;

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** The Arabic words for n of these ("5 أعضاء"، "عضوان"). */
export const arN = (n: number, [ar]: Pair) => arCountWords(n, ar, (x) => nf.format(x));

/** The English words for n of these ("1 person", "5 people"). */
export const enN = (n: number, [, en]: Pair) => `${nf.format(n)} ${n === 1 ? en[0] : en[1]}`;
