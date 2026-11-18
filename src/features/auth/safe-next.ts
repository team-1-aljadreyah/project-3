/**
 * Where to go after signing in. Only a path on this site is accepted ("/projects/1"), never another site
 * ("//evil.example", "https://…"), so a crafted login link can't send people elsewhere.
 */
export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/login")) return "/";
  return next;
}
