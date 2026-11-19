// The GitHub link's small rules: repository names, safe links, and which items belong to a task or bug. Pure functions,
// tested in tests/unit/github.test.ts; the server keeps the same rules (docs/backend.md, section 15).

export const GITHUB_LIMITS = { repos: 5 };

/** "owner/name", as GitHub allows them (letters, digits, - _ .). */
export const isRepoName = (s: string) => /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(s) && !s.endsWith(".git");

/** Only real GitHub addresses become links: a "javascript:" or another site's address is never clickable. */
export function safeGithubUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "github.com" ? u.href : null;
  } catch {
    return null;
  }
}

/** Does this text mention the code (TSK-104) as a whole word? "TSK-1040" doesn't mention "TSK-104". */
export function mentions(text: string, code: string) {
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9-])${escaped}(?![0-9])`, "i").test(text);
}
