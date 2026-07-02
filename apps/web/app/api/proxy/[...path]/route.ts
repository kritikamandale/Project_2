import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Real reverse proxy to the FastAPI backend.
// Attaches the NextAuth session's access token as a Bearer header so the
// backend's auth dependency (get_current_user) can identify the caller.
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function handler(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments = [] } = await context.params;
  const path = pathSegments.join("/");

  const session = await auth();
  const accessToken = (session as any)?.accessToken as string | undefined;

  const targetUrl = `${API_URL}/api/v1/${path}${req.nextUrl.search}`;

  const headers: Record<string, string> = {};
  const incomingContentType = req.headers.get("content-type");
  if (incomingContentType) headers["Content-Type"] = incomingContentType;
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const init: RequestInit = { method: req.method, headers };
  if (!["GET", "HEAD"].includes(req.method)) {
    const body = await req.text();
    if (body) init.body = body;
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
