import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_VOICE_SECONDS } from "@/features/attachments";
import { computePeaks, levelOf, pickVoiceFormat, voiceDuration, voiceFileType } from "../voice";

/** Why recording could not start: no permission, no microphone, the microphone is busy, or the browser can't record. */
export type MicProblem = "denied" | "nomic" | "busy" | "unsupported" | "failed";

export interface VoiceTake {
  file: File;
  /** A link to the recording in this browser, for the preview player. */
  url: string;
  duration_s: number;
  peaks: number[];
  /** The recorder stopped by itself at the 5-minute limit. */
  atLimit: boolean;
}

type State = "idle" | "asking" | "recording" | "preview";

/** How often the live level is measured (and a bar added to the live waveform). */
const TICK_MS = 100;

function problemOf(e: unknown): MicProblem {
  const name = e instanceof DOMException || e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "nomic";
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") return "busy";
  return "failed";
}

/**
 * Records a voice message with the browser's own MediaRecorder (no library). `start()` asks for the microphone the
 * first time (the browser shows its question then, never before), records in the best format the browser has, mono and
 * about 32 kbps, and measures the level for the live bars. `stop()` makes the take (a file, its length and its 48 bars)
 * for the preview; `cancel()` throws it away. At 5 minutes it stops by itself and keeps what was recorded.
 */
export function useVoiceRecorder() {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [take, setTake] = useState<VoiceTake>();
  const [problem, setProblem] = useState<MicProblem>();
  const live = useRef<{
    stream: MediaStream;
    recorder: MediaRecorder;
    audio?: AudioContext;
    timer: ReturnType<typeof setInterval>;
    startedAt: number;
    levels: number[];
    keep: boolean;
    atLimit: boolean;
  } | null>(null);
  // The preview's link to the recording, let go when the chat closes.
  const takeUrl = useRef<string | null>(null);
  // A start asked for while the microphone question is open can be cancelled before it answers.
  const attempt = useRef(0);

  const release = useCallback(() => {
    const r = live.current;
    if (!r) return;
    clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    r.audio?.close().catch(() => {});
    live.current = null;
  }, []);

  /** Makes the take from the recorded pieces: its real length and bars from the decoded sound when the browser can. */
  const finish = useCallback(
    async (chunks: Blob[], type: string, levelsSoFar: number[], seconds: number, atLimit: boolean, audio?: AudioContext) => {
      const { mime, ext } = voiceFileType(type);
      const blob = new Blob(chunks, { type: mime });
      let duration = seconds;
      let peaks = computePeaks(levelsSoFar);
      try {
        if (audio && blob.size) {
          const decoded = await audio.decodeAudioData(await blob.arrayBuffer());
          if (Number.isFinite(decoded.duration) && decoded.duration > 0) duration = decoded.duration;
          peaks = computePeaks(decoded.getChannelData(0));
        }
      } catch {
        // Some browsers can't decode what they recorded: the levels measured while recording draw the bars instead.
      }
      const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
      const file = new File([blob], `voice-${stamp}.${ext}`, { type: mime });
      const url = URL.createObjectURL(blob);
      takeUrl.current = url;
      setTake({ file, url, duration_s: voiceDuration(duration), peaks, atLimit });
      setState("preview");
    },
    [],
  );

  const stop = useCallback(() => {
    const r = live.current;
    if (r && r.recorder.state !== "inactive") r.recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (live.current) return true;
    setProblem(undefined);
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setProblem("unsupported");
      return false;
    }
    const mine = ++attempt.current;
    setState("asking");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      if (mine === attempt.current) {
        setProblem(problemOf(e));
        setState("idle");
      }
      return false;
    }
    // Cancelled while the browser was asking: let the microphone go at once.
    if (mine !== attempt.current) {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }
    const type = pickVoiceFormat((t) => MediaRecorder.isTypeSupported(t));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32_000 });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        setProblem("unsupported");
        setState("idle");
        return false;
      }
    }
    // The live level: an analyser on the microphone (Web Audio). Without it the recording still works, with flat bars.
    let audio: AudioContext | undefined;
    let analyser: AnalyserNode | undefined;
    try {
      audio = new AudioContext();
      analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      audio.createMediaStreamSource(stream).connect(analyser);
    } catch {
      audio = undefined;
    }
    const buffer = new Uint8Array(analyser?.fftSize ?? 0);
    const chunks: Blob[] = [];
    const startedAt = performance.now();
    const timer = setInterval(() => {
      const r = live.current;
      if (!r) return;
      const seconds = (performance.now() - r.startedAt) / 1000;
      if (analyser) analyser.getByteTimeDomainData(buffer);
      r.levels.push(analyser ? levelOf(buffer) : 0.2);
      setElapsed(Math.min(seconds, MAX_VOICE_SECONDS));
      setLevels(r.levels.slice(-64));
      // The limit: stop and keep what was said (the preview says why it stopped).
      if (seconds >= MAX_VOICE_SECONDS) {
        r.atLimit = true;
        stop();
      }
    }, TICK_MS);
    live.current = { stream, recorder, audio, timer, startedAt, levels: [], keep: true, atLimit: false };
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const r = live.current;
      if (!r) return;
      const seconds = Math.min((performance.now() - r.startedAt) / 1000, MAX_VOICE_SECONDS);
      const { keep, levels: measured, atLimit } = r;
      clearInterval(r.timer);
      r.stream.getTracks().forEach((t) => t.stop());
      live.current = null;
      if (!keep) {
        audio?.close().catch(() => {});
        return;
      }
      finish(chunks, recorder.mimeType || type, measured, seconds, atLimit, audio).finally(() => audio?.close().catch(() => {}));
    };
    recorder.start(1000);
    setElapsed(0);
    setLevels([]);
    setState("recording");
    return true;
  }, [finish, stop]);

  /** Throws the recording away (while recording, or while the browser is still asking). */
  const cancel = useCallback(() => {
    attempt.current++;
    const r = live.current;
    if (r) {
      r.keep = false;
      if (r.recorder.state !== "inactive") r.recorder.stop();
      else release();
    }
    setState("idle");
    setElapsed(0);
    setLevels([]);
  }, [release]);

  /** Forgets the take after it was sent or thrown away. */
  const discard = useCallback(() => {
    setTake((t) => {
      if (t) URL.revokeObjectURL(t.url);
      takeUrl.current = null;
      return undefined;
    });
    setState("idle");
    setElapsed(0);
    setLevels([]);
  }, []);

  // Leaving the chat while recording lets the microphone go.
  useEffect(
    () => () => {
      attempt.current++;
      if (takeUrl.current) URL.revokeObjectURL(takeUrl.current);
      const r = live.current;
      if (r) {
        r.keep = false;
        try {
          r.recorder.stop();
        } catch {}
        release();
      }
    },
    [release],
  );

  return { state, elapsed, levels, take, problem, clearProblem: () => setProblem(undefined), start, stop, cancel, discard };
}

export type VoiceRecorder = ReturnType<typeof useVoiceRecorder>;
