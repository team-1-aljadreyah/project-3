// What the audit log's detail panel needs, as pure functions (no React, no network), so they are easy to test
// (tests/unit/audit-detail.test.ts): the browser and system read from a User-Agent, the before → after rows of a line's
// changes with human field names, the address filter, and the plain text that "Copy details" puts on the clipboard.
import { ROLES } from "@/shared/lib/access";
import type { Tr } from "@/shared/lib/format";
import type { Role } from "@/shared/api/types";
import type { AuditEntry } from "./types";

// ── The device: browser, system and kind, read from the User-Agent header ──────────────────────────────────────────

export interface Device {
  /** "Chrome", "Safari", "Edge", "Firefox"…, or undefined when it can't be read. */
  browser?: string;
  /** The browser's main version ("131"). */
  version?: string;
  /** "Windows", "macOS", "iOS", "iPadOS", "Android", "Linux", "ChromeOS"…, or undefined. */
  os?: string;
  /** The system's version when the header says it ("17.5" for iOS, "14" for Android). */
  osVersion?: string;
  kind: "computer" | "phone" | "tablet" | "other";
}

/** Browsers in the order they must be tried: Edge and Opera say "Chrome" too, Chrome says "Safari" too. */
const BROWSERS: [name: string, re: RegExp][] = [
  ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
  ["Opera", /(?:OPR|Opera)\/(\d+)/],
  ["Samsung Internet", /SamsungBrowser\/(\d+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
  ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
  ["Safari", /Version\/(\d+(?:\.\d+)?).*Safari\//],
  ["curl", /^curl\/(\d+(?:\.\d+)*)/],
  ["Postman", /PostmanRuntime\/(\d+(?:\.\d+)*)/],
];

/** Reads the browser, the system and the kind of device from a User-Agent. Never throws; unknown parts stay empty. */
export function parseUserAgent(ua?: string): Device {
  if (!ua?.trim()) return { kind: "other" };
  let browser: string | undefined;
  let version: string | undefined;
  for (const [name, re] of BROWSERS) {
    const m = ua.match(re);
    if (m) {
      browser = name;
      version = m[1];
      break;
    }
  }

  let os: string | undefined;
  let osVersion: string | undefined;
  const ios = ua.match(/(iPhone|iPad|iPod).*?OS (\d+)[_.](\d+)/);
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  if (ios) {
    os = ios[1] === "iPad" ? "iPadOS" : "iOS";
    osVersion = `${ios[2]}.${ios[3]}`;
  } else if (android) {
    os = "Android";
    osVersion = android[1];
  } else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Ubuntu/.test(ua)) os = "Ubuntu";
  else if (/Linux/.test(ua)) os = "Linux";

  const kind: Device["kind"] = /iPad|Tablet/.test(ua) || (os === "Android" && !/Mobile/.test(ua))
    ? "tablet"
    : /iPhone|iPod|Mobile/.test(ua)
      ? "phone"
      : os
        ? "computer"
        : "other";
  return { browser, version, os, osVersion, kind };
}

/** "Chrome 131 on Windows" / "Chrome 131 على Windows"; "Unknown device" when nothing can be read. */
export function deviceWords(d: Device, tr: Tr, withVersions = true) {
  const b = d.browser && (withVersions && d.version ? `${d.browser} ${d.version}` : d.browser);
  const o = d.os && (withVersions && d.osVersion ? `${d.os} ${d.osVersion}` : d.os);
  if (b && o) return tr(`${b} على ${o}`, `${b} on ${o}`);
  return b || o || tr("جهاز غير معروف", "Unknown device");
}

export const DEVICE_KIND: Record<Device["kind"], { ar: string; en: string }> = {
  computer: { ar: "حاسوب", en: "Computer" },
  phone: { ar: "هاتف", en: "Phone" },
  tablet: { ar: "جهاز لوحي", en: "Tablet" },
  other: { ar: "غير معروف", en: "Unknown" },
};

// ── Addresses ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Does an address match the filter? Exact ("192.0.2.14"), or a prefix when the filter ends with ".", ":" or "*"
 * ("192.0.2." and "192.0.2.*" match the whole block). Without such an ending a filter matches whole parts only:
 * "192.0.2" matches "192.0.2.14" but "192.0.2.1" never matches "192.0.2.14".
 */
export function ipMatches(ip: string | undefined, filter: string | undefined) {
  const f = filter?.trim();
  if (!f) return true;
  if (!ip) return false;
  if (f.endsWith("*")) return ip.startsWith(f.slice(0, -1));
  if (f.endsWith(".") || f.endsWith(":")) return ip.startsWith(f);
  return ip === f || ip.startsWith(`${f}.`) || ip.startsWith(`${f}:`);
}

/** A session id as shown: its first 8 characters (enough to tell sessions apart on one screen). */
export const shortSession = (id?: string) => (id ? id.replace(/^s[-_]/, "").slice(0, 8) : undefined);

// ── Changes: human field names and the before → after rows ─────────────────────────────────────────────────────────

/** The names of the fields the audit log records (by the key the server writes). Others show their key. */
export const FIELD_WORDS: Record<string, { ar: string; en: string }> = {
  name: { ar: "الاسم", en: "Name" },
  name_en: { ar: "الاسم بالإنجليزية", en: "English name" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  phone: { ar: "الهاتف", en: "Phone" },
  title: { ar: "المسمى الوظيفي", en: "Job title" },
  role: { ar: "الدور", en: "Role" },
  custom_role: { ar: "الدور المخصص", en: "Custom role" },
  team: { ar: "الفريق", en: "Team" },
  lead: { ar: "قائد الفريق", en: "Team leader" },
  pm: { ar: "مدير المشروع", en: "Project manager" },
  template: { ar: "من القالب", en: "From template" },
  moved_to: { ar: "نُقل ما تبقى إلى", en: "Remaining work moved to" },
  done: { ar: "المنجز من المخطط", en: "Done of planned" },
  total: { ar: "الدرجة النهائية", en: "Final score" },
  items: { ar: "المعايير وأوزانها", en: "Criteria and weights" },
  minutes: { ar: "مدة القفل (دقائق)", en: "Lock length (minutes)" },
  due_soon_days: { ar: "تذكير «قريب الموعد» (أيام)", en: "\"Due soon\" reminder (days)" },
  lock_after: { ar: "محاولات خاطئة قبل القفل", en: "Wrong passwords before lock" },
  lock_minutes: { ar: "مدة القفل (دقائق)", en: "Lock length (minutes)" },
};

export const fieldName = (field: string, tr: Tr) => {
  const w = FIELD_WORDS[field];
  return w ? tr(w.ar, w.en) : field;
};

/** A value in words where the platform has words for it (a job, the backlog); else as it was written. */
export function valueWords(field: string, value: string | undefined, tr: Tr) {
  if (value === undefined || value === "") return value;
  if (field === "role" && value in ROLES) {
    const w = ROLES[value as Role];
    return tr(w.ar, w.en);
  }
  if (field === "moved_to" && value === "backlog") return tr("قائمة الانتظار", "Backlog");
  return value;
}

/** One row of the changes table: a value that changed (or was set, or cleared), or a list with what was added and removed. */
export type DiffRow =
  | { field: string; type: "value"; from?: string; to?: string }
  | { field: string; type: "list"; added: string[]; removed: string[] };

/** A list written as text ("a، b، c" or "a, b, c"): its items, or null when it is a single value. */
const LIST_SPLIT = /\s*[،,]\s+|\s*،\s*/;
function listOf(v?: string) {
  if (!v) return null;
  const items = v.split(LIST_SPLIT).map((s) => s.trim()).filter(Boolean);
  return items.length >= 2 ? items : null;
}

/**
 * The before → after rows of a line's changes: one row per field, in the order written. A field whose value did not
 * change is left out. When both sides are lists, the row says what was added (+) and removed (−) instead of the two
 * long texts (a list only put in a new order stays a plain before → after row).
 */
export function buildDiff(changes: AuditEntry["changes"]): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const c of changes ?? []) {
    const from = c.from ?? undefined;
    const to = c.to ?? undefined;
    if ((from ?? "") === (to ?? "")) continue;
    const a = listOf(from);
    const b = listOf(to);
    if (a && b) {
      const added = b.filter((x) => !a.includes(x));
      const removed = a.filter((x) => !b.includes(x));
      if (added.length || removed.length) {
        rows.push({ field: c.field, type: "list", added, removed });
        continue;
      }
    }
    rows.push({ field: c.field, type: "value", from, to });
  }
  return rows;
}

// ── The search box ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The text the search box looks in for one line: who (given by the caller), the subject, what changed, the address. */
export const searchText = (e: AuditEntry, who: string[], actionWords: string[]) =>
  [...who, ...actionWords, e.target.label, e.ip, ...(e.changes ?? []).flatMap((c) => [c.field, c.from, c.to])].filter(Boolean).join(" \n ");

// ── "Copy details" ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Everything about a line as plain text, one fact per line, for the clipboard (to paste into a ticket or a message). */
export function detailText(
  e: AuditEntry,
  words: { tr: Tr; who: string; action: string; when: string; kind: string; device: string; result?: string },
): string {
  const { tr } = words;
  const lines = [
    `${tr("سجل العمليات", "Audit log")} #${e.id}`,
    `${tr("من", "Who")}: ${words.who}`,
    `${tr("العملية", "Action")}: ${words.action}`,
    `${tr("على", "Subject")}: ${e.target.label}${e.target.id ? ` (#${e.target.id})` : ""}`,
    `${tr("النوع", "Kind")}: ${words.kind}`,
    `${tr("الوقت", "When")}: ${words.when} (${e.at})`,
  ];
  if (words.result) lines.push(`${tr("النتيجة", "Result")}: ${words.result}`);
  lines.push(`${tr("عنوان IP", "IP address")}: ${e.ip ?? "-"}`, `${tr("الجهاز", "Device")}: ${words.device}`);
  if (e.session_id) lines.push(`${tr("الجلسة", "Session")}: ${e.session_id}`);
  if (e.request_id) lines.push(`${tr("رقم الطلب", "Request")}: ${e.request_id}`);
  if (e.user_agent) lines.push(`User-Agent: ${e.user_agent}`);
  const diff = buildDiff(e.changes);
  if (diff.length) {
    lines.push(`${tr("ما تغيّر", "Changes")}:`);
    for (const r of diff) {
      const name = fieldName(r.field, tr);
      if (r.type === "list") lines.push(`  ${name}: ${[...r.added.map((x) => `+ ${x}`), ...r.removed.map((x) => `− ${x}`)].join("; ")}`);
      else lines.push(`  ${name}: ${valueWords(r.field, r.from, tr) ?? "-"} → ${valueWords(r.field, r.to, tr) ?? "-"}`);
    }
  }
  return lines.join("\n");
}
