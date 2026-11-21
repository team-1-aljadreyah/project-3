// Class names for colours that depend on data (a status family, a person). Written out in full, because Tailwind
// only builds the classes it can find as whole words in the code.
import type { Priority, StatusTone } from "@/shared/api/types";

export const TONE_CLASS: Record<StatusTone, { pill: string; bar: string; text: string }> = {
  new: { pill: "bg-(--st-new) text-(--st-new-ink)", bar: "bg-(--st-new-ink)", text: "text-(--st-new-ink)" },
  todo: { pill: "bg-(--st-todo) text-(--st-todo-ink)", bar: "bg-(--st-todo-ink)", text: "text-(--st-todo-ink)" },
  progress: { pill: "bg-(--st-progress) text-(--st-progress-ink)", bar: "bg-(--st-progress-ink)", text: "text-(--st-progress-ink)" },
  review: { pill: "bg-(--st-review) text-(--st-review-ink)", bar: "bg-(--st-review-ink)", text: "text-(--st-review-ink)" },
  testing: { pill: "bg-(--st-testing) text-(--st-testing-ink)", bar: "bg-(--st-testing-ink)", text: "text-(--st-testing-ink)" },
  done: { pill: "bg-(--st-done) text-(--st-done-ink)", bar: "bg-(--st-done-ink)", text: "text-(--st-done-ink)" },
  blocked: { pill: "bg-(--st-blocked) text-(--st-blocked-ink)", bar: "bg-(--st-blocked-ink)", text: "text-(--st-blocked-ink)" },
};

/** A priority's name, its soft background (cards that use it as a fill) and the colour of its signal bars. */
export const PRIORITY: Record<Priority, { ar: string; en: string; pill: string; text: string }> = {
  high: { ar: "عالية", en: "High", pill: TONE_CLASS.blocked.pill, text: TONE_CLASS.blocked.text },
  medium: { ar: "متوسطة", en: "Medium", pill: TONE_CLASS.review.pill, text: TONE_CLASS.review.text },
  low: { ar: "منخفضة", en: "Low", pill: TONE_CLASS.new.pill, text: "text-muted" },
};

export const AVATAR_CLASS = [
  "bg-(--av-1) text-(--av-1-ink)",
  "bg-(--av-2) text-(--av-2-ink)",
  "bg-(--av-3) text-(--av-3-ink)",
  "bg-(--av-4) text-(--av-4-ink)",
  "bg-(--av-5) text-(--av-5-ink)",
];

/** The same person always gets the same colour. */
export const avatarClass = (id: number) => AVATAR_CLASS[Math.abs(id) % AVATAR_CLASS.length];
