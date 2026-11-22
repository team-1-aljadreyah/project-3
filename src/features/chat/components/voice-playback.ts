// What the voice players on a page share: only one plays at a time, and which voice messages this person has listened
// to (kept in this browser only, per person: a small mark for the receiver, not sent to the server).

let playing: HTMLAudioElement | null = null;

/** A player started: the one that was playing pauses. */
export function claimPlayback(audio: HTMLAudioElement) {
  if (playing && playing !== audio && !playing.paused) playing.pause();
  playing = audio;
}

export function releasePlayback(audio: HTMLAudioElement) {
  if (playing === audio) playing = null;
}

const key = (me: number) => `p3.voice.heard.${me}`;

function readHeard(me: number): number[] {
  try {
    const list = JSON.parse(localStorage.getItem(key(me)) ?? "[]");
    return Array.isArray(list) ? list.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export const isHeard = (me: number, id: number) => readHeard(me).includes(id);

/** Remembers that this person listened to it (the newest 500, so the mark list stays small). */
export function markHeard(me: number, id: number) {
  const list = readHeard(me);
  if (list.includes(id)) return;
  try {
    localStorage.setItem(key(me), JSON.stringify([...list, id].slice(-500)));
  } catch {}
}

/** The event a finished player sends to the next voice message in the chat, so it plays by itself (like WhatsApp). */
export const PLAY_NEXT = "voice:play";

/** When one ends: the next voice message in the same list plays if it is right after it and not heard yet. */
export function playNextAfter(root: HTMLElement) {
  const list = root.closest("ol");
  if (!list) return;
  const all = [...list.querySelectorAll<HTMLElement>("[data-voice-note]")];
  const next = all[all.indexOf(root) + 1];
  // Only the very next message: a text in between ends the run.
  const item = root.closest("li");
  if (next && item?.nextElementSibling?.contains(next) && next.dataset.unheard === "true") next.dispatchEvent(new CustomEvent(PLAY_NEXT));
}
