// One error type for every failed API call, so pages can show a clear message.
// The server answers { success: false, message, code, errors } (the same contract as Project 2).
export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_STATE"
  | "RATE_LIMITED"
  | "NETWORK";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Messages per form field: { email: "…" }. */
    public errors?: Record<string, string>,
    public code?: ErrorCode,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** status 0 = no answer from the server (offline, or the server is down) */
export const NETWORK_ERROR = 0;
