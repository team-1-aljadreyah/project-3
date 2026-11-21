// The demo backend for the CEO's advanced settings, with the rules the real server must keep (docs/backend.md,
// section 17): the CEO only, the same checks as the page (422 per field), only what differs from the defaults is kept,
// and a history line only for what really changed. Only the demo build loads it (see ./api.ts).
import { audit } from "@/mock/audit";
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, msg, nowIso, wait } from "@/mock/helpers";
import type { AdvancedApi } from "./api";
import { canUseAdvancedSettings, changedRules, checkRules, diffRules, liveFor, rulesOf } from "./rules";
import type { AdvancedData, AdvancedRules } from "./types";

const HISTORY_KEPT = 300;

function ceo() {
  const user = currentUser();
  if (!canUseAdvancedSettings(user)) return fail(403, "FORBIDDEN", "الإعدادات المتقدمة للمدير التنفيذي وحده.", "The advanced settings are for the CEO only.");
  return user;
}

/** The rules in force: the defaults, the CEO's changes, and the administration's security numbers. */
function current(): AdvancedRules {
  const db = getDb();
  return rulesOf(db.advanced, db.settings);
}

function answer(): AdvancedData {
  const last = getDb().advanced_log.at(-1);
  return { rules: current(), updated_at: last?.at, updated_by: last && { id: last.by.id, name: last.by.name } };
}

/** A setting's value as short text for the audit log. */
const short = (v: unknown) => {
  const s = v === null || v === undefined ? "-" : typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
};

export const advancedMock: AdvancedApi = {
  async get() {
    ceo();
    return wait(answer());
  },

  async save(sent, how) {
    const user = ceo();
    if (!sent || typeof sent !== "object" || Array.isArray(sent)) return fail(422, "VALIDATION", "إعدادات غير صحيحة.", "Wrong settings.");
    if (how !== undefined && how !== "import" && how !== "reset") return fail(422, "VALIDATION", "طريقة حفظ غير معروفة.", "Unknown way of saving.");
    // What was sent is the whole state: anything missing is its default (so "reset" sends nothing).
    const next = rulesOf(how === "reset" ? {} : sent);
    const problems = checkRules(next);
    const keys = Object.keys(problems);
    if (keys.length) {
      const errors = Object.fromEntries(keys.map((k) => [k, msg(problems[k].ar, problems[k].en)]));
      return fail(422, "VALIDATION", "صحّح الحقول المؤشرة بالأحمر.", "Fix the fields marked in red.", errors);
    }
    const db = getDb();
    const changes = diffRules(current(), next);
    // Nothing really changed: no history line, no audit line (Project 2 wrote one anyway).
    if (!changes.length) return wait(answer());

    // The security numbers live in the administration's settings (one source); the rest is kept as differences only.
    const { due_soon_days, lock_after, lock_minutes, password_min } = next.security;
    db.settings = { due_soon_days, lock_after, lock_minutes };
    const stored = changedRules(next);
    if (password_min !== rulesOf().security.password_min) stored.security = { ...next.security };
    else delete stored.security;
    db.advanced = stored;

    db.advanced_log.push({ id: ++db.seq.advanced_change, at: nowIso(), by: { id: user.id, name: user.name, name_en: user.name_en }, how, changes });
    db.advanced_log = db.advanced_log.slice(-HISTORY_KEPT);
    audit(user.id, "settings_changed", { type: "settings", label: "الإعدادات المتقدمة" }, changes.map((c) => ({ field: c.key, from: short(c.from), to: short(c.to) })));
    commit();
    return wait(answer());
  },

  async history() {
    ceo();
    return wait([...getDb().advanced_log].reverse());
  },

  async live() {
    const user = currentUser();
    return wait(liveFor(current(), user.role));
  },
};
