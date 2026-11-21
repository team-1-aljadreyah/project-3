// The profile feature's front door: the person's own profile and picture. Other parts of the app import only from here.
export { profileApi, type ProfileApi } from "./api";
export { ProfileDialog } from "./components/profile-dialog";
export { canRemovePicture, PICTURE } from "./rules";
export type * from "./types";
