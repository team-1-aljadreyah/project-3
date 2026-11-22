// The alert sounds, made in the browser with the Web Audio API (no sound file to download): a soft two-note chime,
// clearer for a notification, quieter and shorter for a chat message.
//
// Browsers play sound only after the person has touched the page (a click, a tap, a key). The sound is "unlocked" on
// the first one; before that a chime is skipped silently (playChime answers false, and the system notification may
// make its own sound instead).

export type ChimeKind = "chat" | "notification";

/** The notes (Hz), when each starts (s), how long it rings (s) and how loud (0–1). */
const CHIMES: Record<ChimeKind, { notes: [number, number][]; ring: number; peak: number }> = {
  // G5 then C6: a clear rising "ding-dong".
  notification: { notes: [[784, 0], [1047, 0.14]], ring: 0.6, peak: 0.14 },
  // E5 then A5, close together and softer: a light "pop" for messages.
  chat: { notes: [[659, 0], [880, 0.08]], ring: 0.32, peak: 0.08 },
};

let ctx: AudioContext | null = null;
let lastAt = 0;

function unlock() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (ctx.state === "running") stopListening();
  } catch {}
}

const EVENTS = ["pointerdown", "keydown", "touchend"] as const;
function stopListening() {
  for (const e of EVENTS) window.removeEventListener(e, unlock, true);
}
if (typeof window !== "undefined" && "AudioContext" in window) {
  for (const e of EVENTS) window.addEventListener(e, unlock, { capture: true, passive: true });
}

/** One bell-like note: a sine with a quiet octave above it, a quick start and a soft fade. */
function note(ac: AudioContext, freq: number, start: number, ring: number, peak: number) {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + ring);
  gain.connect(ac.destination);
  for (const [mult, level] of [
    [1, 1],
    [2, 0.18],
  ] as const) {
    const osc = ac.createOscillator();
    const part = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * mult;
    part.gain.value = level;
    osc.connect(part).connect(gain);
    osc.start(start);
    osc.stop(start + ring + 0.05);
  }
}

/**
 * Plays the chime. False when it couldn't (not unlocked yet, no sound in this browser) or when one played less than a
 * second and a half ago (a burst of messages rings once). `preview`: the settings' "listen" button, always plays.
 */
export function playChime(kind: ChimeKind, preview = false): boolean {
  if (preview) unlock();
  if (!ctx || ctx.state !== "running") return false;
  const now = Date.now();
  if (!preview && now - lastAt < 1500) return true;
  lastAt = now;
  try {
    const c = CHIMES[kind];
    for (const [freq, at] of c.notes) note(ctx, freq, ctx.currentTime + 0.02 + at, c.ring, c.peak);
    return true;
  } catch {
    return false;
  }
}
