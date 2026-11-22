// Voice messages in the chat: the recorder's and the player's small helpers, the limits, the check of the file's real
// type, and the demo backend's rules (the same the real server must keep: docs/backend.md, sections 8 and 11).
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS, sniffAudio, VOICE_PEAKS, voiceProblem } from "@/features/attachments/rules";
import { clock, computePeaks, levelOf, messageSummary, nextSpeed, pickVoiceFormat, seekRatio, spokenDuration, voiceDuration, voiceFileType, voiceOf } from "@/features/chat/voice";
import { ApiError } from "@/shared/api/errors";

// The demo backend reads the session from localStorage: a small in-memory one for Node.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { chatMock: chat } = await import("@/features/chat/mock");
const { attachmentsMock: files } = await import("@/features/attachments/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader, 5–7 employees (team 1), 8 admin. Private chat d-1: Ahmed (2) and Sara (5).
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

const WEBM = [0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81];
const MP4 = [0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20];
/** A small recording: the real first bytes of its kind, then filler. */
const recording = (name = "voice.webm", head = WEBM, size = 2000) => {
  const bytes = new Uint8Array(size);
  bytes.set(head);
  return new File([bytes], name, { type: "audio/webm" });
};
const peaks = Array.from({ length: VOICE_PEAKS }, (_, i) => (i * 7) % 101);
const meta = (duration_s = 4.2) => ({ duration_s, peaks });

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("choosing the recording format", () => {
  it("Opus in WebM first (Chrome, Firefox), MP4 on Safari, else the browser's own", () => {
    expect(pickVoiceFormat((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(pickVoiceFormat((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickVoiceFormat((t) => t.startsWith("audio/mp4"))).toBe("audio/mp4;codecs=mp4a.40.2");
    expect(pickVoiceFormat((t) => t === "audio/ogg;codecs=opus")).toBe("audio/ogg;codecs=opus");
    expect(pickVoiceFormat(() => false)).toBe("");
    // A browser that throws instead of answering is skipped, not a crash.
    expect(
      pickVoiceFormat((t) => {
        if (t.includes("webm")) throw new Error("old browser");
        return t === "audio/mp4";
      }),
    ).toBe("audio/mp4");
  });

  it("names the file after what was recorded", () => {
    expect(voiceFileType("audio/webm;codecs=opus")).toEqual({ mime: "audio/webm", ext: "webm" });
    expect(voiceFileType("audio/mp4;codecs=mp4a.40.2")).toEqual({ mime: "audio/mp4", ext: "m4a" });
    expect(voiceFileType("audio/ogg; codecs=opus")).toEqual({ mime: "audio/ogg", ext: "ogg" });
    expect(voiceFileType("")).toEqual({ mime: "audio/webm", ext: "webm" });
  });
});

describe("the waveform", () => {
  it("48 bars of whole numbers 0–100, the loudest slice at 100", () => {
    const samples = new Float32Array(4800).map((_, i) => Math.sin(i / 30) * (i / 4800));
    const p = computePeaks(samples);
    expect(p).toHaveLength(48);
    expect(p.every((n) => Number.isInteger(n) && n >= 0 && n <= 100)).toBe(true);
    expect(Math.max(...p)).toBe(100);
    // Getting louder: the end is louder than the start.
    expect(p[47]).toBeGreaterThan(p[2]);
  });

  it("uses the loudest sample of each slice, negative ones too", () => {
    expect(computePeaks([0, -0.5, 0.25, 0], 2)).toEqual([100, 50]);
  });

  it("silence is flat, and fewer levels than bars spread over the bars", () => {
    expect(computePeaks(new Float32Array(100))).toEqual(Array(48).fill(0));
    const p = computePeaks([0.5, 1], 4);
    expect(p).toEqual([50, 50, 100, 100]);
    expect(computePeaks([], 3)).toEqual([0, 0, 0]);
  });

  it("the live level: 0 for silence, up to 1 for loud sound", () => {
    expect(levelOf(new Uint8Array(256).fill(128))).toBe(0);
    expect(levelOf(new Uint8Array(256).map((_, i) => (i % 2 ? 255 : 0)))).toBe(1);
    const quiet = levelOf(new Uint8Array(256).map((_, i) => (i % 2 ? 140 : 116)));
    expect(quiet).toBeGreaterThan(0);
    expect(quiet).toBeLessThan(1);
  });
});

describe("times and speeds", () => {
  it("a clock like a voice note's", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(7.9)).toBe("0:07");
    expect(clock(65)).toBe("1:05");
    expect(clock(300)).toBe("5:00");
    expect(clock(Infinity)).toBe("0:00");
  });

  it("the length read out, in Arabic and English", () => {
    expect(spokenDuration(47, "en")).toBe("47 seconds");
    expect(spokenDuration(65, "en")).toBe("1 minute 5 seconds");
    expect(spokenDuration(120, "en")).toBe("2 minutes");
    expect(spokenDuration(1, "en")).toBe("1 second");
    expect(spokenDuration(47, "ar")).toBe("47 ثانية");
    expect(spokenDuration(65, "ar")).toBe("دقيقة و5 ثوانٍ");
    expect(spokenDuration(2, "ar")).toBe("ثانيتان");
    expect(spokenDuration(0, "ar")).toBe("0 ثانية");
  });

  it("the length sent: one decimal, never 0, never over 5 minutes", () => {
    expect(voiceDuration(4.26)).toBe(4.3);
    expect(voiceDuration(0)).toBe(0.1);
    expect(voiceDuration(300.4)).toBe(MAX_VOICE_SECONDS);
  });

  it("1× → 1.5× → 2× → 1×", () => {
    expect(nextSpeed(1)).toBe(1.5);
    expect(nextSpeed(1.5)).toBe(2);
    expect(nextSpeed(2)).toBe(1);
  });

  it("a press on the bars: from the left in English, from the right in Arabic", () => {
    const rect = { left: 100, width: 200 };
    expect(seekRatio(150, rect, false)).toBe(0.25);
    expect(seekRatio(150, rect, true)).toBe(0.75);
    expect(seekRatio(50, rect, false)).toBe(0);
    expect(seekRatio(400, rect, false)).toBe(1);
  });

  it("a voice message is summed up by its length where its text would be", () => {
    const tr = (_ar: string, en: string) => en;
    const voice = { id: 1, owner_type: "message" as const, owner_id: 1, name: "v.webm", size: 10, mime: "audio/webm", url: "", uploaded_by: 1, at: "", voice: meta(47) };
    expect(messageSummary({ body: "", files: [voice] }, tr)).toBe("Voice message (0:47)");
    expect(messageSummary({ body: "hi", files: [voice] }, tr)).toBe("hi");
    expect(messageSummary({ body: "", files: [{ ...voice, voice: undefined }] }, tr)).toBe("A file");
    expect(voiceOf({ files: [voice] })?.id).toBe(1);
  });
});

describe("the limits and the real type", () => {
  it("audio kinds only, not empty, at most 5 MB and 5 minutes, with 48 bars of 0–100", () => {
    expect(voiceProblem({ name: "v.webm", size: 1000 }, meta())).toBeNull();
    expect(voiceProblem({ name: "v.m4a", size: 1000 }, meta())).toBeNull();
    expect(voiceProblem({ name: "v.ogg", size: 1000 }, meta())).toBeNull();
    expect(voiceProblem({ name: "v.mp3", size: 1000 }, meta())).toBeNull();
    expect(voiceProblem({ name: "v.wav", size: 1000 }, meta())).toBe("type");
    expect(voiceProblem({ name: "v.txt", size: 1000 }, meta())).toBe("type");
    expect(voiceProblem({ name: "v.webm", size: 0 }, meta())).toBe("empty");
    expect(voiceProblem({ name: "v.webm", size: MAX_VOICE_BYTES + 1 }, meta())).toBe("size");
    expect(voiceProblem({ name: "v.webm", size: 1000 }, meta(MAX_VOICE_SECONDS))).toBeNull();
    expect(voiceProblem({ name: "v.webm", size: 1000 }, meta(MAX_VOICE_SECONDS + 0.1))).toBe("duration");
    expect(voiceProblem({ name: "v.webm", size: 1000 }, meta(0))).toBe("duration");
    expect(voiceProblem({ name: "v.webm", size: 1000 }, meta(NaN))).toBe("duration");
    expect(voiceProblem({ name: "v.webm", size: 1000 }, { duration_s: 3, peaks: [1, 2, 3] })).toBe("peaks");
    expect(voiceProblem({ name: "v.webm", size: 1000 }, { duration_s: 3, peaks: Array(48).fill(101) })).toBe("peaks");
    expect(voiceProblem({ name: "v.webm", size: 1000 }, { duration_s: 3, peaks: Array(48).fill(0.5) })).toBe("peaks");
  });

  it("knows a recording by its first bytes, not its name", () => {
    expect(sniffAudio(new Uint8Array(WEBM))).toBe("webm");
    expect(sniffAudio(new TextEncoder().encode("OggS\0\x02"))).toBe("ogg");
    expect(sniffAudio(new Uint8Array(MP4))).toBe("mp4");
    expect(sniffAudio(new TextEncoder().encode("ID3\x04"))).toBe("mp3");
    expect(sniffAudio(new Uint8Array([0xff, 0xfb, 0x90, 0x64]))).toBe("mp3");
    expect(sniffAudio(new Uint8Array([0xff, 0xf1, 0x50, 0x80]))).toBe("aac");
    expect(sniffAudio(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffAudio(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull(); // a PNG
    expect(sniffAudio(new Uint8Array())).toBeNull();
  });
});

describe("sending a voice message on the demo backend", () => {
  it("a message with no text, then its recording with its length and bars; the other person sees it", async () => {
    as(5);
    const m = await chat.send("d-1", { body: "" });
    const a = await files.upload({ type: "message", id: m.id }, recording(), undefined, meta(4.26));
    expect(a).toMatchObject({ mime: "audio/webm", voice: { duration_s: 4.3, peaks } });
    expect(a.url.startsWith("data:audio/webm;base64,")).toBe(true);
    as(2);
    const seen = (await chat.messages("d-1")).at(-1)!;
    expect(seen.body).toBe("");
    expect(voiceOf(seen)?.voice.duration_s).toBe(4.3);
    // The chat list sums it up by its length.
    const tr = (_ar: string, en: string) => en;
    expect(messageSummary((await chat.conversations()).find((c) => c.key === "d-1")!.last_message!, tr)).toBe("Voice message (0:04)");
  });

  it("the stored type comes from the bytes: an MP4 recording named .webm is stored as audio/mp4", async () => {
    as(5);
    const m = await chat.send("d-1", { body: "" });
    expect((await files.upload({ type: "message", id: m.id }, recording("voice.webm", MP4), undefined, meta())).mime).toBe("audio/mp4");
  });

  it("refuses a file that isn't really audio, a wrong length or bars, and a second recording (422)", async () => {
    as(5);
    const m = await chat.send("d-1", { body: "" });
    const owner = { type: "message" as const, id: m.id };
    expect((await fails(files.upload(owner, recording("voice.webm", [0x3c, 0x68, 0x74]), undefined, meta())))?.errors).toHaveProperty("file");
    expect((await fails(files.upload(owner, recording("voice.wav"), undefined, meta())))?.errors).toHaveProperty("file");
    expect((await fails(files.upload(owner, recording(), undefined, meta(301))))?.errors).toHaveProperty("voice");
    expect((await fails(files.upload(owner, recording(), undefined, { duration_s: 3, peaks: [1] })))?.errors).toHaveProperty("voice");
    await files.upload(owner, recording(), undefined, meta());
    expect((await fails(files.upload(owner, recording(), undefined, meta())))?.errors).toHaveProperty("file");
  });

  it("only in a chat, only by the message's writer, and nobody outside the chat (403 / 404 / 422)", async () => {
    as(5);
    const m = await chat.send("d-1", { body: "" });
    as(2);
    expect((await fails(files.upload({ type: "message", id: m.id }, recording(), undefined, meta())))?.status).toBe(403);
    as(6);
    expect((await fails(files.upload({ type: "message", id: m.id }, recording(), undefined, meta())))?.status).toBe(404);
    as(5);
    const task = getDb().tasks.find((t) => t.code === "TSK-109")!;
    expect((await fails(files.upload({ type: "task", id: task.id }, recording(), undefined, meta())))?.errors).toHaveProperty("voice");
  });

  it("an audio file can't be attached as an ordinary file", async () => {
    as(5);
    const m = await chat.send("d-1", { body: "" });
    expect((await fails(files.upload({ type: "message", id: m.id }, recording())))?.errors).toHaveProperty("file");
  });

  it("the CEO rule stays: an employee can't open a private chat with the CEO to send one", async () => {
    as(5);
    expect((await fails(chat.startDirect(1)))?.status).toBe(403);
  });

  it("the demo keeps the audio of the newest 6 only; older ones keep their bubble without the audio", async () => {
    as(5);
    const ids: number[] = [];
    for (let i = 0; i < 8; i++) {
      const m = await chat.send("d-1", { body: "" });
      ids.push((await files.upload({ type: "message", id: m.id }, recording(), undefined, meta())).id);
    }
    const kept = getDb().attachments.filter((a) => a.voice);
    expect(kept).toHaveLength(8);
    expect(kept.filter((a) => a.url).map((a) => a.id)).toEqual(ids.slice(2));
    expect(kept.find((a) => a.id === ids[0])?.voice?.duration_s).toBe(4.2);
  });
});
