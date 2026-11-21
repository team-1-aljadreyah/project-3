// For the plain-files build (`npm run build:static`, for Cloudflare Pages): each page with an id is built ONCE, for the
// id "_" (SHELL_ID), and the host serves that one file for every id (public/_redirects). The page then reads the real
// id from the address (./route-param.ts). Safe on the server: the route folders' layouts import it.

/** The id the pages with an id are built for, once, as plain files. Never a real id. */
export const SHELL_ID = "_";

/** The params to build each page with an id for (its folder's `generateStaticParams`). */
export const shellParams = <K extends string>(key: K) => [{ [key]: SHELL_ID } as Record<K, string>];
