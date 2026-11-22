import { ChevronUp, Lock, Mic, Send, Square, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { MAX_VOICE_SECONDS } from "@/features/attachments";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { IconButton } from "@/shared/ui";
import { clock, spokenDuration } from "../voice";
import type { MicProblem, VoiceRecorder } from "./use-voice-recorder";
import { VoiceNote } from "./voice-note";

/** A press shorter than this is a click (recording goes on until stopped); a longer one is "hold to talk". */
const TAP_MS = 350;
/** How far the finger slides towards the start of the line to cancel, and up to lock (CSS pixels). */
const CANCEL_PX = 90;
const LOCK_PX = 70;

/** The words for each microphone problem, with how to fix it. */
export function micProblemText(problem: MicProblem, tr: (ar: string, en: string) => string) {
  switch (problem) {
    case "denied":
      return tr(
        "لم يُسمح للموقع باستخدام الميكروفون. اسمح به من رمز القفل بجانب عنوان الموقع (على الهاتف: إعدادات الموقع ← الميكروفون ← السماح)، ثم اضغط الميكروفون مرة أخرى.",
        "The site isn't allowed to use the microphone. Allow it from the lock icon beside the site's address (on a phone: site settings → Microphone → Allow), then press the microphone again.",
      );
    case "nomic":
      return tr("لا يوجد ميكروفون في هذا الجهاز. صِل ميكروفوناً أو سماعة فيها ميكروفون، ثم أعد المحاولة.", "No microphone was found on this device. Connect a microphone or a headset with one, then try again.");
    case "busy":
      return tr("الميكروفون مشغول ببرنامج آخر. أغلق ذلك البرنامج ثم أعد المحاولة.", "Another app is using the microphone. Close it, then try again.");
    case "unsupported":
      return tr("هذا المتصفح لا يسجّل الصوت. جرّب نسخة حديثة من Chrome أو Edge أو Safari أو Firefox.", "This browser can't record sound. Try a recent Chrome, Edge, Safari or Firefox.");
    default:
      return tr("تعذّر بدء التسجيل. أعد المحاولة.", "Recording couldn't start. Please try again.");
  }
}

/**
 * The microphone button beside the text box (shown while the box is empty, like WhatsApp). Hold it to talk and let go
 * to hear the recording before sending; slide towards the start of the line to cancel, or up to lock and talk hands
 * free. A click (or Enter / Space) starts recording and the same button then stops it. Both ways work on every device.
 */
export function MicButton({ rec, holding, onHolding, onDrag }: { rec: VoiceRecorder; holding: boolean; onHolding: (on: boolean) => void; onDrag: (px: number) => void }) {
  const { tr, lang } = useFmt();
  const rtl = lang === "ar";
  // When the last press ended: the click the browser sends right after it is part of that press, not a new one.
  const pressEnded = useRef(-Infinity);
  const stopListening = useRef<() => void>(() => {});
  const recording = rec.state === "recording";

  useEffect(() => () => stopListening.current(), []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || rec.state !== "idle") return;
    e.preventDefault();
    const from = { at: performance.now(), x: e.clientX, y: e.clientY };
    onHolding(true);
    onDrag(0);
    rec.start();
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancelled);
      stopListening.current = () => {};
      onHolding(false);
      onDrag(0);
    };
    const move = (ev: PointerEvent) => {
      const towardStart = rtl ? ev.clientX - from.x : from.x - ev.clientX;
      if (towardStart > CANCEL_PX) {
        end();
        rec.cancel();
      } else if (from.y - ev.clientY > LOCK_PX) {
        end(); // locked: keep recording until the stop button
      } else onDrag(Math.max(0, towardStart));
    };
    const up = () => {
      end();
      pressEnded.current = performance.now();
      // A quick press is a click: recording goes on until the button is pressed again. Held: the preview.
      if (performance.now() - from.at >= TAP_MS) rec.stop();
    };
    // The browser took the touch over (a scroll, a call): keep what is being recorded, as if locked.
    const cancelled = () => end();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancelled);
    stopListening.current = end;
  };

  const onClick = () => {
    // The click that ends a press is already handled by the press.
    if (performance.now() - pressEnded.current < 500) return;
    if (rec.state === "idle") rec.start();
    else if (recording && !holding) rec.stop();
  };

  const label = recording ? (holding ? tr("جارٍ التسجيل، أفلت للمعاينة", "Recording, let go to preview") : tr("أوقف التسجيل", "Stop recording")) : tr("سجّل رسالة صوتية", "Record a voice message");

  return (
    <div className="relative shrink-0">
      {recording && holding && (
        // Slide up to lock: the small pill above the button, like WhatsApp's.
        <span aria-hidden="true" className="absolute start-1/2 bottom-full mb-2 flex -translate-x-1/2 flex-col items-center gap-0.5 rounded-full border border-line bg-card px-1.5 py-2 text-muted shadow-md rtl:translate-x-1/2">
          <Lock size={14} />
          <ChevronUp size={14} className="motion-safe:animate-bounce" />
        </span>
      )}
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-busy={rec.state === "asking" || undefined}
        onPointerDown={onPointerDown}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "flex size-10 touch-none items-center justify-center rounded-full transition-[transform,background-color] outline-none select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          recording && holding ? "scale-125 bg-danger text-on-accent shadow-lg" : recording ? "bg-danger text-on-accent hover:opacity-90" : "bg-accent text-on-accent hover:bg-accent-hover",
          rec.state === "asking" && "opacity-70",
        )}
      >
        {recording && !holding ? <Square size={14} fill="currentColor" aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

/** While recording: cancel, the red dot and the time, the live bars, and the "slide to cancel" hint while holding. */
export function RecordingBar({ rec, holding, drag }: { rec: VoiceRecorder; holding: boolean; drag: number }) {
  const { tr, lang } = useFmt();
  const left = MAX_VOICE_SECONDS - rec.elapsed;
  const nearEnd = left <= 30;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <IconButton label={tr("ألغِ التسجيل", "Cancel the recording")} onClick={rec.cancel} className="size-10 bg-transparent text-danger hover:bg-danger-soft">
        <Trash2 size={18} aria-hidden="true" />
      </IconButton>
      <div className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-card px-3">
        <span aria-hidden="true" className="relative flex size-2.5 shrink-0">
          <span className="absolute inset-0 rounded-full bg-danger opacity-60 motion-safe:animate-ping" />
          <span className="relative size-2.5 rounded-full bg-danger" />
        </span>
        <span
          role="timer"
          aria-label={tr(`مدة التسجيل ${spokenDuration(rec.elapsed, "ar")}`, `Recorded ${spokenDuration(rec.elapsed, "en")}`)}
          dir="ltr"
          className={cn("shrink-0 text-sm font-medium tabular-nums", nearEnd ? "text-danger" : "text-text")}
        >
          {clock(rec.elapsed)}
        </span>
        {nearEnd && (
          <span className="shrink-0 text-xs text-danger max-sm:hidden">
            {tr(`يتوقف بعد ${clock(left)}`, `Stops in ${clock(left)}`)}
          </span>
        )}
        {holding ? (
          <span
            className="min-w-0 flex-1 truncate text-center text-xs text-muted transition-transform"
            style={{ transform: `translateX(${(lang === "ar" ? 1 : -1) * Math.min(drag, 90) * 0.6}px)`, opacity: 1 - Math.min(drag, 90) / 140 }}
          >
            <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
              ‹
            </span>{" "}
            {tr("اسحب للإلغاء", "Slide to cancel")}
          </span>
        ) : (
          <LiveBars levels={rec.levels} />
        )}
      </div>
    </div>
  );
}

/** The microphone's level, one bar every tenth of a second, the newest at the end of the line. */
function LiveBars({ levels }: { levels: number[] }) {
  return (
    <span aria-hidden="true" className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden">
      {levels.map((l, i) => (
        <span key={levels.length - i} style={{ height: `${Math.round(3 + l * 19)}px` }} className="w-[2px] shrink-0 rounded-full bg-accent/70" />
      ))}
    </span>
  );
}

/** After recording: hear it, throw it away, or send it. */
export function PreviewBar({ rec, busy, onSend }: { rec: VoiceRecorder; busy: boolean; onSend: () => void }) {
  const { tr } = useFmt();
  const send = useRef<HTMLButtonElement>(null);
  const take = rec.take!;
  // The send button takes the focus, so the keyboard goes on from the button that was pressed.
  useEffect(() => send.current?.focus({ preventScroll: true }), []);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      {take.atLimit && (
        <p role="status" className="text-xs text-muted">
          {tr("بلغ التسجيل 5 دقائق، وهي أطول مدة، فتوقف وحُفظ ما سُجّل.", "The recording reached 5 minutes, the longest allowed, so it stopped and kept what was said.")}
        </p>
      )}
      <div className="flex items-center gap-2">
        <IconButton label={tr("احذف التسجيل", "Delete the recording")} onClick={rec.discard} disabled={busy} className="size-10 bg-transparent text-danger hover:bg-danger-soft">
          <Trash2 size={18} aria-hidden="true" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <VoiceNote src={take.url} duration={take.duration_s} peaks={take.peaks} tone="preview" />
        </div>
        <button
          ref={send}
          type="button"
          onClick={onSend}
          disabled={busy}
          aria-label={tr("أرسل الرسالة الصوتية", "Send the voice message")}
          title={tr("أرسل الرسالة الصوتية", "Send the voice message")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent outline-none hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50"
        >
          <Send size={17} aria-hidden="true" className="rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}
