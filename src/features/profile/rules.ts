// Profile pictures: which files may be picked, what the server accepts, who may remove one, and the square-crop maths.
// The dialog checks the picked file first (a quick message), and the server checks the upload again (the dialog can be
// skipped). docs/backend.md section 18 lists the same rules for the real server.
import type { User } from "@/shared/api/types";
import { isCeo } from "@/shared/lib/access";

export const PICTURE = {
  /** The types a person may pick. Never SVG: a browser can run code inside one. */
  types: ["image/jpeg", "image/png", "image/webp"] as readonly string[],
  /** The biggest file a person may pick (before the browser makes it small). */
  maxPickBytes: 5 * 1024 * 1024,
  /** The biggest upload the server accepts: the browser sends about 10–60 KB. */
  maxUploadBytes: 200 * 1024,
  /** The picture the browser makes and sends: a square of this many pixels. */
  side: 256,
  /** The zoom slider: 1 = the whole short side fits the square. */
  minZoom: 1,
  maxZoom: 3,
};

/** The accept list for <input type="file">, so the picker shows only pictures. */
export const PICTURE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

/**
 * Remove a person's picture: their own, and (THE CEO RULE) the CEO and the system admin may remove anyone's, for a
 * picture that is not appropriate. Setting a picture has no rule: it is always the person's own (`PUT /me/avatar`).
 */
export const canRemovePicture = (actor: Pick<User, "id" | "role">, owner: Pick<User, "id">) =>
  isCeo(actor) || actor.role === "admin" || actor.id === owner.id;

export type PickProblem = "type" | "size" | "empty";

/** Why a picked file can't be used, or null. The words are made by the caller in the right language. */
export function pickProblem(file: { type: string; size: number }): PickProblem | null {
  if (!PICTURE.types.includes(file.type)) return "type";
  if (file.size === 0) return "empty";
  if (file.size > PICTURE.maxPickBytes) return "size";
  return null;
}

export type PictureKind = "image/png" | "image/jpeg" | "image/webp";

/** What a file really is, from its first bytes (a name or a declared type can lie). Null: not a picture we take. */
export function pictureKind(bytes: Uint8Array): PictureKind | null {
  const at = (i: number, ...want: number[]) => want.every((b, k) => bytes[i + k] === b);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  // "RIFF" …size… "WEBP"
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** The server's check of an upload: a real PNG, JPEG or WebP, not empty, at most `maxUploadBytes`. */
export function uploadProblem(bytes: Uint8Array): PickProblem | null {
  if (bytes.length === 0) return "empty";
  if (bytes.length > PICTURE.maxUploadBytes) return "size";
  if (!pictureKind(bytes)) return "type";
  return null;
}

/** Where the picture sits in the square: its zoom, and its top-left corner in the square's pixels (≤ 0). */
export interface Crop {
  zoom: number;
  x: number;
  y: number;
}

/** The picture's scale in a square of `view` pixels: its short side fills the square at zoom 1. */
export const scaleFor = (img: { w: number; h: number }, view: number, zoom: number) => (view / Math.min(img.w, img.h)) * zoom;

/** Keeps the square covered: the picture can't be moved or zoomed out so far that an empty edge shows. */
export function clampCrop(img: { w: number; h: number }, view: number, crop: Crop): Crop {
  const zoom = Math.min(PICTURE.maxZoom, Math.max(PICTURE.minZoom, crop.zoom));
  const s = scaleFor(img, view, zoom);
  const clamp = (v: number, size: number) => Math.min(0, Math.max(view - size, v));
  return { zoom, x: clamp(crop.x, img.w * s), y: clamp(crop.y, img.h * s) };
}

/** The first crop: the whole short side, in the middle. */
export function centredCrop(img: { w: number; h: number }, view: number): Crop {
  const s = scaleFor(img, view, 1);
  return { zoom: 1, x: (view - img.w * s) / 2, y: (view - img.h * s) / 2 };
}

/** A new zoom that keeps the point in the middle of the square where it was. */
export function zoomCrop(img: { w: number; h: number }, view: number, crop: Crop, zoom: number): Crop {
  const before = scaleFor(img, view, crop.zoom);
  const after = scaleFor(img, view, Math.min(PICTURE.maxZoom, Math.max(PICTURE.minZoom, zoom)));
  const cx = (view / 2 - crop.x) / before;
  const cy = (view / 2 - crop.y) / before;
  return clampCrop(img, view, { zoom, x: view / 2 - cx * after, y: view / 2 - cy * after });
}

/** The square of the original picture that is kept, in its own pixels: what the canvas draws into 256×256. */
export function sourceSquare(img: { w: number; h: number }, view: number, crop: Crop) {
  const s = scaleFor(img, view, crop.zoom);
  const side = Math.min(view / s, img.w, img.h);
  const sx = Math.min(img.w - side, Math.max(0, -crop.x / s));
  const sy = Math.min(img.h - side, Math.max(0, -crop.y / s));
  return { sx, sy, side };
}
