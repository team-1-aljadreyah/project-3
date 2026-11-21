// Profile pictures: the picking rules, the server's check of an upload, the square-crop maths, and the demo backend as
// different people (set, replace, remove, someone else's picture, the limits). docs/backend.md section 18.
import { beforeEach, describe, expect, it } from "vitest";
import {
  canRemovePicture,
  centredCrop,
  clampCrop,
  PICTURE,
  pickProblem,
  pictureKind,
  sourceSquare,
  uploadProblem,
  zoomCrop,
} from "@/features/profile/rules";
import { ApiError } from "@/shared/api/errors";
import type { Role } from "@/shared/api/types";

// The demo backend reads the session from localStorage: a small in-memory one for Node.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { profileMock: api } = await import("@/features/profile/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader, 5–7 employees, 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const stored = (id: number) => getDb().users.find((u) => u.id === id)!;

/** A file that starts like a real picture of that kind (the server reads the first bytes, not the name). */
const HEAD = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff, 0xe0],
  webp: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
};
const picture = (kind: keyof typeof HEAD, size = 2048, type = `image/${kind}`) => {
  const bytes = new Uint8Array(size);
  bytes.set(HEAD[kind]);
  return new Blob([bytes], { type });
};

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("picking a picture", () => {
  it("takes JPEG, PNG and WebP up to 5 MB; never SVG, GIF or other files; never empty", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) expect(pickProblem({ type, size: 1000 })).toBeNull();
    expect(pickProblem({ type: "image/svg+xml", size: 1000 })).toBe("type");
    expect(pickProblem({ type: "image/gif", size: 1000 })).toBe("type");
    expect(pickProblem({ type: "application/pdf", size: 1000 })).toBe("type");
    expect(pickProblem({ type: "image/png", size: 0 })).toBe("empty");
    expect(pickProblem({ type: "image/png", size: PICTURE.maxPickBytes })).toBeNull();
    expect(pickProblem({ type: "image/png", size: PICTURE.maxPickBytes + 1 })).toBe("size");
  });

  it("the server knows a picture by its first bytes, and refuses one over 200 KB", async () => {
    const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
    expect(pictureKind(await bytes(picture("png")))).toBe("image/png");
    expect(pictureKind(await bytes(picture("jpeg")))).toBe("image/jpeg");
    expect(pictureKind(await bytes(picture("webp")))).toBe("image/webp");
    expect(pictureKind(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(uploadProblem(new Uint8Array())).toBe("empty");
    expect(uploadProblem(await bytes(picture("png", PICTURE.maxUploadBytes)))).toBeNull();
    expect(uploadProblem(await bytes(picture("png", PICTURE.maxUploadBytes + 1)))).toBe("size");
    expect(uploadProblem(new TextEncoder().encode("not a picture at all"))).toBe("type");
  });
});

describe("the square crop", () => {
  const wide = { w: 400, h: 200 };

  it("starts with the whole short side, in the middle", () => {
    const crop = centredCrop(wide, 240);
    expect(crop).toEqual({ zoom: 1, x: -120, y: 0 });
    expect(sourceSquare(wide, 240, crop)).toEqual({ sx: 100, sy: 0, side: 200 });
  });

  it("never shows an empty edge: moving and zoom stay inside the picture", () => {
    expect(clampCrop(wide, 240, { zoom: 1, x: 50, y: 30 })).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(clampCrop(wide, 240, { zoom: 1, x: -999, y: -999 })).toEqual({ zoom: 1, x: -240, y: 0 });
    expect(clampCrop(wide, 240, { zoom: 9, x: 0, y: 0 }).zoom).toBe(PICTURE.maxZoom);
    expect(clampCrop(wide, 240, { zoom: 0.2, x: 0, y: 0 }).zoom).toBe(PICTURE.minZoom);
  });

  it("zooming keeps the middle where it was, and keeps a smaller square of the picture", () => {
    const crop = zoomCrop(wide, 240, centredCrop(wide, 240), 2);
    const square = sourceSquare(wide, 240, crop);
    expect(square.side).toBe(100);
    expect(square.sx + square.side / 2).toBeCloseTo(200);
    expect(square.sy + square.side / 2).toBeCloseTo(100);
  });
});

describe("who may remove a picture", () => {
  const person = (id: number, role: Role) => ({ id, role });
  it("your own; the CEO and the admin anyone's; nobody else someone else's", () => {
    expect(canRemovePicture(person(5, "employee"), { id: 5 })).toBe(true);
    expect(canRemovePicture(person(5, "employee"), { id: 6 })).toBe(false);
    expect(canRemovePicture(person(2, "pm"), { id: 5 })).toBe(false);
    expect(canRemovePicture(person(4, "lead"), { id: 5 })).toBe(false);
    expect(canRemovePicture(person(3, "monitor"), { id: 5 })).toBe(false);
    expect(canRemovePicture(person(1, "ceo"), { id: 5 })).toBe(true);
    expect(canRemovePicture(person(8, "admin"), { id: 5 })).toBe(true);
  });
});

describe("the demo backend", () => {
  it("every job sets, replaces and removes their own picture", async () => {
    for (const id of [1, 2, 3, 4, 5, 8]) {
      as(id);
      const set = await api.setMyPicture(picture("webp"));
      expect(set.id).toBe(id);
      expect(set.avatar_url).toMatch(/^data:image\/webp;base64,/);
      expect(stored(id).avatar_url).toBe(set.avatar_url);

      const replaced = await api.setMyPicture(picture("jpeg", 3000));
      expect(replaced.avatar_url).toMatch(/^data:image\/jpeg;base64,/);
      expect(replaced.avatar_url).not.toBe(set.avatar_url);

      const removed = await api.removeMyPicture();
      expect(removed.avatar_url).toBeUndefined();
      expect(stored(id).avatar_url).toBeUndefined();
    }
  });

  it("the type comes from the content, not from what the browser said", async () => {
    as(5);
    const me = await api.setMyPicture(picture("png", 2048, "image/webp"));
    expect(me.avatar_url).toMatch(/^data:image\/png;base64,/);
  });

  it("refuses a picture over 200 KB, a file that is not a picture, and an empty one (422 on file)", async () => {
    as(5);
    const big = await fails(api.setMyPicture(picture("png", PICTURE.maxUploadBytes + 1)));
    expect(big?.status).toBe(422);
    expect(big?.errors).toHaveProperty("file");
    const svg = await fails(api.setMyPicture(new Blob(["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"], { type: "image/png" })));
    expect(svg?.status).toBe(422);
    expect(svg?.errors).toHaveProperty("file");
    expect((await fails(api.setMyPicture(new Blob([], { type: "image/png" }))))?.status).toBe(422);
    expect(stored(5).avatar_url).toBeUndefined();
  });

  it("only yourself: someone else's picture can't be removed (403), and nobody signed in gets 401", async () => {
    as(6);
    await api.setMyPicture(picture("png"));
    for (const id of [5, 2, 4, 3]) {
      as(id);
      expect((await fails(api.removePictureOf(6)))?.status).toBe(403);
    }
    expect(stored(6).avatar_url).toBeDefined();
    store.clear();
    expect((await fails(api.setMyPicture(picture("png"))))?.status).toBe(401);
    expect((await fails(api.removeMyPicture()))?.status).toBe(401);
  });

  it("the admin and the CEO remove someone's picture; the audit log records it", async () => {
    for (const actor of [8, 1]) {
      as(6);
      await api.setMyPicture(picture("png"));
      as(actor);
      const user = await api.removePictureOf(6);
      expect(user.avatar_url).toBeUndefined();
      expect(getDb().audit.at(-1)).toMatchObject({ actor_id: actor, action: "picture_removed", target: { type: "user", id: 6 } });
    }
    as(8);
    expect((await fails(api.removePictureOf(999)))?.status).toBe(404);
  });

  it("read-only mode still lets a person change their own picture (their own bookkeeping)", async () => {
    getDb().advanced = { read_only: { on: true, message: "" } };
    as(5);
    expect((await api.setMyPicture(picture("png"))).avatar_url).toBeDefined();
  });
});
