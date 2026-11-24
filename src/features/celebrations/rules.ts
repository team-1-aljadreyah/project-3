// Who may celebrate a team and who sees the birthday moments. Pure functions used by the screens (to show only what a
// person may do) and by the demo backend (to refuse the rest); docs/backend.md section 23 lists them for the real server.
import type { User } from "@/shared/api/types";
import { isCeo } from "@/shared/lib/access";
import type { CelebrationKind } from "./types";

/** Celebrating a team (the client, 24 November 2026: "the monitor can choose a team and press a button"). And the CEO. */
export const canCelebrateTeams = (user: Pick<User, "role">) => isCeo(user) || user.role === "monitor";

export const CELEBRATION_KINDS: CelebrationKind[] = ["good", "big"];

export const CELEBRATION_LIMITS = {
  /** The sender's few words. */
  message: 200,
  /** A celebration nobody opened within these days is no longer shown (it would come too late). */
  showDays: 7,
};

/** The words of each kind (the dialog's choice, the card's title). */
export const KIND_WORDS: Record<CelebrationKind, { ar: string; en: string; title_ar: string; title_en: string; hint_ar: string; hint_en: string }> = {
  good: {
    ar: "عمل رائع",
    en: "Great work",
    title_ar: "عمل رائع!",
    title_en: "Great work!",
    hint_ar: "لعمل جيد أو أسبوع موفق: قصاصات ملوّنة.",
    hint_en: "For good work or a good week: confetti.",
  },
  big: {
    ar: "إنجاز كبير",
    en: "Big achievement",
    title_ar: "إنجاز كبير!",
    title_en: "A big achievement!",
    hint_ar: "لإطلاق مشروع أو هدف كبير: ألعاب نارية وكأس.",
    hint_en: "For a launch or a big goal: fireworks and a trophy.",
  },
};

/** The people a team's celebration reaches: its active members, but not the one who sends it. */
export const celebrationAudience = <T extends Pick<User, "id" | "active" | "team_id">>(teamId: number, users: T[], senderId: number) =>
  users.filter((u) => u.active && u.team_id === teamId && u.id !== senderId);
