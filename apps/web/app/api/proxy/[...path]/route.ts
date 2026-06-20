import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Authenticated proxy to FastAPI — attaches Bearer token from session
// ---------------------------------------------------------------------------

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  // Wrap auth() separately so a throw gives us a useful error instead of HTML 500
  let session: Awaited<ReturnType<typeof auth>>;
  try {
    session = await auth();
  } catch (err) {
    console.error("[proxy] auth() threw:", err);
    return new NextResponse(
      JSON.stringify({ detail: "Authentication error. Please sign out and sign back in." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Session missing or refresh failed — tell the client to re-authenticate
  if (!session || (session as any)?.error) {
    console.warn("[proxy] no session or session error:", (session as any)?.error ?? "no session");
    return new NextResponse(
      JSON.stringify({ detail: "Session expired. Please log in again." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const accessToken = (
    (session as any)?.accessToken ?? (session?.user as any)?.accessToken
  ) as string | undefined;

  if (!accessToken) {
    console.warn("[proxy] session has no accessToken");
    return new NextResponse(
      JSON.stringify({ detail: "Not authenticated." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build target URL
  const resolvedParams = await params;
  const targetPath = resolvedParams.path.join("/");
  const targetUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/${targetPath}${req.nextUrl.search}`;

  console.log(`[proxy] ${req.method} ${targetPath} → ${targetUrl}`);

  // Read body as text upfront — avoids ReadableStream duplex issues in Next.js 14
  let body: string | undefined;
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await req.text();
    }
  } catch (err) {
    console.error("[proxy] req.text() threw:", err);
    return new NextResponse(
      JSON.stringify({ detail: "Failed to read request body." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build a clean header set
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${accessToken}`);
  for (const name of ["accept", "accept-language", "x-request-id"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const proxied = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseText = await proxied.text();
    console.log(`[proxy] FastAPI responded ${proxied.status} for ${targetPath}`);
    return new NextResponse(responseText, {
      status: proxied.status,
      headers: {
        "Content-Type": proxied.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    console.error("[proxy] fetch to FastAPI threw:", err);
    return new NextResponse(
      JSON.stringify({ detail: "Unable to reach the backend server. Please try again." }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
