import { ChevronLeft, ChevronRight, Download, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { sizeText } from "../rules";

/** One picture to show: where it is, its name and size, and an optional line under it (who sent it, when). */
export interface ViewerImage {
  id: number;
  url: string;
  name: string;
  size: number;
  caption?: string;
}

const btn =
  "flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-30";

/**
 * Pictures open here, full screen on a dark backdrop, instead of downloading: the picture as large as fits (press it,
 * or the zoom button, to see it at its real size and move around), its name, size and caption, a download button, and
 * the previous / next picture of the same set (the arrows on the keyboard too, mirrored in Arabic). On the browser's own
 * <dialog>, so the keyboard stays inside and Escape closes it; the focus goes back to the picture that opened it.
 */
export function ImageViewer({ images, index, onIndex, onClose }: { images: ViewerImage[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const { tr, num, lang } = useFmt();
  const ref = useRef<HTMLDialogElement>(null);
  // Which picture is zoomed in: another picture starts fitted to the screen.
  const [zoomed, setZoomed] = useState<number | null>(null);
  const open = index !== null && !!images[index];
  const img = open ? images[index] : null;
  const zoom = !!img && zoomed === img.id;
  const toggleZoom = () => setZoomed(zoom || !img ? null : img.id);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const go = (step: number) => {
    if (index === null) return;
    const next = index + step;
    if (next >= 0 && next < images.length) onIndex(next);
  };
  // "Next" is to the left in Arabic, like turning a page.
  const rtl = lang === "ar";
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(rtl ? -1 : 1);
    else if (e.key === "ArrowLeft") go(rtl ? 1 : -1);
    else return;
    e.preventDefault();
  };

  return (
    // The backdrop click is mouse-only on purpose: Escape closes it on a keyboard.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-label={img ? tr(`صورة: ${img.name}`, `Picture: ${img.name}`) : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={onKey}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#0b0609]/95 p-0 text-white backdrop:bg-black/60 open:flex open:flex-col"
    >
      {img && (
        <>
          <header className="flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
            <button type="button" onClick={onClose} aria-label={tr("أغلق", "Close")} className={btn}>
              <X size={20} aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                <bdi>{img.name}</bdi>
              </p>
              <p className="truncate text-xs text-white/70">
                {sizeText(img.size, lang)}
                {img.caption ? ` · ${img.caption}` : ""}
                {images.length > 1 ? ` · ${tr(`${num(index! + 1)} من ${num(images.length)}`, `${index! + 1} of ${images.length}`)}` : ""}
              </p>
            </div>
            <button type="button" onClick={toggleZoom} aria-pressed={zoom} aria-label={zoom ? tr("بحجم الشاشة", "Fit to screen") : tr("كبّر", "Zoom in")} className={btn}>
              {zoom ? <ZoomOut size={19} aria-hidden="true" /> : <ZoomIn size={19} aria-hidden="true" />}
            </button>
            <a href={img.url} download={img.name} aria-label={tr("نزّل الصورة", "Download the picture")} className={btn}>
              <Download size={19} aria-hidden="true" />
            </a>
          </header>

          {/* The picture: fitted, or at its real size and scrollable. Pressing it switches between the two. */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            className={cn("relative flex min-h-0 flex-1", zoom ? "overflow-auto" : "items-center justify-center overflow-hidden p-4")}
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            {/* A user's file (a data: link in the demo, a short-lived link later): next/image can't optimise those. */}
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
            <img
              key={img.id}
              src={img.url}
              alt={img.name}
              onClick={toggleZoom}
              className={cn("viewer-in select-none", zoom ? "m-auto max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in rounded-md object-contain shadow-2xl")}
            />
          </div>

          {images.length > 1 && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-3">
              <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label={tr("الصورة السابقة", "Previous picture")} className={cn(btn, "pointer-events-auto size-12")}>
                <ChevronRight size={24} aria-hidden="true" className="ltr:rotate-180" />
              </button>
              <button type="button" onClick={() => go(1)} disabled={index === images.length - 1} aria-label={tr("الصورة التالية", "Next picture")} className={cn(btn, "pointer-events-auto size-12")}>
                <ChevronLeft size={24} aria-hidden="true" className="ltr:rotate-180" />
              </button>
            </div>
          )}
        </>
      )}
    </dialog>
  );
}
