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

// ---- Voice messages (a chat message whose file is a recording; docs/backend.md, sections 8 and 11) ----

/** The longest voice message: 5 minutes. The recorder stops there and keeps what was said. */
export const MAX_VOICE_SECONDS = 300;

/** Biggest voice message on the real server: 5 MB (5 minutes at 32 kbps is about 1.2 MB, so there is room). */
export const MAX_VOICE_BYTES = 5 * 1024 * 1024;

/** How many bars a voice message's waveform has (`VoiceMeta.peaks`). */
export const VOICE_PEAKS = 48;

/** The recordings a voice message may be, by extension: WebM/Ogg/Opus (Chrome, Firefox), MP4/M4A/AAC (Safari), MP3. */
export const VOICE_EXTENSIONS = ["webm", "weba", "ogg", "oga", "opus", "mp4", "m4a", "aac", "mp3"];

/** The kinds of audio the server recognises from a file's first bytes, and the type it stores for each. */
export const VOICE_MIME = { webm: "audio/webm", ogg: "audio/ogg", mp4: "audio/mp4", mp3: "audio/mpeg", aac: "audio/aac" } as const;
export type VoiceKind = keyof typeof VOICE_MIME;

/**
 * What a recording really is, from its first bytes (not its name or the type the browser claims), or null when it is
 * not one of the allowed kinds. The server must do the same (and may check more, for example that an MP4 has sound only).
 */
export function sniffAudio(head: Uint8Array): VoiceKind | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((b, j) => head[i + j] === b);
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return "webm"; // EBML (WebM / Matroska)
  if (at(0, 0x4f, 0x67, 0x67, 0x53)) return "ogg"; // "OggS"
  if (at(4, 0x66, 0x74, 0x79, 0x70)) return "mp4"; // "....ftyp"
  if (at(0, 0x49, 0x44, 0x33)) return "mp3"; // "ID3" tag before the MP3 frames
  // A frame's sync bits (11 ones): MPEG layer 1–3 is MP3; layer "00" is AAC in ADTS frames.
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return (head[1] & 0x06) === 0 ? "aac" : "mp3";
  return null;
}

/** Why a voice message can't be sent, or null if it can. The words are made by the caller in the right language. */
export function voiceProblem(
  file: { name: string; size: number },
  voice: { duration_s: number; peaks: number[] },
  maxBytes = MAX_VOICE_BYTES,
): "type" | "empty" | "size" | "duration" | "peaks" | null {
  if (!VOICE_EXTENSIONS.includes(extensionOf(file.name))) return "type";
  if (file.size === 0) return "empty";
  if (file.size > maxBytes) return "size";
  if (!Number.isFinite(voice.duration_s) || voice.duration_s <= 0 || voice.duration_s > MAX_VOICE_SECONDS) return "duration";
  const p = voice.peaks;
  if (!Array.isArray(p) || p.length !== VOICE_PEAKS || !p.every((n) => Number.isInteger(n) && n >= 0 && n <= 100)) return "peaks";
  return null;
}
