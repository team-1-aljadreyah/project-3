// The demo backend for profile pictures, with the rules the real server must keep (docs/backend.md, section 18). Only
// the demo build loads it. The demo keeps the picture inside the browser's storage as a "data:" link; the real server
// keeps the file in its file storage and answers its address.
import { audit } from "@/mock/audit";
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, passwordMin, wait } from "@/mock/helpers";
import { DEMO_PASSWORD } from "@/mock/seed";
import { passwordProblem } from "@/shared/lib/password";
import type { ProfileApi } from "./api";
import { canRemovePicture, PICTURE, pictureKind, uploadProblem } from "./rules";

/** The bytes as base64 text, in pieces (a long picture would be too many arguments at once). */
function base64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

/** The stored person (not a copy), by id. */
const stored = (id: number) => getDb().users.find((u) => u.id === id);

export const profileMock: ProfileApi = {
  async changeMyPassword(current, password) {
    const user = currentUser();
    const db = getDb();
    // The current one must be right (the demo keeps a password per account; others use the demo password).
    if (current !== (db.passwords?.[user.id] ?? DEMO_PASSWORD)) return invalid("current_password", "كلمة المرور الحالية غير صحيحة.", "The current password is wrong.");
    const problem = passwordProblem(password ?? "", passwordMin());
    if (problem) return invalid("password", problem.ar, problem.en);
    if (password === current) return invalid("password", "اختر كلمة مرور غير الحالية.", "Choose a password other than the current one.");
    (db.passwords ??= {})[user.id] = password;
    // The log says it changed, never the password.
    audit(user.id, "user_changed", { type: "user", id: user.id, label: user.name }, [{ field: "password" }]);
    commit();
    return wait(undefined);
  },

  async setMyPicture(picture) {
    const me = currentUser();
    const bytes = new Uint8Array(await picture.arrayBuffer());
    // The server checks again what the dialog checked: the real content (not the declared type) and the size.
    const problem = uploadProblem(bytes);
    if (problem === "empty") invalid("file", "الملف فارغ.", "The file is empty.");
    if (problem === "size")
      invalid("file", `الصورة أكبر من ${PICTURE.maxUploadBytes / 1024} ك.ب.`, `The picture is bigger than ${PICTURE.maxUploadBytes / 1024} KB.`);
    if (problem === "type") invalid("file", "هذا الملف ليس صورة JPEG أو PNG أو WebP.", "This file is not a JPEG, PNG or WebP picture.");
    const user = stored(me.id)!;
    user.avatar_url = `data:${pictureKind(bytes)};base64,${base64(bytes)}`;
    // A person's own picture is their own bookkeeping: read-only mode allows it (like their notification choices).
    commit({ own: true });
    return wait(user);
  },

  async removeMyPicture() {
    const me = currentUser();
    const user = stored(me.id)!;
    delete user.avatar_url;
    commit({ own: true });
    return wait(user);
  },

  async removePictureOf(userId) {
    const actor = currentUser();
    const user = stored(userId);
    if (!user) return fail(404, "NOT_FOUND", "لم يُعثر على المستخدم.", "User not found.");
    if (!canRemovePicture(actor, user)) return fail(403, "FORBIDDEN", "لا يمكنك إزالة صورة شخص آخر.", "You can't remove someone else's picture.");
    if (user.avatar_url) {
      delete user.avatar_url;
      // Removing someone else's picture is in the audit log (who did it, and to whom).
      if (user.id !== actor.id) audit(actor.id, "picture_removed", { type: "user", id: user.id, label: user.name });
      commit(user.id === actor.id ? { own: true } : undefined);
    }
    return wait(user);
  },
};
