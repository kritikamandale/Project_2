import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Shared beforeSend hook for all three Sentry runtimes (client/server/edge).
 *
 * This app's core privacy contract is that face images never leave the
 * browser as pixel data (see app/schemas/scan.py) — this hook exists so an
 * error report can't accidentally become the exception to that contract.
 * It strips:
 *  - cookies and auth headers (session/JWT leakage into error reports)
 *  - any request/extra data that looks like a data: URL or base64 image blob
 *    (a captured camera frame caught mid-transit in a stack trace/breadcrumb)
 *  - the user's email, keeping only a stable non-reversible-looking id
 */
export function scrubSentryEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["Authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["Cookie"];
    }
    if (typeof event.request.data === "string" && isLikelyImageData(event.request.data)) {
      event.request.data = "[Scrubbed: image data]";
    }
  }

  if (event.user?.email) {
    delete event.user.email;
  }

  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      const value = event.extra[key];
      if (typeof value === "string" && isLikelyImageData(value)) {
        event.extra[key] = "[Scrubbed: image data]";
      }
    }
  }

  return event;
}

function isLikelyImageData(value: string): boolean {
  return /^data:image\//.test(value) || value.includes("base64,");
}

/** Drops any breadcrumb whose data contains a captured-frame data: URL. */
export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const raw = JSON.stringify(breadcrumb.data ?? {});
  return isLikelyImageData(raw) ? null : breadcrumb;
}
