// Reads the settings from .env (see .env.example). Vite puts the VITE_* values into the built files.

/**
 * The server's address without "/api/v1" (shared/api/axios.ts adds it). A "/" or "/api/v1" at the end is cut off,
 * so "https://api.example.com", "https://api.example.com/" and "https://api.example.com/api/v1" all work.
 */
export function cleanApiUrl(raw: string | undefined) {
  return (raw ?? "http://localhost:8000").trim().replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
}

export const API_URL = cleanApiUrl(import.meta.env.VITE_API_URL);

// true = fake data in the browser (each feature's mock.ts), false = the real backend.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
