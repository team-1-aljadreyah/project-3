import { Clock3, Smile } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { IconButton } from "@/shared/ui";
import { EMOJI_GROUPS, readRecent, saveRecent, withRecent } from "../emoji";

/**
 * The emoji button of the message box. It opens a panel above the box: the emoji used last on this device, then the
 * groups (faces, hands, hearts, work, nature, places), one tab each. A press puts the emoji where the cursor is and
 * keeps the panel open, so several can be added; Escape, the button again, or a press outside closes it.
 */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const { tr, lang } = useFmt();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [group, setGroup] = useState<string>("faces");
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLDivElement>(null);
  const id = useId();

  const toggle = () => {
    if (!open) {
      const r = readRecent();
      setRecent(r);
      setGroup(r.length ? "recent" : "faces");
    }
    setOpen(!open);
  };

  // A press outside the panel (and its button) closes it, and so does Escape (the focus goes back to the button).
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      button.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const pick = (e: string) => {
    const next = withRecent(recent, e);
    saveRecent(next);
    setRecent(next);
    onPick(e);
  };

  const groups = [
    ...(recent.length ? [{ id: "recent", icon: "", ar: "المستخدمة مؤخراً", en: "Recently used", emoji: recent }] : []),
    ...EMOJI_GROUPS,
  ];
  const shown = groups.find((g) => g.id === group) ?? groups[0];

  return (
    // The panel is placed against the message row (the nearest positioned box), so it fits on a phone too.
    <div ref={button} className="shrink-0">
      <IconButton label={tr("أضف رمزاً تعبيرياً", "Add an emoji")} aria-expanded={open} aria-controls={open ? id : undefined} onClick={toggle} className={cn("size-10 bg-transparent", open && "bg-chip text-accent")}>
        <Smile size={19} aria-hidden="true" />
      </IconButton>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={tr("الرموز التعبيرية", "Emoji")}
          className="absolute start-0 bottom-full z-20 mb-2 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-card shadow-xl"
        >
          <div role="tablist" aria-label={tr("مجموعات الرموز", "Emoji groups")} className="flex gap-0.5 border-b border-line bg-card-2 px-1.5 pt-1.5">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={g.id === shown.id}
                aria-label={lang === "en" ? g.en : g.ar}
                title={lang === "en" ? g.en : g.ar}
                onClick={() => setGroup(g.id)}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center rounded-t-lg border-b-2 text-lg transition-colors",
                  g.id === shown.id ? "border-accent bg-card" : "border-transparent opacity-70 hover:bg-card hover:opacity-100",
                )}
              >
                {g.id === "recent" ? <Clock3 size={16} aria-hidden="true" className="text-muted" /> : <span aria-hidden="true">{g.icon}</span>}
              </button>
            ))}
          </div>
          <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted">{lang === "en" ? shown.en : shown.ar}</p>
          <div role="tabpanel" aria-label={lang === "en" ? shown.en : shown.ar} className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto px-2 pb-2">
            {shown.emoji.map((e) => (
              <button key={e} type="button" onClick={() => pick(e)} aria-label={e} className="flex aspect-square items-center justify-center rounded-lg text-2xl leading-none transition-transform hover:scale-110 hover:bg-chip focus-visible:bg-chip">
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
