// The announcements feature's front door: other parts of the app import only from here.
export { announcementsApi, type AnnouncementsApi } from "./api";
export { canPostAnnouncements } from "./rules";
export { AnnouncementPage } from "./pages/announcement-page";
export { AnnouncementsPage } from "./pages/announcements-page";
export type * from "./types";
