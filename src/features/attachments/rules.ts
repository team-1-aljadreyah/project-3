// Which files may be attached, and how big. The form checks them first (a quick message), and the server checks them
// again (the form can be skipped). Not decided by the client yet (BRIEF.md question 13): written as assumptions in
// docs/backend.md and changed here only.

/** Biggest file on the real server: 10 MB. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Most files on one task or project. */
export const MAX_FILES = 30;

/**
 * The file types people may attach, by extension. Not SVG or HTML: a browser can run code inside them, so an uploaded
 * one could attack whoever opens it.
 */
export const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip"];

/** The accept list for <input type="file">, so the picker shows only allowed files. */
export const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

export const extensionOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/** Images get a small preview; everything else gets an icon. */
export const isImage = (mime: string) => /^image\/(png|jpe?g|gif|webp)$/.test(mime);

/** Why a file can't be attached, or null if it can. The words are made by the caller in the right language. */
export function fileProblem(file: { name: string; size: number }, maxBytes = MAX_FILE_BYTES): "type" | "size" | "empty" | null {
  if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) return "type";
  if (file.size === 0) return "empty";
  if (file.size > maxBytes) return "size";
  return null;
}

/** "1.4 MB", "320 KB", "900 B": short and readable. */
export function sizeText(bytes: number, lang: "ar" | "en") {
  const units = lang === "ar" ? ["بايت", "ك.ب", "م.ب"] : ["B", "KB", "MB"];
  if (bytes < 1024) return `${bytes} ${units[0]}`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ${units[1]}`;
  // One decimal, without a useless ".0": "1.5 MB", "10 MB".
  return `${Number((bytes / 1024 / 1024).toFixed(1))} ${units[2]}`;
}
