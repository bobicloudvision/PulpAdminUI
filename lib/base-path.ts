/**
 * Optional sub-path the app is served under (e.g. "/pulp-admin" behind nginx).
 * Set BASE_PATH at build time; next.config.ts passes it to Next.js `basePath`
 * and exposes it here as NEXT_PUBLIC_BASE_PATH. Empty means the app runs at "/".
 *
 * Next.js prefixes Link, router.push/replace and redirect() on its own, but not
 * plain fetch() calls or next/image `src`, so those go through these helpers.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}

/** Base for the app's own API routes (app/api/pulp/*), as seen from the browser. */
export const API_BASE = withBasePath("/api/pulp");
