import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Real reverse proxy to the FastAPI backend.
// Attaches the NextAuth session's access token as a Bearer header so the
// backend's auth dependency (get_current_user) can identify the caller.
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence-in-depth (in addition to the SameSite=Lax session cookie).
 * For any state-changing method, require the request Origin (or Referer) to
 * match this app's own origin. Browsers always send Origin on cross-origin
 * (and same-origin) mutating requests, so a forged cross-site POST is rejected
 * without needing any client-side token plumbing.
 */
function isSameOrigin(req: NextRequest): boolean {
  const selfOrigin = req.nextUrl.origin;
  const origin = req.headers.get("origin");
  if (origin) return origin === selfOrigin;

  // Some legitimate same-origin requests omit Origin; fall back to Referer.
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === selfOrigin;
    } catch {
      return false;
    }
  }
  // No Origin and no Referer on a mutation — reject to be safe.
  return false;
}

async function handler(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments = [] } = await context.params;
  const path = pathSegments.join("/");

  if (!SAFE_METHODS.has(req.method) && !isSameOrigin(req)) {
    return NextResponse.json(
      { detail: "Cross-origin request blocked." },
      { status: 403 },
    );
  }

  const session = await auth();
  const accessToken = (session as any)?.accessToken as string | undefined;

  const targetUrl = `${API_URL}/api/v1/${path}${req.nextUrl.search}`;

  const headers: Record<string, string> = {};
  const incomingContentType = req.headers.get("content-type");
  if (incomingContentType) headers["Content-Type"] = incomingContentType;
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  // Forward the real client IP so the backend's rate limiter and audit logs see
  // the browser, not this Next.js server. Preserve any upstream chain, appending
  // the immediate peer the platform recorded.
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) headers["X-Forwarded-For"] = forwardedFor;
  const realIp = req.headers.get("x-real-ip");
  if (realIp) headers["X-Real-IP"] = realIp;

  const init: RequestInit = { method: req.method, headers };
  if (!["GET", "HEAD"].includes(req.method)) {
    // Read the raw bytes (not text) so binary / multipart uploads pass through
    // uncorrupted.
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch {
    return NextResponse.json(
      { detail: "Backend is unavailable. Please make sure the API server is running." },
      { status: 502 },
    );
  }

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
