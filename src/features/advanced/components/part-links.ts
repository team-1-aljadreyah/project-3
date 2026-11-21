// The parts of the page, their addresses, and which part each setting belongs to.

export type PartKey = "home" | "work" | "tasks" | "permissions" | "notify" | "features" | "security" | "names" | "announce" | "history";

export const PART_KEYS: PartKey[] = ["home", "work", "tasks", "permissions", "notify", "features", "security", "names", "announce", "history"];

/** The address of a part: /advanced?s=work (the home has none). */
export const partHref = (p: PartKey) => (p === "home" ? "/advanced" : `/advanced?s=${p}`);

/** The part a setting's key belongs to ("work.days", "due_days.high" → work; "banner.text" → announce). */
export function partOf(key: string): PartKey {
  const group = key.split(".")[0];
  if (group === "work" || group === "due_days" || group === "fix_days") return "work";
  if (group === "banner" || group === "read_only") return "announce";
  return (PART_KEYS as string[]).includes(group) ? (group as PartKey) : "home";
}

/** The first name, for a warm hello ("مريم العبيدي" → "مريم"). */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
