// The attachments feature's front door: other parts of the app import only from here.
export { attachmentsApi, type AttachmentsApi } from "./api";
export { AttachmentsPanel } from "./components/attachments-panel";
export { ACCEPT, fileProblem, isImage, MAX_FILE_BYTES, sizeText } from "./rules";
export { ProjectFilesPage } from "./pages/project-files-page";
export type * from "./types";
