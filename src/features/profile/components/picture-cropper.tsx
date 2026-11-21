import { useRef } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { clampCrop, PICTURE, scaleFor, zoomCrop, type Crop } from "../rules";
import type { PickedPicture } from "../types";

/** The size of the square on screen, in pixels: it fits a 320-pixel phone inside the window. */
export const CROP_VIEW = 240;

/** The picked picture placed as `crop` says, in a square of `size` pixels (the same maths at any size). */
function Placed({ picked, crop, size }: { picked: PickedPicture; crop: Crop; size: number }) {
  const f = size / CROP_VIEW;
  const s = scaleFor(picked, CROP_VIEW, crop.zoom) * f;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={picked.url}
      alt=""
      draggable={false}
      className="pointer-events-none absolute top-0 left-0 max-w-none select-none"
      style={{ width: picked.w * s, height: picked.h * s, transform: `translate(${crop.x * f}px, ${crop.y * f}px)` }}
    />
  );
}

/**
 * The square crop: drag the picture (mouse, finger or the arrow keys) and zoom it with the slider; the circle shows
 * what the round avatar keeps. Beside it, the avatar at the sizes people will see.
 */
export function PictureCropper({ picked, crop, onCrop }: { picked: PickedPicture; crop: Crop; onCrop: (c: Crop) => void }) {
  const { tr, num } = useFmt();
  const drag = useRef<{ id: number; x: number; y: number; from: Crop } | null>(null);
  const move = (dx: number, dy: number, from = crop) => onCrop(clampCrop(picked, CROP_VIEW, { ...from, x: from.x + dx, y: from.y + dy }));
  const zoomTo = (zoom: number) => onCrop(zoomCrop(picked, CROP_VIEW, crop, zoom));

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 32 : 8;
    // The arrows move the picture the way they point (on screen, the same in Arabic and English).
    const keys: Record<string, () => void> = {
      ArrowLeft: () => move(-step, 0),
      ArrowRight: () => move(step, 0),
      ArrowUp: () => move(0, -step),
      ArrowDown: () => move(0, step),
      "+": () => zoomTo(crop.zoom + 0.1),
      "=": () => zoomTo(crop.zoom + 0.1),
      "-": () => zoomTo(crop.zoom - 0.1),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex flex-col items-center gap-3">
        {/* A two-way drag area has no single ARIA widget: it is an "application" area that takes the arrow keys itself. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          role="application"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          aria-roledescription={tr("منطقة قص الصورة", "picture crop area")}
          aria-label={tr("موضع الصورة: اسحبها، أو حرّكها بالأسهم، وكبّرها بـ + و -", "Picture position: drag it, or move it with the arrow keys; zoom with + and -")}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: crop };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d?.id === e.pointerId) move(e.clientX - d.x, e.clientY - d.y, d.from);
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          className="relative cursor-grab touch-none overflow-hidden rounded-2xl bg-card-2 select-none active:cursor-grabbing"
          style={{ width: CROP_VIEW, height: CROP_VIEW }}
        >
          <Placed picked={picked} crop={crop} size={CROP_VIEW} />
          {/* The round avatar keeps the circle; the corners are dimmed (they are in the square file, but never shown round). */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_200px_rgb(20_8_14/0.5)] ring-2 ring-white/85" />
        </div>
        <div className="flex w-full items-center gap-3" style={{ maxWidth: CROP_VIEW }}>
          <label htmlFor="picture-zoom" className="shrink-0 text-sm text-muted">
            {tr("التكبير", "Zoom")}
          </label>
          <input
            id="picture-zoom"
            type="range"
            min={PICTURE.minZoom}
            max={PICTURE.maxZoom}
            step={0.01}
            value={crop.zoom}
            aria-valuetext={`${num(Math.round(crop.zoom * 100))}%`}
            onChange={(e) => zoomTo(Number(e.target.value))}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-(--accent)"
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 sm:items-start sm:pt-2">
        <p className="text-sm font-medium">{tr("هكذا ستظهر", "How it will look")}</p>
        <div className="flex items-end gap-3" aria-hidden="true">
          {[56, 40, 24].map((size) => (
            <span key={size} className="relative inline-block shrink-0 overflow-hidden rounded-full border border-line bg-card-2" style={{ width: size, height: size }}>
              <Placed picked={picked} crop={crop} size={size} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
