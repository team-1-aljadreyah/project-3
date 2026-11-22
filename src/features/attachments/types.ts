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
  /** A chat voice message only: how long it is and the shape of its sound (docs/backend.md, sections 8 and 11). */
  voice?: VoiceMeta;
}

/**
 * What the site sends with a voice message's audio, so a bubble can draw its bars and show its length without loading
 * the audio. `duration_s`: seconds (one decimal), more than 0 and at most 300. `peaks`: 48 whole numbers from 0 to 100,
 * the loudness of each slice of the recording from its start to its end (100 = its loudest slice).
 */
export interface VoiceMeta {
  duration_s: number;
  peaks: number[];
}
