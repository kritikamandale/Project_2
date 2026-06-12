/**
 * CSRF token utilities — double-submit cookie pattern.
 *
 * The server sets a __csrf cookie (non-httpOnly so JS can read it).
 * Every state-changing request sends the value back in X-CSRF-Token header.
 * The server validates that cookie value === header value.
 *
 * This is appropriate here because our API uses Bearer JWT tokens
 * (not session cookies) — CSRF is an extra defence-in-depth layer
 * for any future form-POST flows that might run without Bearer auth.
 */

const CSRF_COOKIE = "__csrf";
const CSRF_HEADER = "X-CSRF-Token";

/** Read CSRF token from the __csrf cookie. */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

/** Fetch a fresh CSRF token from the server and set it in the cookie. */
export async function refreshCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/csrf", { credentials: "same-origin" });
    if (!res.ok) return null;
    const { token } = await res.json();
    return token as string;
  } catch {
    return null;
  }
}

/** Return CSRF header object for fetch() / axios calls. */
export function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  if (!token) return {};
  return { [CSRF_HEADER]: token };
}

/** Attach CSRF header to an existing Headers or plain object. */
export function attachCsrf(headers: HeadersInit = {}): HeadersInit {
  const token = getCsrfToken();
  if (!token) return headers;
  if (headers instanceof Headers) {
    headers.set(CSRF_HEADER, token);
    return headers;
  }
  return { ...headers, [CSRF_HEADER]: token };
}
