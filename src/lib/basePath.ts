/**
 * Base path prefix for API fetch calls and manual navigations.
 * Next.js auto-prepends basePath for next/link and next/router,
 * but raw fetch() and window.location need it manually.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prepend basePath to an absolute path (e.g. "/api/projects" → "/design/api/projects") */
export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

/** Prepend basePath for manual navigation (window.location.href) */
export function navUrl(path: string): string {
  return `${BASE}${path}`;
}
