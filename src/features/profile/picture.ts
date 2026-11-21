// The browser's side of a new picture: read the picked file, then draw the chosen square into a small 256×256 file.
// Drawing it again also drops what the original carried (place, camera, date), and sends 10–60 KB instead of megabytes.
import { PICTURE, sourceSquare, type Crop } from "./rules";
import type { PickedPicture } from "./types";

/** Reads a picked file as a picture. Fails (null) when the browser can't read it: a broken or fake picture. */
export function readPicture(file: Blob): Promise<PickedPicture | null> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        URL.revokeObjectURL(url);
        resolve(null);
      } else resolve({ url, w: image.naturalWidth, h: image.naturalHeight, image });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * The kept square as a 256×256 WebP (a JPEG where the browser can't write WebP), made smaller until it fits the
 * server's limit. `view` is the size of the square on screen that `crop` was measured in.
 */
export async function makeSquare(picked: PickedPicture, crop: Crop, view: number): Promise<Blob> {
  const { side } = PICTURE;
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const { sx, sy, side: from } = sourceSquare(picked, view, crop);
  // A white floor, so a see-through PNG never turns black in a JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, side, side);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(picked.image, sx, sy, from, from, 0, 0, side, side);

  let last: Blob | null = null;
  for (const quality of [0.86, 0.75, 0.6, 0.45]) {
    const webp = await toBlob(canvas, "image/webp", quality);
    // A browser that can't write WebP gives a PNG instead: use a JPEG then.
    last = webp?.type === "image/webp" ? webp : await toBlob(canvas, "image/jpeg", quality);
    if (last && last.size <= PICTURE.maxUploadBytes) return last;
  }
  if (!last) throw new Error("no picture");
  return last;
}
