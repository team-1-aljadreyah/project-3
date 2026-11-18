// File attachments of tasks and projects. Pages call `attachmentsApi`; the .env switch decides if it is the real server
// or the demo backend (./mock.ts). Both follow `AttachmentsApi`.
import { http, lazyApi } from "@/shared/api";
import type { Attachment, AttachmentOwner } from "./types";

export interface AttachmentsApi {
  list(owner: AttachmentOwner): Promise<Attachment[]>;
  /** Uploads one file. `onProgress` gets 0–1 while it uploads (the real server only; the demo is instant). */
  upload(owner: AttachmentOwner, file: File, onProgress?: (ratio: number) => void): Promise<Attachment>;
  remove(id: number): Promise<void>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);
/** "/tasks/12/attachments", "/projects/3/attachments". */
const pathOf = (owner: AttachmentOwner) => `/${owner.type}s/${owner.id}/attachments`;

export const attachmentsHttp: AttachmentsApi = {
  list: (owner) => data(http.get<Attachment[]>(pathOf(owner))),
  upload: (owner, file, onProgress) => {
    // A file goes as "multipart/form-data", the browser's way to send files (not JSON).
    const form = new FormData();
    form.append("file", file);
    return data(
      http.post<Attachment>(pathOf(owner), form, {
        onUploadProgress: (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
      }),
    );
  },
  remove: (id) => data(http.delete<void>(`/attachments/${id}`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const attachmentsApi: AttachmentsApi =
  import.meta.env.VITE_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.attachmentsMock)) : attachmentsHttp;
