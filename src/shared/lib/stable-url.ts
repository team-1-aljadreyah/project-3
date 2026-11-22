// Links to files that stay the same while the screen is open. The server signs each file link anew on every answer
// (a new "?expires=…&signature=…" for the same file), and the chat asks for new messages every few seconds: a voice
// message then lost its loaded sound every 3 seconds and had to start loading again (the client, 22 November 2026:
// "I have to press it a lot so it loads"), and pictures loaded again and again. So the first link seen for a file is
// kept (the file is the same: same address without the part after "?"), until it stops working (an old signature):
// then `renewUrl` lets the next one in.

const kept = new Map<string, string>();

const fileOf = (url: string) => url.split("?")[0];

/** The link to use for this file: the first one seen while it still works. A link without "?" (or a data: link) as is. */
export function stableUrl(url: string): string;
export function stableUrl(url: string | undefined): string | undefined;
export function stableUrl(url: string | undefined) {
  if (!url || url.startsWith("data:") || url.startsWith("blob:") || !url.includes("?")) return url;
  const file = fileOf(url);
  const first = kept.get(file);
  if (first) return first;
  kept.set(file, url);
  return url;
}

/** The kept link stopped working (its signature ran out): forget it, so the fresher one in `url` is used. */
export function renewUrl(url: string) {
  kept.delete(fileOf(url));
}
