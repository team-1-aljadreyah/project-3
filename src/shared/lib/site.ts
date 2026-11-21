// The CEO's site-wide switches that every signed-in page obeys: which features are on, the banner on top of the
// pages, and the read-only mode. The CEO sets them in the advanced settings (src/features/advanced); the server sends
// each person the part that concerns them (`GET /site/live`). They are here, not in that feature, because the top bar
// (shared) and other features read them, and shared/ never imports a feature.
//
// The last answer is kept in the browser, so a new tab knows them before the server answers (the welcome splash).
import { useSyncExternalStore } from "react";
import type { Role } from "../api/types";

/** The features the CEO can switch off. Off = gone from the menu and refused by the server, except for the CEO. */
export type FeatureKey = "chat" | "group_chats" | "bugs" | "reviews" | "announcements" | "requests" | "github" | "welcome";

export const FEATURE_KEYS: FeatureKey[] = ["chat", "group_chats", "bugs", "reviews", "announcements", "requests", "github", "welcome"];

/** The menu item each feature hides when it is off (shared/lib/access.ts NAV keys). */
export const FEATURE_NAV: Partial<Record<FeatureKey, string>> = {
  chat: "chat",
  bugs: "bugs",
  reviews: "performance",
  announcements: "announcements",
  requests: "requests",
};

/** A short notice on top of every page, for the jobs chosen (none chosen = everyone), until it ends. */
export interface Banner {
  text: string;
  text_en?: string;
  roles: Role[];
  tone: "info" | "warning";
  /** When it stops showing (ISO). None = until the CEO removes it. */
  until?: string;
}

/** Read-only mode: everyone except the CEO can look, but the server refuses changes. */
export interface ReadOnlyMode {
  on: boolean;
  message: string;
  message_en?: string;
}

/** What one signed-in person gets from `GET /site/live`. */
export interface SiteLive {
  features: Record<FeatureKey, boolean>;
  /** Only when it is for this person's job and has not ended. */
  banner: Banner | null;
  read_only: ReadOnlyMode;
}

export const ALL_FEATURES_ON = Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])) as Record<FeatureKey, boolean>;

export const DEFAULT_LIVE: SiteLive = { features: ALL_FEATURES_ON, banner: null, read_only: { on: false, message: "" } };

/** The menu items to hide for a job: the switched-off features' items. Never for the CEO (the CEO rule). */
export function hiddenNavKeys(live: Pick<SiteLive, "features">, role: Role): string[] {
  if (role === "ceo") return [];
  return FEATURE_KEYS.filter((k) => live.features[k] === false && FEATURE_NAV[k]).map((k) => FEATURE_NAV[k]!);
}

/** Is this feature on for this person? Always for the CEO. */
export const featureOn = (live: Pick<SiteLive, "features">, key: FeatureKey, role: Role) => role === "ceo" || live.features[key] !== false;

// ---- the store ----

const KEY = "p3.site";
const listeners = new Set<() => void>();
let current: SiteLive | null = null;

function load(): SiteLive {
  if (current) return current;
  try {
    const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    const parsed = saved ? (JSON.parse(saved) as SiteLive) : null;
    current = parsed?.features ? { ...DEFAULT_LIVE, ...parsed, features: { ...ALL_FEATURES_ON, ...parsed.features } } : DEFAULT_LIVE;
  } catch {
    current = DEFAULT_LIVE;
  }
  return current;
}

/** The server answered: every page that reads the switches draws again. */
export function setSiteLive(next: SiteLive) {
  if (current && JSON.stringify(current) === JSON.stringify(next)) return;
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The switches for the signed-in person (the defaults until the server answers). */
export function useSiteLive(): SiteLive {
  return useSyncExternalStore(subscribe, load, () => DEFAULT_LIVE);
}
