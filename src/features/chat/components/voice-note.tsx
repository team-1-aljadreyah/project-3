import { Download, EllipsisVertical, Pause, Play } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { sizeText } from "@/features/attachments";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { clock, nextSpeed, seekRatio, spokenDuration } from "../voice";
import { claimPlayback, isHeard, markHeard, PLAY_NEXT, playNextAfter, releasePlayback } from "./voice-playback";

type Tone = "mine" | "theirs" | "preview";

/**
 * A voice message's player, like a voice note in WhatsApp or Telegram: the play button, the bars (drawn from the
 * message's 48 peaks, so nothing loads before playing) filling as it plays, the time, and the speed (1×, 1.5×, 2×).
 * The bars are a slider: press or drag on them, or use the arrow keys, Home and End. The audio downloads only when
 * played (`preload="none"`), one plays at a time on the page, and the next voice message right after it plays by
 * itself if it hasn't been heard. `heardBy`: the receiver, whose copy shows a dot until they listen (in this browser).
 */
export function VoiceNote({
  src,
  duration,
  peaks,
  tone,
  heardBy,
  id,
  download,
}: {
  src: string;
  duration: number;
  peaks: number[];
  tone: Tone;
  heardBy?: number;
  id?: number;
  download?: { name: string; size: number };
}) {
  const { tr, lang } = useFmt();
  const rtl = lang === "ar";
  const audio = useRef<HTMLAudioElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const bars = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  const [heard, setHeard] = useState(() => heardBy === undefined || id === undefined || isHeard(heardBy, id));
  const total = duration > 0 ? duration : 0;
  const progress = total ? Math.min(1, time / total) : 0;
  const missing = !src;

  // While playing, follow the sound every frame (the audio's own event comes only 4 times a second).
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const step = () => {
      const a = audio.current;
      if (a) setTime(Math.min(a.currentTime, total || a.currentTime));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, total]);

  const toggle = () => {
    const a = audio.current;
    if (!a || missing) return;
    if (!a.paused) {
      a.pause();
      return;
    }
    claimPlayback(a);
    a.playbackRate = rate;
    setLoading(true);
    setFailed(false);
    a.play().catch((e: unknown) => {
      // A pause before the sound arrived isn't a failure.
      if (!(e instanceof DOMException && e.name === "AbortError")) setFailed(true);
      setLoading(false);
    });
  };

  // The voice message before this one ended: play this one.
  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onNext = () => toggleRef.current();
    el.addEventListener(PLAY_NEXT, onNext);
    return () => el.removeEventListener(PLAY_NEXT, onNext);
  }, []);

  const seek = (seconds: number) => {
    const t = Math.min(total, Math.max(0, seconds));
    setTime(t);
    const a = audio.current;
    // Before the audio has loaded, keep the place and go there once it has.
    if (a && a.readyState >= 1) a.currentTime = t;
    else pending.current = t;
  };

  const seekAt = (x: number) => {
    const rect = bars.current?.getBoundingClientRect();
    if (rect) seek(seekRatio(x, rect, rtl) * total);
  };

  const onKey = (e: React.KeyboardEvent) => {
    // Forward is towards the end of the line: left in Arabic, right in English. Up always goes forward.
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    const moves: Record<string, number> = { [forward]: 5, [back]: -5, ArrowUp: 5, ArrowDown: -5, PageUp: total / 10, PageDown: -total / 10 };
    if (e.key in moves) seek(time + moves[e.key]);
    else if (e.key === "Home") seek(0);
    else if (e.key === "End") seek(total);
    else if (e.key === " " || e.key === "Enter") toggle();
    else return;
    e.preventDefault();
  };

  const speed = () => {
    const next = nextSpeed(rate);
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const spokenTotal = spokenDuration(total, lang);
  const started = playing || time > 0;
  const unheard = !heard && !missing;

  return (
    <div
      ref={root}
      role="group"
      aria-label={tr(`رسالة صوتية، ${spokenTotal}`, `Voice message, ${spokenTotal}`)}
      data-voice-note=""
      data-unheard={unheard ? "true" : "false"}
      className={cn(
        "flex w-full max-w-[19rem] items-center gap-2.5 rounded-2xl py-2 ps-2 pe-1.5",
        tone === "mine" && "rounded-ss-md bg-accent-soft",
        tone === "theirs" && "rounded-ss-md border border-line bg-card",
        tone === "preview" && "max-w-none bg-card-2",
      )}
    >
      {/* A recorded voice has no written version to caption; the length and the controls are read out instead. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audio}
        src={src || undefined}
        preload="none"
        onLoadedMetadata={() => {
          if (pending.current !== null && audio.current) audio.current.currentTime = pending.current;
          pending.current = null;
        }}
        onPlaying={() => setLoading(false)}
        onPlay={() => {
          setPlaying(true);
          if (heardBy !== undefined && id !== undefined) {
            markHeard(heardBy, id);
            setHeard(true);
          }
        }}
        onPause={() => {
          setPlaying(false);
          setLoading(false);
        }}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
          if (audio.current) audio.current.currentTime = 0;
          releasePlayback(audio.current!);
          if (root.current) playNextAfter(root.current);
        }}
        onError={() => {
          if (!src) return;
          setFailed(true);
          setLoading(false);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={missing}
        aria-label={playing ? tr("إيقاف مؤقت", "Pause") : tr(`شغّل الرسالة الصوتية، ${spokenTotal}`, `Play the voice message, ${spokenTotal}`)}
        className={cn(
          "relative flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-transform outline-none hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-95 disabled:opacity-40",
        )}
      >
        {playing ? <Pause size={17} fill="currentColor" aria-hidden="true" /> : <Play size={17} fill="currentColor" aria-hidden="true" className="ms-0.5" />}
        {loading && <span aria-hidden="true" className="absolute -inset-1 rounded-full border-2 border-accent border-t-transparent motion-safe:animate-spin" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          ref={bars}
          role="slider"
          tabIndex={missing ? -1 : 0}
          aria-label={tr("موضع التشغيل", "Playback position")}
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={tr(`${spokenDuration(time, "ar")} من ${spokenTotal}`, `${spokenDuration(time, "en")} of ${spokenTotal}`)}
          aria-disabled={missing || undefined}
          onKeyDown={missing ? undefined : onKey}
          onPointerDown={(e) => {
            if (missing) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekAt(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) seekAt(e.clientX);
          }}
          className="relative flex h-7 cursor-pointer touch-none items-center gap-[2px] rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          {(peaks.length ? peaks : Array.from({ length: 48 }, () => 0)).map((p, i, all) => (
            <span
              key={i}
              aria-hidden="true"
              style={{ height: `${Math.round(3 + (Math.min(100, Math.max(0, p)) / 100) * 21)}px` }}
              className={cn("min-w-0 flex-1 rounded-full transition-colors", (i + 0.5) / all.length <= progress ? "bg-accent" : tone === "mine" ? "bg-accent/30" : "bg-line-strong/70")}
            />
          ))}
          {/* The knob at the place being played, like a voice note's dot. */}
          <span
            aria-hidden="true"
            style={{ insetInlineStart: `calc(${progress * 100}% - 6px)` }}
            className={cn("pointer-events-none absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-accent shadow-sm ring-2", tone === "mine" ? "ring-accent-soft" : "ring-card")}
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] leading-4 text-muted">
          <span dir="ltr" className="tabular-nums">
            {started ? `${clock(time)} / ${clock(total)}` : clock(total)}
          </span>
          {unheard && (
            <span className="flex items-center gap-1 text-accent-ink">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              <span className="sr-only">{tr("لم تستمع إليها بعد", "Not listened to yet")}</span>
            </span>
          )}
          {missing && <span>{tr("لم يعد الصوت محفوظاً في النسخة التجريبية", "The demo no longer keeps this audio")}</span>}
          {failed && (
            <span role="status" className="text-danger">
              {tr("تعذّر التشغيل", "Couldn't play")}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={speed}
        aria-label={tr(`سرعة التشغيل ${rate}×، اضغط للتغيير`, `Playback speed ${rate}×, press to change`)}
        className="h-6 shrink-0 self-start rounded-full bg-text/8 px-2 text-[11px] font-semibold text-text tabular-nums outline-none hover:bg-text/15 focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span dir="ltr">{rate}×</span>
      </button>

      {download && src && <DownloadMenu src={src} name={download.name} size={download.size} />}
    </div>
  );
}

/** The small menu beside a voice message: download the recording (its size beside it). */
function DownloadMenu({ src, name, size }: { src: string; name: string; size: number }) {
  const { tr, lang } = useFmt();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const box = useRef<HTMLDivElement>(null);
  const item = useRef<HTMLAnchorElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const closeOnEscape = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape" || !open) return;
    e.stopPropagation();
    setOpen(false);
    button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    item.current?.focus();
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0 self-start">
      <button
        ref={button}
        type="button"
        onKeyDown={closeOnEscape}
        aria-label={tr("خيارات الرسالة الصوتية", "Voice message options")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex size-6 items-center justify-center rounded-full text-muted outline-none hover:bg-text/10 hover:text-text focus-visible:ring-2 focus-visible:ring-accent"
      >
        <EllipsisVertical size={15} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} role="menu" className="absolute end-0 top-full z-20 mt-1 w-max min-w-52 rounded-xl border border-line bg-card p-1 shadow-lg">
          <a
            ref={item}
            role="menuitem"
            href={src}
            download={name}
            onKeyDown={closeOnEscape}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none hover:bg-chip focus-visible:bg-chip"
          >
            <Download size={15} aria-hidden="true" className="text-muted" />
            <span className="flex-1 whitespace-nowrap">{tr("تنزيل التسجيل", "Download the recording")}</span>
            <span className="text-xs text-faint">{sizeText(size, lang)}</span>
          </a>
        </div>
      )}
    </div>
  );
}
