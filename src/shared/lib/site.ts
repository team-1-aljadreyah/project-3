// The CEO's site-wide switches that every signed-in page obeys: which features are on, the banner on top of the
// pages, and the read-only mode. The CEO sets them in the advanced settings (src/features/advanced); the server sends
// each person the part that concerns them (`GET /site/live`). They are here, not in that feature, because the top bar
// (shared) and other features read them, and shared/ never imports a feature.
//
// The last answer is kept in the browser, so a new tab knows them before the server answers (the welcome splash).
import { useSyncExternalStore } from "react";
import type { Role, User } from "../api/types";
import { navFor, ROLES } from "./access";
import type { Lang } from "./format";
import { useFmt } from "./i18n";

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

/** The actions of «who may do what» (the CEO's advanced settings). The CEO may always do all of them. */
export type ActionKey =
  | "create_project"
  | "close_project"
  | "delete_task"
  | "reassign_task"
  | "change_due"
  | "approve_done"
  | "post_announcement"
  | "create_group_chat"
  | "see_scores"
  | "write_reviews"
  | "see_reports"
  | "export_csv"
  | "report_bugs"
  | "give_ratings"
  | "bug_severity";

/** The jobs a custom role can start like (never the CEO, never the system admin). */
export type BaseJob = "pm" | "monitor" | "lead" | "employee";
export const BASE_JOBS: BaseJob[] = ["pm", "monitor", "lead", "employee"];

/** The colours a custom role's badge can have (the status colour families). */
export type RoleColor = "todo" | "progress" | "review" | "testing" | "done" | "new";
export const ROLE_COLORS: RoleColor[] = ["todo", "progress", "review", "testing", "done", "new"];

/**
 * A job the CEO made (advanced settings, «Jobs and roles»). A person with it keeps a base job in `User.role` (every
 * rule of the platform keeps working from it), and `User.custom_role` names this role, which can only take away:
 * the actions it may do and the menu pages it sees are within what its base job has.
 */
export interface CustomRole {
  /** A short stable id ("role-k3x9"): what `User.custom_role` holds. */
  key: string;
  name: string;
  name_en: string;
  description?: string;
  color: RoleColor;
  /** The job it starts like. It can't change later (its people's rules come from it). */
  base: BaseJob;
  /** The actions of «who may do what» it may do. */
  actions: ActionKey[];
  /** The menu items (NAV keys) it sees. */
  pages: string[];
}

/**
 * The actions the server already refuses for a custom role whose tick is off (and the page hides the button). The
 * others are kept and enforced later.
 */
export const ENFORCED_ACTIONS: ActionKey[] = ["create_project", "reassign_task", "change_due", "post_announcement", "create_group_chat", "write_reviews", "report_bugs", "give_ratings"];

/** What one signed-in person gets from `GET /site/live`. */
export interface SiteLive {
  features: Record<FeatureKey, boolean>;
  /** Only when it is for this person's job and has not ended. */
  banner: Banner | null;
  read_only: ReadOnlyMode;
  /** The CEO's custom roles (names, colours, what each may do and see). */
  roles: CustomRole[];
  /** The person's job as the server has it now (an admin may have given them a custom role since they signed in). */
  me?: Pick<User, "role" | "custom_role">;
  /** The shortest password allowed for new and changed passwords (the CEO's security.password_min; 8 when missing). */
  password_min?: number;
}

export const ALL_FEATURES_ON = Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])) as Record<FeatureKey, boolean>;

export const DEFAULT_LIVE: SiteLive = { features: ALL_FEATURES_ON, banner: null, read_only: { on: false, message: "" }, roles: [] };

type Person = Pick<User, "role" | "custom_role">;

/** The person's custom role, if they have one that still exists. */
export const customRoleOf = (live: Pick<SiteLive, "roles">, user: Person) => (user.custom_role ? live.roles?.find((r) => r.key === user.custom_role) : undefined);

/**
 * The menu items to hide for a person: the switched-off features' items, and the pages their custom role doesn't
 * see. Never for the CEO (the CEO rule).
 */
export function hiddenNavKeys(live: Pick<SiteLive, "features" | "roles">, user: Person): string[] {
  if (user.role === "ceo") return [];
  const off = FEATURE_KEYS.filter((k) => live.features[k] === false && FEATURE_NAV[k]).map((k) => FEATURE_NAV[k]!);
  const role = customRoleOf(live, user);
  const notMine = role ? navFor(user.role).filter((n) => !role.pages.includes(n.key)).map((n) => n.key) : [];
  return [...new Set([...off, ...notMine])];
}

/**
 * May this person do this action? The CEO always; someone without a custom role as their job allows (the features'
 * own rules decide); someone with a custom role only if its tick is on.
 */
export function roleAllows(live: Pick<SiteLive, "roles">, user: Person, action: ActionKey) {
  if (user.role === "ceo") return true;
  const role = customRoleOf(live, user);
  return !role || role.actions.includes(action);
}

/** The name of a person's job: their custom role's name, else the base job's name. */
export function roleName(user: Person, lang: Lang, roles: CustomRole[] = load().roles ?? []) {
  const role = user.custom_role ? roles.find((r) => r.key === user.custom_role) : undefined;
  if (role) return lang === "en" ? role.name_en || role.name : role.name;
  const w = ROLES[user.role];
  return lang === "en" ? w.en : w.ar;
}

/** roleName for pages: draws again when the roles change. */
export function useRoleName() {
  const { lang } = useFmt();
  const live = useSiteLive();
  return (user: Person) => roleName(user, lang, live.roles ?? []);
}

/** roleAllows for pages: `const may = useMay(); may(me, "report_bugs")`. */
export function useMay() {
  const live = useSiteLive();
  return (user: Person, action: ActionKey) => roleAllows(live, user, action);
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
    current = parsed?.features ? { ...DEFAULT_LIVE, ...parsed, features: { ...ALL_FEATURES_ON, ...parsed.features }, roles: parsed.roles ?? [] } : DEFAULT_LIVE;
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
