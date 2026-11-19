// The settings read from .env (see .env.example). Only names starting with NEXT_PUBLIC_ reach the browser, and
// everyone can read them there: never put a secret in one.
declare namespace NodeJS {
  interface ProcessEnv {
    /** The backend's address, without /api/v1. */
    readonly NEXT_PUBLIC_API_URL?: string;
    /** "true" = demo data in the browser, anything else = the real API. */
    readonly NEXT_PUBLIC_USE_MOCK?: string;
  }
}
