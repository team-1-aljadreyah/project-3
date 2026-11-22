// The person's own profile: their picture. Pages call `profileApi`; the .env switch decides if it is the real server
// (`profileHttp`) or the demo backend (./mock.ts). Both follow `ProfileApi`. docs/backend.md section 18.
import { http, lazyApi } from "@/shared/api";
import type { User } from "@/shared/api/types";

export interface ProfileApi {
  /** Sets or replaces my picture: the small square the browser made (WebP or JPEG). Answers me, with `avatar_url`. */
  setMyPicture(picture: Blob): Promise<User>;
  /** Removes my picture: my initial shows again. Answers me. */
  removeMyPicture(): Promise<User>;
  /** Removes someone's picture (the CEO and the admin, for a picture that is not appropriate). Answers that person. */
  removePictureOf(userId: number): Promise<User>;
  /** Changes my own password: `PUT /me/password {current_password, password}` (422 on a wrong current one). */
  changeMyPassword(current: string, password: string): Promise<void>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const profileHttp: ProfileApi = {
  setMyPicture: (picture) => {
    // A file goes as "multipart/form-data" with one field, `file` (like the attachments).
    const form = new FormData();
    form.append("file", picture, picture.type === "image/webp" ? "avatar.webp" : "avatar.jpg");
    return data(http.put<User>("/me/avatar", form));
  },
  removeMyPicture: () => data(http.delete<User>("/me/avatar")),
  removePictureOf: (userId) => data(http.delete<User>(`/users/${userId}/avatar`)),
  changeMyPassword: (current, password) => data(http.put<void>("/me/password", { current_password: current, password })),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const profileApi: ProfileApi =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.profileMock)) : profileHttp;
