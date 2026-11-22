// Importing accounts from a CSV file, as pure functions (no React, no network), so they are easy to test
// (tests/unit/admin-console.test.ts): reading CSV text (quotes, commas and new lines inside quotes, Arabic), finding the
// columns by their names in either language, and checking each row the way the server does (the demo backend uses the
// same check, docs/backend.md section 14).
import type { Role, Team } from "@/shared/api/types";
import { ROLES } from "@/shared/lib/access";
import { ADMIN_LIMITS, isEmail } from "./rules";
import type { ImportCheck, ImportProblem, ImportRow } from "./types";

/** The most rows one import may send (the server answers 422 on `rows` above it). */
export const IMPORT_LIMIT = 500;

/** The columns, in the template's order, with the names they are found by (any case, either language). */
export const IMPORT_COLUMNS: { key: keyof ImportRow; ar: string; en: string; required?: boolean; names: string[] }[] = [
  { key: "name", ar: "الاسم", en: "Name", required: true, names: ["name", "full name", "الاسم", "الاسم الكامل", "الاسم بالعربية"] },
  { key: "name_en", ar: "الاسم بالإنجليزية", en: "English name", names: ["name_en", "english name", "name in english", "الاسم بالإنجليزية", "الاسم بالانجليزية", "الاسم الإنجليزي"] },
  { key: "email", ar: "البريد الإلكتروني", en: "Email", required: true, names: ["email", "e-mail", "email address", "البريد", "البريد الإلكتروني", "البريد الالكتروني"] },
  { key: "phone", ar: "الهاتف", en: "Phone", names: ["phone", "mobile", "phone number", "الهاتف", "الجوال", "رقم الهاتف"] },
  { key: "role", ar: "الدور", en: "Job", names: ["job", "role", "الدور", "الوظيفة"] },
  { key: "title", ar: "المسمى الوظيفي", en: "Job title", names: ["title", "job title", "المسمى", "المسمى الوظيفي"] },
  { key: "team", ar: "الفريق", en: "Team", names: ["team", "الفريق"] },
];

/** The jobs an import may give. The CEO and the system admin are made one by one in the users list, never in bulk. */
export const IMPORT_ROLES: Role[] = ["pm", "monitor", "lead", "employee"];

// ── Reading CSV text ────────────────────────────────────────────────────────────────────────────────────────────────

/** The separator a file uses: a comma, or the semicolon or tab some spreadsheets write; read from the first line. */
function separatorOf(text: string): string {
  let inQuotes = false;
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  return counts[";"] > counts[","] && counts[";"] >= counts["\t"] ? ";" : counts["\t"] > counts[","] ? "\t" : ",";
}

/**
 * CSV text → rows of cells. Follows RFC 4180: a cell in double quotes may hold the separator, new lines and quotes
 * written twice (""). Takes Windows (CRLF) and Unix (LF) lines, drops the BOM Excel puts at the start, and drops lines
 * that are empty. Never throws: a quote that is never closed takes the rest of the text.
 */
export function parseCsv(text: string): string[][] {
  const src = text.startsWith("\u{FEFF}") ? text.slice(1) : text;
  const sep = separatorOf(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const endRow = () => {
    row.push(cell);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
    cell = "";
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"' && cell.trim() === "") {
      // A quote opens a quoted cell only at its start (spaces before it are dropped).
      cell = "";
      inQuotes = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRow();
    } else cell += ch;
  }
  if (cell !== "" || row.length) endRow();
  return rows;
}

/** A cell as a value: spaces trimmed, and the ' our own CSV download puts before = + - @ (so a phone "+964…" comes back). */
const cellValue = (s: string | undefined) => (s ?? "").trim().replace(/^'(?=[=+\-@])/, "");

/** A column name as compared: lower case, single spaces, no "*" (a required mark). */
const headName = (s: string) => s.replace(/\*/g, "").trim().replace(/\s+/g, " ").toLowerCase();

export interface ParsedImport {
  rows: ImportRow[];
  /** Column names in the file that mean nothing here (their cells are left out). */
  unknown: string[];
  /** Required columns the file doesn't have. */
  missing: (keyof ImportRow)[];
  /** The file has no line of column names that we know. */
  noHeader: boolean;
}

/** CSV text → import rows, by the column names in its first line (in any order, in Arabic or English). */
export function rowsFromCsv(text: string): ParsedImport {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], unknown: [], missing: [], noHeader: true };
  const head = table[0].map(headName);
  const index = new Map<keyof ImportRow, number>();
  const unknown: string[] = [];
  head.forEach((h, i) => {
    const col = IMPORT_COLUMNS.find((c) => c.names.includes(h));
    if (col && !index.has(col.key)) index.set(col.key, i);
    else if (!col && h) unknown.push(table[0][i].trim());
  });
  if (!index.size) return { rows: [], unknown: [], missing: [], noHeader: true };
  const missing = IMPORT_COLUMNS.filter((c) => c.required && !index.has(c.key)).map((c) => c.key);
  const rows = table.slice(1).map((cells) => {
    const row = {} as ImportRow;
    for (const c of IMPORT_COLUMNS) row[c.key] = index.has(c.key) ? cellValue(cells[index.get(c.key)!]) : "";
    return row;
  });
  return { rows, unknown, missing, noHeader: false };
}

/** The template a person fills: the column names and two example rows (invented people). */
export function templateRows(): string[][] {
  return [
    IMPORT_COLUMNS.map((c) => c.key === "role" ? "job" : c.key),
    ["نور الهدى سالم", "Noor Al-Huda Salem", "noor.salem@example.test", "07700000001", "employee", "محاسبة", ""],
    ["كرار محمد", "Karrar Mohammed", "karrar.m@example.test", "", "موظف", "مطور واجهات", "فريق التطوير"],
  ];
}

// ── Checking the rows (the same check on the server) ───────────────────────────────────────────────────────────────

const lower = (s: string) => s.trim().toLowerCase();

/** A job as written in a file ("employee", "موظف", "Employee", "team leader") → its key, or null when unknown. */
export function roleFromText(text: string): Role | null {
  const t = lower(text);
  if (!t) return "employee";
  for (const [key, w] of Object.entries(ROLES) as [Role, { ar: string; en: string }][]) {
    if (t === key || t === lower(w.ar) || t === lower(w.en)) return key;
  }
  return null;
}

/** A team as written in a file → the team (its Arabic or English name, any case), or null when there is none by it. */
export function teamFromText(text: string, teams: Pick<Team, "id" | "name" | "name_en">[]) {
  const t = lower(text);
  if (!t) return undefined;
  return teams.find((x) => lower(x.name) === t || (!!x.name_en && lower(x.name_en) === t)) ?? null;
}

/**
 * Checks every row: a name (≤ 120), a valid email that is not twice in the file and not an account's already, a job we
 * know that an import may give (not the CEO or the admin), a title ≤ 80, and a team that exists. Every problem of a row
 * is listed, so a person fixes the file once. `emails`: the accounts' emails now (any case).
 */
export function checkImportRows(rows: ImportRow[], existing: { emails: string[]; teams: Pick<Team, "id" | "name" | "name_en">[] }): ImportCheck[] {
  const taken = new Set(existing.emails.map(lower));
  const firstLine = new Map<string, number>();
  return rows.map((row, i) => {
    const line = i + 1;
    const problems: ImportCheck["problems"] = [];
    const add = (field: keyof ImportRow, problem: ImportProblem, other_line?: number) => problems.push(other_line ? { field, problem, other_line } : { field, problem });
    const name = row.name.trim();
    if (!name) add("name", "name_missing");
    else if (name.length > ADMIN_LIMITS.name) add("name", "name_too_long");
    const email = lower(row.email);
    if (!email) add("email", "email_missing");
    else if (!isEmail(email)) add("email", "email_bad");
    else if (firstLine.has(email)) add("email", "email_twice", firstLine.get(email));
    else if (taken.has(email)) add("email", "email_taken");
    if (email && isEmail(email) && !firstLine.has(email)) firstLine.set(email, line);
    const role = roleFromText(row.role);
    if (role === null) add("role", "role_unknown");
    else if (!IMPORT_ROLES.includes(role)) add("role", "role_not_allowed");
    if (row.title.trim().length > ADMIN_LIMITS.title) add("title", "title_too_long");
    if (teamFromText(row.team, existing.teams) === null) add("team", "team_unknown");
    return { line, problems };
  });
}

/** Each problem in words, for the preview and the result. */
export const PROBLEM_WORDS: Record<ImportProblem, { ar: string; en: string }> = {
  name_missing: { ar: "الاسم فارغ", en: "The name is empty" },
  name_too_long: { ar: "الاسم أطول من 120 حرفاً", en: "The name is longer than 120 characters" },
  email_missing: { ar: "البريد فارغ", en: "The email is empty" },
  email_bad: { ar: "البريد غير صحيح", en: "The email is not valid" },
  email_twice: { ar: "البريد مكرر في الملف", en: "The email is twice in the file" },
  email_taken: { ar: "يوجد حساب بهذا البريد", en: "An account already uses this email" },
  role_unknown: { ar: "دور غير معروف", en: "Unknown job" },
  role_not_allowed: { ar: "لا يُستورد مدير تنفيذي ولا مسؤول نظام: أضفه من قائمة المستخدمين", en: "A CEO or a system admin isn't imported: add them in the users list" },
  title_too_long: { ar: "المسمى أطول من 80 حرفاً", en: "The title is longer than 80 characters" },
  team_unknown: { ar: "لا يوجد فريق بهذا الاسم", en: "No team has this name" },
};
