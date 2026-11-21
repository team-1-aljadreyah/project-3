// The data shapes of the profile. The person is the shared `User` (src/shared/api/types.ts, with `avatar_url`).

/** Where the profile window opens: the profile itself, or straight on choosing a new picture (the camera badge). */
export type ProfileStart = "view" | "pick";

/** A picture the person picked, read by the browser, waiting to be cropped. */
export interface PickedPicture {
  /** A short-lived address of the file in this tab (URL.createObjectURL), freed when it is done. */
  url: string;
  w: number;
  h: number;
  image: HTMLImageElement;
}
