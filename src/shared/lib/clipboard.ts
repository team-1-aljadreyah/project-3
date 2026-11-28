// Copying pictures to the clipboard and naming what is pasted from it. The browser parts run only on a click or a
// key press; the naming is pure and tested in Node.

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

/**
 * A pasted file keeps its own name when it has one (a file copied in the file explorer). A screenshot or a picture
 * copied from a page arrives as "image.png", so it gets a name with the time instead: "pasted-20261128-143005.png".
 */
export function pastedName(file: { name: string; type: string }, now = new Date()): string {
  if (file.name && !/^image\.(png|jpe?g|gif|webp)$/i.test(file.name)) return file.name;
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `pasted-${stamp}.${EXT[file.type] ?? "png"}`;
}

/** The files a paste brings, renamed as above (a File keeps its type and contents). */
export function pastedFiles(data: DataTransfer | null, now = new Date()): File[] {
  return [...(data?.files ?? [])].map((f) => (pastedName(f, now) === f.name ? f : new File([f], pastedName(f, now), { type: f.type, lastModified: f.lastModified })));
}

/** True when the key press or event happened in a place where text is typed (so a paste there is the browser's own). */
export const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Puts a picture on the clipboard, ready to paste into the chat or another app. Browsers accept only PNG there, so
 * other kinds are redrawn as PNG first (a GIF is copied as its first frame). The picture is fetched inside the
 * ClipboardItem promise, so the click still counts as the person's own action while it loads.
 */
export async function copyImage(url: string): Promise<void> {
  const png = (async () => {
    const blob = await (await fetch(url)).blob();
    if (blob.type === "image/png") return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("png"))), "image/png"));
  })();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}
