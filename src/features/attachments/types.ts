// The data shapes of file attachments, shared by the real API, the demo backend and the pages.

/** What a file is attached to. Bugs and chat messages will be added here later (the brief). */
export type OwnerType = "task" | "project" | "bug" | "message";

export interface AttachmentOwner {
  type: OwnerType;
  id: number;
}

export interface Attachment {
  id: number;
  owner_type: OwnerType;
  owner_id: number;
  /** The file's name as uploaded. */
  name: string;
  /** Size in bytes. */
  size: number;
  /** The file's type, for example "image/png" or "application/pdf". */
  mime: string;
  /** Where to download it from (the server may give a short-lived link). */
  url: string;
  uploaded_by: number;
  at: string;
}
