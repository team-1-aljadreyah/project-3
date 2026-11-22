// Voice messages: the small pure helpers behind the recorder and the player (tested in Node). The limits and the
// server's checks are the attachments feature's (src/features/attachments/rules.ts), as a recording is a message file.
import { MAX_VOICE_SECONDS, VOICE_PEAKS, type Attachment } from "@/features/attachments";
import type { Lang } from "@/shared/lib/format";
import type { Message } from "./types";

/**
 * The best recording format this browser has, in order: Opus in WebM (Chrome, Edge, Firefox; small and clear), MP4/AAC
 * (Safari on iPhone and Mac), Opus in Ogg, then plain WebM. "" when none answers yes: the browser then uses its own.
 */
export const VOICE_FORMATS = ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

export function pickVoiceFormat(isSupported: (type: string) => boolean): string {
  for (const type of VOICE_FORMATS) {
    try {
      if (isSupported(type)) return type;
    } catch {
      // An old browser that throws instead of answering: try the next one.
    }
  }
  return "";
}

/** The file type (no codecs) and extension of what the recorder made: "audio/webm;codecs=opus" → audio/webm, webm. */
export function voiceFileType(recorderType: string): { mime: string; ext: string } {
  const mime = (recorderType.split(";")[0] || "audio/webm").trim().toLowerCase();
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return { mime: "audio/mp4", ext: "m4a" };
  if (mime.includes("ogg")) return { mime: "audio/ogg", ext: "ogg" };
  if (mime.includes("mpeg") || mime.includes("mp3")) return { mime: "audio/mpeg", ext: "mp3" };
  return { mime: "audio/webm", ext: "webm" };
}

/**
 * The waveform of a recording: `count` bars (48), each the loudest sample of its slice, as whole numbers 0–100 where
 * 100 is the loudest bar (so a quiet recording still shows its shape). Works on the decoded sound (thousands of
 * samples) and on the few levels measured while recording (fewer than the bars: each level then covers several bars).
 */
export function computePeaks(samples: ArrayLike<number>, count = VOICE_PEAKS): number[] {
  const n = samples.length;
  const raw: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * n) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * n) / count));
    let peak = 0;
    for (let j = start; j < end && j < n; j++) peak = Math.max(peak, Math.abs(samples[j]) || 0);
    raw.push(peak);
  }
  const top = Math.max(...raw);
  return raw.map((p) => (top > 0 ? Math.round((p / top) * 100) : 0));
}

/** How loud the microphone is right now, 0–1, from the analyser's bytes (128 = silence): the root mean square, boosted. */
export function levelOf(timeDomain: ArrayLike<number>): number {
  if (!timeDomain.length) return 0;
  let sum = 0;
  for (let i = 0; i < timeDomain.length; i++) {
    const v = (timeDomain[i] - 128) / 128;
    sum += v * v;
  }
  // Speech is quiet next to the full scale: ×3 makes ordinary talk fill the bars, capped at 1.
  return Math.min(1, Math.sqrt(sum / timeDomain.length) * 3);
}

/** The length sent with a recording: one decimal, at least 0.1 s, never more than the limit. */
export const voiceDuration = (seconds: number) => Math.min(MAX_VOICE_SECONDS, Math.max(0.1, Math.round(seconds * 10) / 10));

/** A clock for a voice message: 0:07, 1:05, 5:00 (whole seconds, rounded down; Latin digits like the rest of the site). */
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Arabic count words: 1 ثانية، 2 ثانيتان، 3–10 ثوانٍ، 11+ ثانية (and the same for minutes). */
function arCount(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n >= 3 && n <= 10 ? few : many}`;
}

/** A length read out by a screen reader: "47 seconds", "1 minute 5 seconds", "دقيقة و5 ثوانٍ". */
export function spokenDuration(seconds: number, lang: Lang) {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (lang === "en") {
    const mins = m ? `${m} minute${m === 1 ? "" : "s"}` : "";
    const secs = r || !m ? `${r} second${r === 1 ? "" : "s"}` : "";
    return [mins, secs].filter(Boolean).join(" ");
  }
  const mins = m ? arCount(m, "دقيقة", "دقيقتان", "دقائق", "دقيقة") : "";
  const secs = r || !m ? (r === 0 ? "0 ثانية" : arCount(r, "ثانية واحدة", "ثانيتان", "ثوانٍ", "ثانية")) : "";
  return [mins, secs].filter(Boolean).join(" و");
}

/** The playing speeds, in the order the button goes through them. */
export const SPEEDS = [1, 1.5, 2];
export const nextSpeed = (rate: number) => SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];

/** Where a press on the waveform falls, 0–1 from the start of the recording (the start is on the right in Arabic). */
export function seekRatio(x: number, rect: { left: number; width: number }, rtl: boolean) {
  if (rect.width <= 0) return 0;
  const r = (x - rect.left) / rect.width;
  return Math.min(1, Math.max(0, rtl ? 1 - r : r));
}

/** The voice recording of a message, if it is a voice message. */
export const voiceOf = (m: Pick<Message, "files">): (Attachment & { voice: NonNullable<Attachment["voice"]> }) | undefined =>
  m.files.find((f): f is Attachment & { voice: NonNullable<Attachment["voice"]> } => !!f.voice);

/** A short line for a message where its text would go (the chat list, a reply): its text, or what it carries. */
export function messageSummary(m: Pick<Message, "body" | "files">, tr: (ar: string, en: string) => string) {
  if (m.body) return m.body;
  const voice = voiceOf(m);
  if (voice) return `${tr("رسالة صوتية", "Voice message")} (${clock(voice.voice.duration_s)})`;
  return tr("ملف مرفق", "A file");
}
