/// <reference types="vite/client" />

// The settings read from .env (see .env.example). Only names starting with VITE_ reach the browser,
// and everyone can read them there: never put a secret in one.
interface ImportMetaEnv {
  /** The backend's address, without /api/v1. */
  readonly VITE_API_URL?: string;
  /** "true" = demo data in the browser, anything else = the real API. */
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
